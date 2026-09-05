import { extractCrossdockHandoff } from "./chat-agent-handoff.js";
import { canonicalGitHubPrUrl, classifyNewPrUrls, repositoryFromGitHubPrUrl } from "./pr-discovery.js";
import { postServiceJson } from "./service-client.js";

const CHATGPT_URL = "https://chatgpt.com/";
const CODEX_URL = "https://chatgpt.com/codex/cloud";
const DASHBOARD_URL = chrome.runtime.getURL("dashboard.html");

chrome.action.onClicked.addListener(() => void openDashboard());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case "crossdock.capturePrompt": {
      const tab = await findChatGptTab(false);
      const captured = await sendToTab(tab.id, { type: "crossdock.capturePrompt" });
      const handoff = extractCrossdockHandoff(captured.assistantResponse);
      return { ...handoff, url: captured.url };
    }
    case "crossdock.submitCodex": {
      const stored = await chrome.storage.local.get("dashboard");
      const targetRepository = stored.dashboard?.repository?.trim();
      if (typeof targetRepository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(targetRepository)) {
        throw new Error("target repository must be configured as owner/repo before Codex submission");
      }
      const serviceUrl = stored.dashboard?.["service-url"];
      const targetBranch = await resolveSubmissionBranch({
        targetRepository,
        pullRequest: stored.dashboard?.["pull-request"],
        serviceUrl,
      });
      const tab = await ensureCodexComposerTab();
      // Codex repository/environment transitions are provider UI work. Keep the
      // provider tab foregrounded before driving those controls so browser
      // background-tab scheduling does not delay or starve React state updates.
      await chrome.tabs.update(tab.id, { active: true });
      const result = await sendToTab(tab.id, {
        type: "crossdock.submitCodex",
        prompt: message.prompt,
        targetRepository,
        targetBranch,
      });
      return { ...result, providerContext: { repository: targetRepository, base_branch: targetBranch } };
    }
    case "crossdock.inspectCodex": {
      const tab = await findChatGptTab(true);
      return sendToTab(tab.id, { type: "crossdock.inspectCodex" });
    }
    case "crossdock.createPrAndInspect": {
      const tab = await findChatGptTab(true);
      const discovery = { beforePrUrls: await snapshotPrEvidence(tab.id) };
      const prepared = await sendToTab(tab.id, { type: "crossdock.prepareCreatePr", captureReport: message.captureReport !== false });
      let prUrl = null;
      let discoveryError = null;
      let integrityError = null;
      try {
        prUrl = await waitForPrUrl({ tabId: tab.id, targetRepository: message.targetRepository, discovery });
      } catch (error) {
        if (error.integrityFailure) integrityError = error.message;
        else discoveryError = error.message;
      }
      return { ...prepared, prUrl, discovery, discoveryError, integrityError, uncertain: !prUrl && !integrityError };
    }
    case "crossdock.recoverCreatedPr": {
      const tab = await findChatGptTab(true);
      const evidence = await findNewPrEvidence({ tabId: tab.id, targetRepository: message.targetRepository, discovery: message.discovery });
      if (evidence.wrongRepository.length) return { prUrl: null, integrityError: wrongRepositoryPrMessage(message.targetRepository, evidence.wrongRepository) };
      if (evidence.target.length > 1) throw new Error(`created PR recovery is ambiguous; found ${evidence.target.length} new target-repository PR URLs`);
      return { prUrl: evidence.target[0] ?? null, integrityError: null };
    }
    case "crossdock.applyBranchUpdate": {
      const tab = await findChatGptTab(true);
      return sendToTab(tab.id, { type: "crossdock.prepareBranchUpdate", captureReport: message.captureReport !== false });
    }
    case "crossdock.openChatGPT": return activateOrCreate(CHATGPT_URL, false);
    case "crossdock.openCodex": return activateOrCreate(CODEX_URL, true);
    case "crossdock.openGitHub":
      if (!message.url?.startsWith("https://github.com/")) throw new Error("invalid GitHub URL");
      return activateOrCreate(message.url, null);
    default: throw new Error(`unsupported background message: ${message.type}`);
  }
}

async function resolveSubmissionBranch({ targetRepository, pullRequest, serviceUrl }) {
  const rawPullRequest = typeof pullRequest === "string" ? pullRequest.trim() : "";
  if (rawPullRequest) {
    if (!/^\d+$/.test(rawPullRequest) || Number(rawPullRequest) <= 0) throw new Error("existing pull request must be a positive integer");
    const snapshot = await postServiceJson({
      path: "/pr/snapshot",
      body: { target_repository: targetRepository, pull_request: Number(rawPullRequest) },
      preference: serviceUrl,
    });
    if (snapshot.repository !== targetRepository || typeof snapshot.working_branch !== "string" || !snapshot.working_branch.trim()) {
      throw new Error("existing pull request snapshot did not return the configured repository and working branch");
    }
    return snapshot.working_branch.trim();
  }

  const snapshot = await postServiceJson({
    path: "/repository/snapshot",
    body: { target_repository: targetRepository },
    preference: serviceUrl,
  });
  if (snapshot.repository !== targetRepository || typeof snapshot.default_branch !== "string" || !snapshot.default_branch.trim()) {
    throw new Error("target repository snapshot did not return the configured repository and default branch");
  }
  return snapshot.default_branch.trim();
}

