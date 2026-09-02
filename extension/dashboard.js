import {
  DEFAULT_PUBLICATION_POLICY,
  migrateActiveTaskPublication,
  normalizeBrowserPublicationPolicy,
} from "./publication-client.js";
import { migrateActiveTaskIntent, normalizeBrowserIntent } from "./intent-client.js";
import {
  DEFAULT_PROMPT_RECOVERY_MODE,
  DEFAULT_REPORT_RECOVERY_MODE,
  assertPromptAvailableForRecovery,
  assertReportAvailableForRecovery,
  migrateActiveTaskRecovery,
  normalizePromptRecoveryMode,
  normalizeReportRecoveryMode,
  taskStateForLocalPersistence,
} from "./recovery-client.js";
import {
  DEFAULT_SERVICE_URL,
  migrateActiveTaskServiceUrl,
  normalizeServiceUrl,
  postServiceJson,
} from "./service-client.js";

const $ = (id) => document.getElementById(id);
const fields = ["repository", "issue", "pull-request", "handoff-mode", "work-intent", "service-url", "storage-repository", "storage-branch", "prompt-evidence", "report-evidence", "prompt-recovery", "report-recovery", "change-description-publication", "change-comment-publication", "committed-file-publication", "committed-file-repository", "committed-file-branch", "committed-file-path-template", "summary", "validation", "prompt"];
const POLL_MS = 5000;
let taskState = null;
let monitoring = false;

void restore();

$("open-chatgpt").addEventListener("click", () => send({ type: "crossdock.openChatGPT" }));
$("open-codex").addEventListener("click", () => send({ type: "crossdock.openCodex" }));
$("open-github").addEventListener("click", async () => {
  const repo = requireRepository();
  const pr = parseOptionalPrNumber();
  await send({ type: "crossdock.openGitHub", url: pr ? `https://github.com/${repo}/pull/${pr}` : `https://github.com/${repo}` });
});

$("capture").addEventListener("click", run(async () => {
  const result = await send({ type: "crossdock.capturePrompt" });
  $("prompt").value = result.prompt;
  await persist();
  setStatus("Captured the latest ChatGPT assistant response.");
}));

