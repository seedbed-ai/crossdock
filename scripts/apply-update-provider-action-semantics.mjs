import fs from "node:fs";

const files = {
  content: "extension/content.js",
  background: "extension/background.js",
  dashboard: "extension/dashboard.js",
  html: "extension/dashboard.html",
  dashboardTests: "tests/dashboard.test.js",
  integrityTests: "tests/pr-integrity-ui.test.js",
};

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");

function replaceOnce(source, oldText, newText, label) {
  const index = source.indexOf(oldText);
  if (index < 0) throw new Error(`${label} not found`);
  if (source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(`${label} is ambiguous`);
  return source.slice(0, index) + newText + source.slice(index + oldText.length);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label} start not found`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label} end not found`);
  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
}

let content = read(files.content);
let background = read(files.background);
let dashboard = read(files.dashboard);
let html = read(files.html);
let dashboardTests = read(files.dashboardTests);
let integrityTests = read(files.integrityTests);

content = replaceRange(
  content,
  "function inspectCodexTask() {",
  "function prepareCreatePr(",
  `function inspectCodexTask() {
  requireCodexPage();
  return {
    taskUrl: location.href,
    createPrAvailable: Boolean(findButton(["Create PR"], false)),
    updateBranchAvailable: Boolean(findButton(["Update branch"], false)),
  };
}`,
  "inspectCodexTask",
);

content = replaceRange(
  content,
  "function prepareBranchUpdate(",
  "function captureCodexReport() {",
  `function prepareBranchUpdate(captureReport = true) {
  requireCodexPage();

  const actions = [
    { providerAction: "update_branch", button: findButton(["Update branch"], false) },
    { providerAction: "create_pr", button: findButton(["Create PR"], false) },
  ].filter(({ button }) => Boolean(button));

  if (actions.length !== 1) {
    throw new Error(\`Codex update publication action must resolve to exactly one supported control; found \${actions.length}\`);
  }

  const result = { taskUrl: location.href, providerAction: actions[0].providerAction };
  if (captureReport) result.report = captureCodexReport();
  actions[0].button.click();
  return result;
}`,
  "prepareBranchUpdate",
);

background = replaceOnce(
  background,
  `    case "crossdock.applyBranchUpdate": {
      const tab = await findChatGptTab(true);
      return sendToTab(tab.id, { type: "crossdock.prepareBranchUpdate", captureReport: message.captureReport !== false });
    }`,
  `    case "crossdock.applyBranchUpdate": {
      const tab = await findChatGptTab(true);
      const discovery = { beforePrUrls: await snapshotPrEvidence(tab.id) };
      const prepared = await sendToTab(tab.id, {
        type: "crossdock.prepareBranchUpdate",
        captureReport: message.captureReport !== false,
      });
      return { ...prepared, discovery };
    }
    case "crossdock.inspectUpdatePrEvidence": {
      const tab = await findChatGptTab(true);
      return inspectUpdatePrEvidence({
        tabId: tab.id,
        targetRepository: message.targetRepository,
        pullRequest: message.pullRequest,
        discovery: message.discovery,
      });
    }`,
  "background update action",
);

background = replaceOnce(
  background,
  `function wrongRepositoryPrMessage(targetRepository, urls) {
  const repositories = [...new Set(urls.map(repositoryFromGitHubPrUrl))];
  return \`created PR integrity failure: expected repository \${targetRepository}, but new PR evidence appeared in \${repositories.join(", ")}: \${urls.join(", ")}\`;
}`,
  `function wrongRepositoryPrMessage(targetRepository, urls) {
  const repositories = [...new Set(urls.map(repositoryFromGitHubPrUrl))];
  return \`created PR integrity failure: expected repository \${targetRepository}, but new PR evidence appeared in \${repositories.join(", ")}: \${urls.join(", ")}\`;
}

async function inspectUpdatePrEvidence({ tabId, targetRepository, pullRequest, discovery }) {
  if (!Number.isInteger(pullRequest) || pullRequest <= 0) {
    throw new Error("existing pull request must be a positive integer");
  }

  const evidence = await findNewPrEvidence({ tabId, targetRepository, discovery });
  if (evidence.wrongRepository.length) {
    const repositories = [...new Set(evidence.wrongRepository.map(repositoryFromGitHubPrUrl))];
    return {
      integrityError: \`update PR integrity failure: expected repository \${targetRepository}, but new PR evidence appeared in \${repositories.join(", ")}: \${evidence.wrongRepository.join(", ")}\`,
    };
  }

  const expectedPrUrl = canonicalPrUrl(
    \`https://github.com/\${targetRepository}/pull/\${pullRequest}\`,
    targetRepository,
  );
  const unexpectedTarget = evidence.target.filter((url) => url !== expectedPrUrl);
  if (unexpectedTarget.length) {
    return {
      integrityError: \`update PR integrity failure: expected existing PR \${expectedPrUrl}, but new target-repository PR evidence appeared: \${unexpectedTarget.join(", ")}\`,
    };
  }

  return { integrityError: null };
}`,
  "update PR evidence helper",
);

