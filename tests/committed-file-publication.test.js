import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareCommittedFilePublication,
  publishCommittedFile,
  renderCommittedFile,
  resolveCommittedFilePath,
} from "../src/committed-file-publication.js";

const task = {
  task_id: "task-123",
  target_repository: "example/project",
  pull_request: 42,
  result_commit: "0123456789abcdef0123456789abcdef01234567",
  prompt: "private prompt",
  report: "private report",
  prompt_sha256: "prompt-hash-must-not-appear",
  report_sha256: "report-hash-must-not-appear",
};
const recordUrl = "https://github.com/example/records/blob/abc/task.md";
const configuration = {
  presentation: "reference",
  adapter: "github",
  repository: "explicit/provenance",
  branch: "records/main",
  path_template: "crossdock/{task_id}.md",
};

test("link and reference Markdown are deterministic, bounded, and LF terminated", () => {
  assert.equal(renderCommittedFile({ presentation: "link", task, recordUrl }), `# Crossdock provenance\n\nTask record: ${recordUrl}\n`);
  const reference = renderCommittedFile({ presentation: "reference", task, recordUrl });
  assert.equal(reference, `# Crossdock provenance\n\nTask: \`task-123\`\nRepository: \`example/project\`\nPull request: \`#42\`\nCommit: \`0123456789abcdef0123456789abcdef01234567\`\n\nTask record: ${recordUrl}\n`);
  for (const forbidden of [task.prompt, task.report, task.prompt_sha256, task.report_sha256]) assert.ok(!reference.includes(forbidden));
});

test("reference omits absent optional PR and commit fields", () => {
  const content = renderCommittedFile({ presentation: "reference", task: { task_id: "task-123", target_repository: "example/project" }, recordUrl });
  assert.ok(!content.includes("Pull request:"));
  assert.ok(!content.includes("Commit:"));
});

test("resolved paths expand validated task IDs and reject unsafe or residual paths", () => {
  assert.equal(resolveCommittedFilePath("provenance/{task_id}.md", "task-123"), "provenance/task-123.md");
  for (const template of ["../{task_id}.md", "/{task_id}.md", "a//{task_id}.md", "a/./{task_id}.md", "a/{task_id}/{other}.md", "a\\{task_id}.md", "{task_id}/"]) {
    assert.throws(() => resolveCommittedFilePath(template, "task-123"), /repository-relative path/);
  }
});

function remote(initial, { readError, verificationContent } = {}) {
  let content = initial;
  let reads = 0;
  const calls = [];
  return {
    calls,
    async getFile(repository, path, branch) {
      calls.push(["getFile", repository, path, branch]);
      reads += 1;
      if (readError && reads === 1) throw readError;
      if (content == null) throw Object.assign(new Error("not found"), { status: 404 });
      const value = reads > 1 && verificationContent !== undefined ? verificationContent : content;
      return { encoding: "base64", content: Buffer.from(value, "utf8").toString("base64") };
    },
    async createFile(repository, path, value, message, branch) {
      calls.push(["createFile", repository, path, value, message, branch]);
      content = value;
      return { commit: { sha: "abc" } };
    },
  };
}

test("absent file is created at only the explicit destination and then verified", async () => {
  const github = remote(null);
  const prepared = prepareCommittedFilePublication(configuration, task);
  const result = await publishCommittedFile({ github, prepared, task, recordUrl });
  assert.deepEqual(result, { presentation: "reference", repository: "explicit/provenance", branch: "records/main", path: "crossdock/task-123.md", verification: "verified", result: "created" });
  assert.deepEqual(github.calls.map((call) => call.slice(0, 4)), [
    ["getFile", "explicit/provenance", "crossdock/task-123.md", "records/main"],
    ["createFile", "explicit/provenance", "crossdock/task-123.md", renderCommittedFile({ presentation: "reference", task, recordUrl })],
    ["getFile", "explicit/provenance", "crossdock/task-123.md", "records/main"],
  ]);
  assert.ok(!github.calls.some((call) => call.includes(task.target_repository)));
});

test("exact existing file is verified without mutation", async () => {
  const content = renderCommittedFile({ presentation: "reference", task, recordUrl });
  const github = remote(content);
  const result = await publishCommittedFile({ github, prepared: prepareCommittedFilePublication(configuration, task), task, recordUrl });
  assert.equal(result.result, "existing");
  assert.equal(github.calls.filter(([method]) => method === "createFile").length, 0);
  assert.equal(github.calls.filter(([method]) => method === "getFile").length, 2);
});

test("conflict, non-404 read failure, and post-write mismatch fail closed", async () => {
  const prepared = prepareCommittedFilePublication(configuration, task);
  const conflict = remote("different\n");
  await assert.rejects(publishCommittedFile({ github: conflict, prepared, task, recordUrl }), /conflict/);
  assert.ok(!conflict.calls.some(([method]) => method === "createFile"));

  const forbidden = Object.assign(new Error("forbidden"), { status: 403 });
  const failedRead = remote(null, { readError: forbidden });
  await assert.rejects(publishCommittedFile({ github: failedRead, prepared, task, recordUrl }), (error) => error === forbidden);
  assert.ok(!failedRead.calls.some(([method]) => method === "createFile"));

  const mismatch = remote(null, { verificationContent: "different\n" });
  await assert.rejects(publishCommittedFile({ github: mismatch, prepared, task, recordUrl }), /verification failed/);
});

test("secret-like reference metadata fails during preparation before mutation", () => {
  assert.throws(
    () => prepareCommittedFilePublication(configuration, { ...task, target_repository: "example/password=not-for-github" }),
    /Forbidden-from-GitHub/,
  );
});