$("submit").addEventListener("click", run(async () => {
  if (taskState) throw new Error("a coding-agent task is already active");
  // Validate before repository snapshots, service calls, or provider actions.
  const intent = normalizeBrowserIntent($("work-intent").value);
  const prompt = $("prompt").value;
  if (!prompt.trim()) throw new Error("capture a prompt first");

  const repository = requireRepository();
  const serviceUrl = requireServiceUrl();
  const storage = requireStorage();
  const evidencePolicy = readEvidencePolicy();
  const recovery = readRecoveryPolicy();
  const publication = readPublicationPolicy();
  const prNumber = parseOptionalPrNumber();
  const mode = prNumber ? "update" : "initial";
  const initialSnapshot = mode === "update"
    ? await publish("/pr/snapshot", { target_repository: repository, pull_request: prNumber }, serviceUrl)
    : null;

  const pending = {
    task_id: `crossdock-${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
    prompt,
    intent,
    mode,
    handoff_mode: $("handoff-mode").value,
    evidence_policy: evidencePolicy,
    recovery,
    publication,
    repository,
    service_url: serviceUrl,
    storage,
    pull_request: prNumber,
    initial_head_sha: initialSnapshot?.head_sha ?? null,
    phase: "submitting",
  };

  // Persist preferences using the selected recovery policy before submission so
  // a memory-only prompt cannot remain in the dashboard form's local state.
  await persist();

  const result = await send({ type: "crossdock.submitCodex", prompt });
  taskState = { ...pending, task_url: result.taskUrl, phase: "running" };
  await saveTaskState();
  setStatus(`Task submitted. Monitoring for ${mode === "initial" ? "Create PR" : "Update branch"} readiness…`);
  void monitorTask();
}));

$("finalize-initial").addEventListener("click", run(async () => {
  requireReady("initial");
  await finalizeInitial();
}));

$("finalize-update").addEventListener("click", run(async () => {
  requireReady("update");
  await finalizeUpdate();
}));

for (const id of fields.filter((id) => id !== "prompt")) {
  $(id).addEventListener("change", () => void persist());
}
$("committed-file-publication").addEventListener("change", updateCommittedFileControls);

async function monitorTask() {
  if (monitoring || !taskState) return;
  monitoring = true;
  try {
    while (taskState) {
      if (taskState.phase === "pr-create-uncertain") {
        try {
          const recovered = await recoverInitialPrCreation();
          if (!recovered) {
            setStatus("Create PR was invoked, but the resulting PR URL is not visible yet. Waiting without invoking Create PR again…");
            await sleep(POLL_MS);
          }
          continue;
        } catch (error) {
          setStatus(`Recovering created PR: ${error.message}. Will retry without invoking Create PR again.`, true);
          await sleep(POLL_MS);
          continue;
        }
      }

      if (taskState.phase === "pr-created") {
        try {
          await finishInitialAfterPrCreated();
          continue;
        } catch (error) {
          setStatus(`Finishing created PR handoff: ${error.message}. Will retry.`, true);
          await sleep(POLL_MS);
          continue;
        }
      }

      if (taskState.phase === "branch-update-clicked") {
        try {
          await finishUpdateAfterRemoteChange();
          continue;
        } catch (error) {
          setStatus(`Waiting for GitHub branch update: ${error.message}. Will retry.`, true);
          await sleep(POLL_MS);
          continue;
        }
      }

      if (!["running", "ready"].includes(taskState.phase)) return;
      if (taskState.phase === "ready" && taskState.handoff_mode === "review") return;

      try {
        const state = await send({ type: "crossdock.inspectCodex" });
        const ready = taskState.mode === "initial" ? state.createPrAvailable : state.updateBranchAvailable;
        if (ready) {
          taskState.phase = "ready";
          await saveTaskState();
          if (taskState.handoff_mode === "automatic") {
            if (taskState.mode === "initial") await finalizeInitial();
            else await finalizeUpdate();
            continue;
          }
          setStatus(`Task is ready. Review the task and choose ${taskState.mode === "initial" ? "Finalize new PR" : "Finalize branch update"}.`);
          return;
        }
        setStatus(`Task is still running. Waiting for ${taskState.mode === "initial" ? "Create PR" : "Update branch"}…`);
      } catch (error) {
        setStatus(`Monitoring: ${error.message}. Will retry.`, true);
      }
      await sleep(POLL_MS);
    }
  } finally {
    monitoring = false;
  }
}

async function finalizeInitial() {
  requireTaskState("initial");
  if (!["running", "ready"].includes(taskState.phase)) throw new Error(`initial task cannot finalize from phase ${taskState.phase}`);
  taskState.phase = "finalizing";
  await saveTaskState();
  setStatus("Creating PR and recording task provenance…");

  try {
    const result = await send({
      type: "crossdock.createPrAndInspect",
      targetRepository: taskState.repository,
      captureReport: taskState.evidence_policy.report !== "omit",
    });
    taskState.final_task_url = result.taskUrl;
    taskState.final_report = result.report;
    taskState.pr_discovery = result.discovery;

    if (!result.prUrl) {
      taskState.phase = "pr-create-uncertain";
      await saveTaskState();
      setStatus("Create PR was invoked, but Crossdock has not identified the resulting PR yet. Recovering without invoking Create PR again…");
      void monitorTask();
      return;
    }

    await rememberCreatedPr(result.prUrl);
    await finishInitialAfterPrCreated();
  } catch (error) {
    if (taskState?.phase === "finalizing") {
      taskState.phase = "ready";
      await saveTaskState();
    } else if (["pr-create-uncertain", "pr-created"].includes(taskState?.phase)) {
      void monitorTask();
    }
    throw error;
  }
}

async function recoverInitialPrCreation() {
  requireTaskState("initial");
  if (taskState.phase !== "pr-create-uncertain") return false;
  if (!taskState.pr_discovery || !taskState.final_task_url) throw new Error("created PR recovery state is incomplete");

  const result = await send({
    type: "crossdock.recoverCreatedPr",
    targetRepository: taskState.repository,
    discovery: taskState.pr_discovery,
  });
  if (!result.prUrl) return false;
  await rememberCreatedPr(result.prUrl);
  return true;
}

async function rememberCreatedPr(prUrl) {
  const prNumber = parsePrNumber(prUrl, taskState.repository);
  $("pull-request").value = String(prNumber);
  taskState.phase = "pr-created";
  taskState.pull_request = prNumber;
  taskState.final_pr_url = prUrl;
  await saveTaskState();
  await persist();
}

async function finishInitialAfterPrCreated() {
  requireTaskState("initial");
  if (taskState.phase !== "pr-created") return;
  if (!taskState.pull_request || !taskState.final_pr_url || !taskState.final_task_url) throw new Error("created PR recovery state is incomplete");

  const result = { taskUrl: taskState.final_task_url, report: taskState.final_report };
  await publish("/handoff/initial", {
    storage: taskState.storage,
    publication: taskState.publication,
    task: buildTask({ repository: taskState.repository, prNumber: taskState.pull_request, result }),
    pr: buildDescription(),
  });

  const prNumber = taskState.pull_request;
  const prUrl = taskState.final_pr_url;
  await completeTask(prNumber);
  setStatus(`Initial PR finalized: ${prUrl}`);
}

async function finalizeUpdate() {
  requireTaskState("update");
  if (!["running", "ready"].includes(taskState.phase)) throw new Error(`update task cannot finalize from phase ${taskState.phase}`);
  taskState.phase = "finalizing";
  await saveTaskState();
  setStatus("Updating the PR branch and verifying the remote head…");

  try {
    const result = await send({
      type: "crossdock.applyBranchUpdate",
      captureReport: taskState.evidence_policy.report !== "omit",
    });
    taskState.phase = "branch-update-clicked";
    taskState.final_task_url = result.taskUrl;
    taskState.final_report = result.report;
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
}

async function finishUpdateAfterRemoteChange() {
  requireTaskState("update");
  if (taskState.phase !== "branch-update-clicked") return;

  const changed = await waitForPrHeadChange({
    repository: taskState.repository,
    prNumber: taskState.pull_request,
    previousSha: taskState.initial_head_sha,
  });
  const stored = await chrome.storage.local.get("parentTaskId");
  const result = { taskUrl: taskState.final_task_url, report: taskState.final_report };

  await publish("/handoff/update", {
    storage: taskState.storage,
    publication: taskState.publication,
    task: {
      ...buildTask({ repository: taskState.repository, prNumber: taskState.pull_request, result }),
      parent_task_id: stored.parentTaskId ?? null,
    },
    update: buildDescription(),
  });

  const prNumber = taskState.pull_request;
  await completeTask(prNumber);
  setStatus(`Branch update recorded on PR #${prNumber} at ${changed.head_sha.slice(0, 12)}.`);
}

async function waitForPrHeadChange({ repository, prNumber, previousSha }) {
  if (!previousSha) throw new Error("pre-update PR head snapshot is missing");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const snapshot = await publish("/pr/snapshot", { target_repository: repository, pull_request: prNumber });
    if (snapshot.head_sha && snapshot.head_sha !== previousSha) return snapshot;
    await sleep(2000);
  }
  throw new Error("timed out waiting for the GitHub PR head to change after Update branch");
}

async function completeTask(prNumber) {
  const completedTaskId = taskState.task_id;
  taskState = null;
  await chrome.storage.local.set({ parentTaskId: completedTaskId });
  await chrome.storage.local.remove("taskState");
  if (prNumber) $("pull-request").value = String(prNumber);
  $("prompt").value = "";
  await persist();
}

function buildTask({ repository, prNumber, result }) {
  const issueText = $("issue").value.trim();
  const record = {
    task_id: taskState.task_id,
    created_at: taskState.created_at,
    completed_at: new Date().toISOString(),
    target_repository: repository,
    pull_request: prNumber,
    issue: issueText ? Number(issueText) : null,
    agent_task_url: result.taskUrl,
    evidence_policy: taskState.evidence_policy,
  };
  if (taskState.evidence_policy.prompt !== "omit") record.prompt = taskState.prompt;
  if (taskState.evidence_policy.report !== "omit") record.report = result.report;
  return record;
}

function buildDescription() {
  return {
    summary: $("summary").value.trim() || "Completed the delegated task.",
    validation: $("validation").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
}

function readEvidencePolicy() {
  const prompt = $("prompt-evidence").value;
  const report = $("report-evidence").value;
  const allowed = new Set(["full", "hash", "omit"]);
  if (!allowed.has(prompt) || !allowed.has(report)) throw new Error("invalid evidence policy");
  return { prompt, report };
}

function readRecoveryPolicy() {
  return {
    prompt: normalizePromptRecoveryMode($("prompt-recovery").value),
    report: normalizeReportRecoveryMode($("report-recovery").value),
  };
}

function readPublicationPolicy() {
  const presentation = $("committed-file-publication").value;
  return normalizeBrowserPublicationPolicy({
    change_description: $("change-description-publication").value,
    change_comment: $("change-comment-publication").value,
    committed_file: presentation === "none" ? null : {
      presentation,
      adapter: "github",
      repository: $("committed-file-repository").value.trim(),
      branch: $("committed-file-branch").value.trim(),
      path_template: $("committed-file-path-template").value.trim(),
    },
  });
}

function updateCommittedFileControls() {
  const disabled = $("committed-file-publication").value === "none";
  for (const id of ["committed-file-repository", "committed-file-branch", "committed-file-path-template"]) $(id).disabled = disabled;
}

function requireServiceUrl() {
  return normalizeServiceUrl($("service-url").value);
}

function requireStorage() {
  const repository = $("storage-repository").value.trim();
  const branch = $("storage-branch").value.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error("task-record repository must be configured as owner/repo");
  if (!branch) throw new Error("task-record branch is required");
  if (repository === "seedbed-ai/crossdock") throw new Error("the public Crossdock source repository cannot be used as the implicit task-record store");
  return { repository, branch };
}

async function publish(path, body, explicitServiceUrl = null) {
  return postServiceJson({
    path,
    body,
    taskState: explicitServiceUrl ? null : taskState,
    preference: explicitServiceUrl ?? $("service-url").value,
  });
}

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error ?? "extension action failed");
  return response.result;
}

function requireRepository() {
  const repository = $("repository").value.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error("target repository must be owner/repo");
  return repository;
}

function parseOptionalPrNumber() {
  const value = $("pull-request").value.trim();
  if (!value) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error("existing PR must be a positive integer");
  return number;
}

function parsePrNumber(url, repository) {
  const escaped = repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = url.match(new RegExp(`github\\.com/${escaped}/pull/(\\d+)`));
  if (!match) throw new Error("coding agent did not expose a PR URL for the target repository");
  return Number(match[1]);
}

function requireTaskState(mode) {
  if (!taskState?.task_id) throw new Error("no submitted task is active");
  assertPromptAvailableForRecovery(taskState);
  assertReportAvailableForRecovery(taskState);
  if (mode && taskState.mode !== mode) throw new Error(`active task is ${taskState.mode}, not ${mode}`);
}

function requireReady(mode) {
  requireTaskState(mode);
  if (taskState.phase !== "ready") throw new Error("task is not ready for handoff yet");
}

function run(fn) {
  return async () => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  };
}