dashboard = replaceOnce(
  dashboard,
  `  const initialSnapshot = mode === "update"
    ? await publish("/pr/snapshot", { target_repository: repository, pull_request: prNumber }, serviceUrl)
    : null;

  const pending = {`,
  `  const initialSnapshot = mode === "update"
    ? await publish("/pr/snapshot", { target_repository: repository, pull_request: prNumber }, serviceUrl)
    : null;

  if (initialSnapshot && (
    initialSnapshot.repository !== repository ||
    typeof initialSnapshot.working_branch !== "string" ||
    !initialSnapshot.working_branch.trim() ||
    typeof initialSnapshot.head_sha !== "string" ||
    !initialSnapshot.head_sha.trim()
  )) {
    throw new Error("existing PR snapshot did not return the configured repository, working branch, and head SHA");
  }

  const pending = {`,
  "initial PR snapshot validation",
);

dashboard = replaceOnce(
  dashboard,
  `    initial_head_sha: initialSnapshot?.head_sha ?? null,
    phase: "submitting",`,
  `    initial_head_sha: initialSnapshot?.head_sha ?? null,
    initial_working_branch: initialSnapshot?.working_branch?.trim() ?? null,
    phase: "submitting",`,
  "pending update branch snapshot",
);

dashboard = replaceOnce(
  dashboard,
  `  taskState = { ...pending, task_url: result.taskUrl, phase: "running" };
  await saveTaskState();
  setStatus(\`Task submitted. Monitoring for \${mode === "initial" ? "Create PR" : "Update branch"} readiness…\`);`,
  `  taskState = {
    ...pending,
    task_url: result.taskUrl,
    provider_branch: result.providerContext?.base_branch ?? null,
    phase: "running",
  };
  await saveTaskState();
  setStatus(\`Task submitted. Monitoring for \${mode === "initial" ? "Create PR" : "provider publication"} readiness…\`);`,
  "submitted task state",
);

dashboard = replaceOnce(
  dashboard,
  `      if (taskState.phase === "pr-create-integrity-error") {
        setStatus(\`PR creation integrity failure: \${taskState.pr_integrity_error}\`, true);
        return;
      }`,
  `      if (taskState.phase === "pr-create-integrity-error") {
        setStatus(\`PR creation integrity failure: \${taskState.pr_integrity_error}\`, true);
        return;
      }

      if (taskState.phase === "pr-update-integrity-error") {
        setStatus(\`PR update integrity failure: \${taskState.pr_integrity_error}\`, true);
        return;
      }`,
  "update integrity phase",
);

dashboard = replaceOnce(
  dashboard,
  `        const state = await send({ type: "crossdock.inspectCodex" });
        const ready = taskState.mode === "initial" ? state.createPrAvailable : state.updateBranchAvailable;
        if (ready) {`,
  `        const state = await send({ type: "crossdock.inspectCodex" });
        const updateActionCount = Number(Boolean(state.updateBranchAvailable)) + Number(Boolean(state.createPrAvailable));
        if (taskState.mode === "update" && updateActionCount > 1) {
          throw new Error(\`Codex update publication action is ambiguous; found \${updateActionCount} supported controls\`);
        }
        const ready = taskState.mode === "initial" ? state.createPrAvailable : updateActionCount === 1;
        if (ready) {`,
  "update readiness",
);

dashboard = replaceOnce(
  dashboard,
  `          setStatus(\`Task is ready. Review the task and choose \${taskState.mode === "initial" ? "Finalize new PR" : "Finalize branch update"}.\`);`,
  `          setStatus(\`Task is ready. Review the task and choose \${taskState.mode === "initial" ? "Finalize new PR" : "Finalize PR update"}.\`);`,
  "ready status",
);

dashboard = replaceOnce(
  dashboard,
  `        setStatus(\`Task is still running. Waiting for \${taskState.mode === "initial" ? "Create PR" : "Update branch"}…\`);`,
  `        setStatus(\`Task is still running. Waiting for \${taskState.mode === "initial" ? "Create PR" : "provider publication action"}…\`);`,
  "running status",
);