async function openDashboard() {
  const dashboards = (await chrome.tabs.query({})).filter((tab) => tab.url === DASHBOARD_URL);
  if (dashboards.length > 1) throw new Error(`dashboard tab is ambiguous; found ${dashboards.length}`);
  if (dashboards.length === 1) return chrome.tabs.update(dashboards[0].id, { active: true });
  return chrome.tabs.create({ url: DASHBOARD_URL, active: true });
}

async function findChatGptTab(codex) {
  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  const filtered = tabs.filter((tab) => new URL(tab.url).pathname.startsWith("/codex") === codex);
  if (filtered.length !== 1) throw new Error(`${codex ? "Codex" : "ChatGPT"} tab must resolve to exactly one open tab; found ${filtered.length}`);
  return filtered[0];
}

async function ensureCodexTab() {
  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/codex/*" });
  if (tabs.length > 1) throw new Error(`Codex tab is ambiguous; found ${tabs.length}`);
  if (tabs.length === 1) return tabs[0];
  const tab = await chrome.tabs.create({ url: CODEX_URL, active: true });
  await waitForTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

async function ensureCodexComposerTab() {
  const tab = await ensureCodexTab();
  const current = new URL(tab.url);
  if (current.origin === new URL(CODEX_URL).origin && current.pathname === new URL(CODEX_URL).pathname) return tab;
  await chrome.tabs.update(tab.id, { url: CODEX_URL, active: true });
  await waitForTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

async function activateOrCreate(url, codex) {
  if (codex === true) {
    const tab = await ensureCodexTab();
    return chrome.tabs.update(tab.id, { active: true });
  }
  if (codex === false) {
    const ordinary = (await chrome.tabs.query({ url: "https://chatgpt.com/*" })).filter((tab) => !new URL(tab.url).pathname.startsWith("/codex"));
    if (ordinary.length > 1) throw new Error(`ChatGPT tab is ambiguous; found ${ordinary.length}`);
    if (ordinary.length === 1) return chrome.tabs.update(ordinary[0].id, { active: true });
  }
  return chrome.tabs.create({ url, active: true });
}

async function waitForPrUrl({ tabId, targetRepository, discovery }) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const evidence = await findNewPrEvidence({ tabId, targetRepository, discovery });
    if (evidence.wrongRepository.length) {
      const error = new Error(wrongRepositoryPrMessage(targetRepository, evidence.wrongRepository));
      error.integrityFailure = true;
      throw error;
    }
    if (evidence.target.length > 1) throw new Error(`created PR discovery is ambiguous; found ${evidence.target.length} new target-repository PR URLs`);
    if (evidence.target.length === 1) return evidence.target[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function findNewPrEvidence({ tabId, targetRepository, discovery }) {
  const baseline = discoveryBaseline(discovery, targetRepository);
  let current = await snapshotPrEvidence(tabId);
  if (!baseline.crossRepositorySafe) {
    current = current.filter((url) => repositoryFromGitHubPrUrl(url) === targetRepository);
  }
  return classifyNewPrUrls({ before: baseline.before, current, targetRepository });
}

function discoveryBaseline(discovery, targetRepository) {
  if (discovery && Array.isArray(discovery.beforePrUrls)) {
    return { before: discovery.beforePrUrls, crossRepositorySafe: true };
  }

  // Compatibility for task states written before broad PR evidence capture. The
  // older baseline only knew about target-repository PRs, so it cannot safely
  // prove that a currently visible wrong-repository PR is new. Restrict current
  // evidence to the target repository for these old tasks rather than creating
  // a false integrity failure from unrelated pre-existing PR tabs.
  if (discovery && Array.isArray(discovery.beforeTabs) && Array.isArray(discovery.beforePage)) {
    return {
      before: [...new Set([...discovery.beforeTabs, ...discovery.beforePage].map((url) => canonicalPrUrl(url, targetRepository)))],
      crossRepositorySafe: false,
    };
  }
  throw new Error("created PR recovery baseline is missing");
}

async function snapshotPrEvidence(tabId) {
  const urls = new Set((await allPrTabUrls()).map(canonicalGitHubPrUrl));
  try {
    const current = await sendToTab(tabId, { type: "crossdock.findPrUrls", targetRepository: null });
    for (const value of current.prUrls) urls.add(canonicalGitHubPrUrl(value));
  } catch {
    // Provider navigation may temporarily make the content script unavailable;
    // GitHub tabs remain independent evidence.
  }
  return [...urls];
}

function wrongRepositoryPrMessage(targetRepository, urls) {
  const repositories = [...new Set(urls.map(repositoryFromGitHubPrUrl))];
  return `created PR integrity failure: expected repository ${targetRepository}, but new PR evidence appeared in ${repositories.join(", ")}: ${urls.join(", ")}`;
}

function canonicalPrUrl(value, targetRepository) {
  if (typeof targetRepository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(targetRepository)) throw new Error("target repository must be owner/repo");
  const canonical = canonicalGitHubPrUrl(value);
  if (repositoryFromGitHubPrUrl(canonical) !== targetRepository) throw new Error("PR URL does not identify the target repository");
  return canonical;
}

async function allPrTabUrls() {
  return (await chrome.tabs.query({ url: "https://github.com/*/*/pull/*" })).map((tab) => tab.url).filter(Boolean);
}

async function sendToTab(tabId, message) {
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (!response?.ok) throw new Error(response?.error ?? "content adapter failed");
  return response.result;
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error("timed out waiting for Codex tab to load")); }, 30_000);
    const listener = (updatedId, info) => {
      if (updatedId !== tabId || info.status !== "complete") return;
      clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener); resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