function setBusy(value) {
  for (const button of document.querySelectorAll("button")) button.disabled = value;
}

function setStatus(message, error = false) {
  $("status").textContent = message;
  $("status").dataset.error = error ? "true" : "false";
}

async function saveTaskState() {
  await chrome.storage.local.set({ taskState: taskStateForLocalPersistence(taskState) });
}

async function persist() {
  const values = Object.fromEntries(fields.map((id) => [id, $(id).value]));
  const recoveryMode = normalizePromptRecoveryMode(values["prompt-recovery"] || DEFAULT_PROMPT_RECOVERY_MODE);
  if (recoveryMode === "memory") delete values.prompt;
  await chrome.storage.local.set({ dashboard: values });
}

async function restore() {
  const stored = await chrome.storage.local.get(["dashboard", "taskState"]);
  for (const [id, value] of Object.entries(stored.dashboard ?? {})) {
    if ($(id)) $(id).value = value;
  }
  if (!$("service-url").value.trim()) $("service-url").value = DEFAULT_SERVICE_URL;
  if (!$("prompt-recovery").value) $("prompt-recovery").value = DEFAULT_PROMPT_RECOVERY_MODE;
  if (!$("report-recovery").value) $("report-recovery").value = DEFAULT_REPORT_RECOVERY_MODE;
  if (!$("change-description-publication").value) $("change-description-publication").value = DEFAULT_PUBLICATION_POLICY.change_description;
  if (!$("change-comment-publication").value) $("change-comment-publication").value = DEFAULT_PUBLICATION_POLICY.change_comment;
  if (!$("committed-file-publication").value) $("committed-file-publication").value = "none";
  updateCommittedFileControls();

  const serviceMigration = migrateActiveTaskServiceUrl(stored.taskState ?? null);
  const publicationMigration = migrateActiveTaskPublication(serviceMigration.taskState);
  const recoveryMigration = migrateActiveTaskRecovery(publicationMigration.taskState);
  let intentMigration;
  try {
    intentMigration = migrateActiveTaskIntent(recoveryMigration.taskState);
  } catch (error) {
    taskState = recoveryMigration.taskState;
    setStatus(`Cannot recover active task: ${error.message}`, true);
    return;
  }
  taskState = intentMigration.taskState;
  if (!taskState) return;
  if (serviceMigration.changed || publicationMigration.changed || recoveryMigration.changed || intentMigration.changed) await saveTaskState();

  try {
    assertPromptAvailableForRecovery(taskState);
    assertReportAvailableForRecovery(taskState);
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  setStatus(`Recovered active ${taskState.mode} task in phase ${taskState.phase}.`);
  if (taskState.phase !== "ready" || taskState.handoff_mode === "automatic") void monitorTask();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