dashboard = replaceRange(
  dashboard,
  "async function finalizeUpdate() {",
  "async function finishUpdateAfterRemoteChange() {",
  `async function finalizeUpdate() {
  requireTaskState("update");
  if (!["running", "ready"].includes(taskState.phase)) throw new Error(\`update task cannot finalize from phase \${taskState.phase}\`);

  const preAction = await publish("/pr/snapshot", {
    target_repository: taskState.repository,
    pull_request: taskState.pull_request,
  });
  assertUpdatePreActionSnapshot(preAction);

  taskState.phase = "finalizing";
  await saveTaskState();
  setStatus("Publishing the update and verifying the existing PR head…");

  try {
    const result = await send({
      type: "crossdock.applyBranchUpdate",
      targetRepository: taskState.repository,
      pullRequest: taskState.pull_request,
      captureReport: taskState.evidence_policy.report !== "omit",
    });
    taskState.phase = "branch-update-clicked";
    taskState.final_task_url = result.taskUrl;
    taskState.final_report = result.report;
    taskState.update_pr_discovery = result.discovery;
    taskState.provider_action = result.providerAction;
    await saveTaskState();
    await finishUpdateAfterRemoteChange();
  } catch (error) {
    if (taskState?.phase === "finalizing") {
      taskState.phase = "ready";
      await saveTaskState();
    } else if (taskState?.phase === "branch-update-clicked") {
      void monitorTask();
    }
    throw error;
  }
}`,
  "finalizeUpdate",
);

dashboard = replaceOnce(
  dashboard,
  `  const changed = await waitForPrHeadChange({
    repository: taskState.repository,
    prNumber: taskState.pull_request,
    previousSha: taskState.initial_head_sha,
  });`,
  `  const changed = await waitForPrHeadChange({
    repository: taskState.repository,
    prNumber: taskState.pull_request,
    previousSha: taskState.initial_head_sha,
    workingBranch: taskState.initial_working_branch,
    discovery: taskState.update_pr_discovery,
  });`,
  "post-publication PR verification call",
);

dashboard = replaceOnce(
  dashboard,
  `  setStatus(\`Branch update recorded on PR #\${prNumber} at \${changed.head_sha.slice(0, 12)}.\`);`,
  `  setStatus(\`PR update recorded on #\${prNumber} at \${changed.head_sha.slice(0, 12)}.\`);`,
  "update completion status",
);

dashboard = replaceRange(
  dashboard,
  "async function waitForPrHeadChange(",
  "async function completeTask(",
  `function assertUpdatePreActionSnapshot(snapshot) {
  if (!taskState.initial_working_branch) throw new Error("pre-update PR working branch snapshot is missing");
  if (!taskState.initial_head_sha) throw new Error("pre-update PR head snapshot is missing");
  if (taskState.provider_branch !== taskState.initial_working_branch) {
    throw new Error(\`Codex provider branch does not match frozen PR working branch: \${taskState.provider_branch || "none"}\`);
  }
  if (snapshot.repository !== taskState.repository) throw new Error("existing PR repository changed before provider publication");
  if (snapshot.working_branch !== taskState.initial_working_branch) throw new Error("existing PR working branch changed before provider publication");
  if (snapshot.head_sha !== taskState.initial_head_sha) throw new Error("existing PR head changed before provider publication");
}

async function waitForPrHeadChange({ repository, prNumber, previousSha, workingBranch, discovery }) {
  if (!previousSha) throw new Error("pre-update PR head snapshot is missing");
  if (!workingBranch) throw new Error("pre-update PR working branch snapshot is missing");
  if (!discovery) throw new Error("update PR discovery baseline is missing");

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const evidence = await send({
      type: "crossdock.inspectUpdatePrEvidence",
      targetRepository: repository,
      pullRequest: prNumber,
      discovery,
    });
    if (evidence.integrityError) {
      taskState.phase = "pr-update-integrity-error";
      taskState.pr_integrity_error = evidence.integrityError;
      await saveTaskState();
      throw new Error(evidence.integrityError);
    }

    const snapshot = await publish("/pr/snapshot", { target_repository: repository, pull_request: prNumber });
    if (snapshot.repository !== repository || snapshot.working_branch !== workingBranch) {
      const message = "existing PR repository or working branch changed after provider publication";
      taskState.phase = "pr-update-integrity-error";
      taskState.pr_integrity_error = message;
      await saveTaskState();
      throw new Error(message);
    }

    if (snapshot.head_sha && snapshot.head_sha !== previousSha) {
      const finalEvidence = await send({
        type: "crossdock.inspectUpdatePrEvidence",
        targetRepository: repository,
        pullRequest: prNumber,
        discovery,
      });
      if (finalEvidence.integrityError) {
        taskState.phase = "pr-update-integrity-error";
        taskState.pr_integrity_error = finalEvidence.integrityError;
        await saveTaskState();
        throw new Error(finalEvidence.integrityError);
      }
      return snapshot;
    }

    await sleep(2000);
  }

  throw new Error("timed out waiting for the existing GitHub PR head to change after provider publication");
}`,
  "waitForPrHeadChange",
);

html = replaceOnce(
  html,
  '<button id="finalize-update">Finalize branch update</button>',
  '<button id="finalize-update">Finalize PR update</button>',
  "finalize update label",
);

dashboardTests = replaceOnce(
  dashboardTests,
  `      initial_head_sha: "old-head",
      task_url: "https://agent.example/tasks/1",`,
  `      initial_head_sha: "old-head",
      initial_working_branch: "feature/update",
      provider_branch: "feature/update",
      task_url: "https://agent.example/tasks/1",`,
  "dashboard test frozen branch",
);

dashboardTests = replaceOnce(
  dashboardTests,
  `        if (message.type === "crossdock.applyBranchUpdate") {
          return { ok: true, result: { taskUrl: "https://agent.example/tasks/1", report: "Done" } };
        }
        return { ok: true, result: {} };`,
  `        if (message.type === "crossdock.applyBranchUpdate") {
          return {
            ok: true,
            result: {
              taskUrl: "https://agent.example/tasks/1",
              report: "Done",
              providerAction: "create_pr",
              discovery: { beforePrUrls: [] },
            },
          };
        }
        if (message.type === "crossdock.inspectUpdatePrEvidence") {
          return { ok: true, result: { integrityError: null } };
        }
        return { ok: true, result: {} };`,
  "dashboard test provider action",
);

dashboardTests = replaceOnce(
  dashboardTests,
  `  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (url.endsWith("/pr/snapshot")) return okResponse({ head_sha: "new-head" });
    if (url.endsWith("/handoff/update")) return okResponse({ task_record_url: "https://records.example/task" });`,
  `  let prSnapshotCalls = 0;
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (url.endsWith("/pr/snapshot")) {
      prSnapshotCalls += 1;
      return okResponse({
        repository: "example/repo",
        working_branch: "feature/update",
        head_sha: prSnapshotCalls === 1 ? "old-head" : "new-head",
      });
    }
    if (url.endsWith("/handoff/update")) return okResponse({ task_record_url: "https://records.example/task" });`,
  "dashboard test PR snapshots",
);

if (!integrityTests.includes('test("existing-PR update snapshots PR evidence before provider publication"')) {
  integrityTests += `\n\ntest("existing-PR update snapshots PR evidence before provider publication", () => {
  const start = background.indexOf('case "crossdock.applyBranchUpdate"');
  const end = background.indexOf('case "crossdock.openChatGPT"');
  const updateCase = background.slice(start, end);
  assert.match(updateCase, /beforePrUrls: await snapshotPrEvidence/);
  assert.match(updateCase, /crossdock\\.prepareBranchUpdate/);
  assert.match(updateCase, /crossdock\\.inspectUpdatePrEvidence/);
});

test("update PR integrity permits the expected existing PR but rejects another PR", () => {
  assert.match(background, /expectedPrUrl/);
  assert.match(background, /unexpectedTarget = evidence\\.target\\.filter/);
  assert.match(background, /update PR integrity failure/);
  assert.match(dashboard, /pr-update-integrity-error/);
});

test("update readiness accepts one provider publication control instead of requiring Update branch", () => {
  assert.match(dashboard, /updateActionCount/);
  assert.match(dashboard, /state\\.updateBranchAvailable/);
  assert.match(dashboard, /state\\.createPrAvailable/);
  assert.match(dashboard, /updateActionCount === 1/);
});\n`;
}

for (const [path, value] of [
  [files.content, content],
  [files.background, background],
  [files.dashboard, dashboard],
  [files.html, html],
  [files.dashboardTests, dashboardTests],
  [files.integrityTests, integrityTests],
]) write(path, value);

console.log("Applied update provider-action semantics patch.");
