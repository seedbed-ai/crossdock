import { extractCrossdockHandoff } from "./chat-agent-handoff.js";

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
      const tab = await ensureCodexTab();
      const result = await sendToTab(tab.id, { type: "crossdock.submitCodex", prompt: message.prompt });
      await chrome.tabs.update(tab.id, { active: true });
      return result;
    }
    case "crossdock.inspectCodex": {
      const tab = await findChatGptTab(true);
      return sendToTab(tab.id, { type: "crossdock.inspectCodex" });
    }
    case "crossdock.createPrAndInspect": {
      const tab = await findChatGptTab(true);
      const beforeTabs = (await matchingPrTabUrls(message.targetRepository)).map((url) => canonicalPrUrl(url, message.targetRepository));
      const beforePage = (await sendToTab(tab.id, { type: "crossdock.findPrUrls", targetRepository: message.targetRepository })).prUrls
        .map((url) => canonicalPrUrl(url, message.targetRepository));
      const discovery = { beforeTabs, beforePage };
      const prepared = await sendToTab(tab.id, { type: "crossdock.prepareCreatePr", captureReport: message.captureReport !== false });
      let prUrl = null;
      let discoveryError = null;
      try {
        prUrl = await waitForPrUrl({ tabId: tab.id, targetRepository: message.targetRepository, discovery });
      } catch (error) {
        discoveryError = error.message;
      }
      return { ...prepared, prUrl, discovery, discoveryError, uncertain: !prUrl };
    }
    case "crossdock.recoverCreatedPr": {
      const tab = await findChatGptTab(true);
      const candidates = await findNewPrUrls({ tabId: tab.id, targetRepository: message.targetRepository, discovery: message.discovery });
      if (candidates.length > 1) throw new Error(`created PR recovery is ambiguous; found ${candidates.length} new target-repository PR URLs`);
      return { prUrl: candidates[0] ?? null };
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
    const candidates = await findNewPrUrls({ tabId, targetRepository, discovery });
    if (candidates.length > 1) throw new Error(`created PR discovery is ambiguous; found ${candidates.length} new target-repository PR URLs`);
    if (candidates.length === 1) return candidates[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function findNewPrUrls({ tabId, targetRepository, discovery }) {
  if (!discovery || !Array.isArray(discovery.beforeTabs) || !Array.isArray(discovery.beforePage)) {
    throw new Error("created PR recovery baseline is missing");
  }
  const beforeTabs = new Set(discovery.beforeTabs.map((url) => canonicalPrUrl(url, targetRepository)));
  const beforePage = new Set(discovery.beforePage.map((url) => canonicalPrUrl(url, targetRepository)));
  const candidates = new Set(
    (await matchingPrTabUrls(targetRepository))
      .map((url) => canonicalPrUrl(url, targetRepository))
      .filter((url) => !beforeTabs.has(url)),
  );
  try {
    const current = await sendToTab(tabId, { type: "crossdock.findPrUrls", targetRepository });
    for (const value of current.prUrls) {
      const url = canonicalPrUrl(value, targetRepository);
      if (!beforePage.has(url)) candidates.add(url);
    }
  } catch {
    // Provider navigation may temporarily make the content script unavailable; GitHub tabs remain valid evidence.
  }
  return [...candidates];
}

function canonicalPrUrl(value, targetRepository) {
  if (typeof value !== "string") throw new Error("PR URL must be a string");
  if (typeof targetRepository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(targetRepository)) throw new Error("target repository must be owner/repo");
  const parsed = new URL(value);
  if (parsed.origin !== "https://github.com") throw new Error("PR URL must use github.com");
  const escaped = targetRepository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = parsed.pathname.match(new RegExp(`^/${escaped}/pull/(\\d+)/?$`));
  if (!match) throw new Error("PR URL does not identify the target repository");
  return `https://github.com/${targetRepository}/pull/${match[1]}`;
}

async function matchingPrTabUrls(targetRepository) {
  const prefix = `https://github.com/${targetRepository}/pull/`;
  return (await chrome.tabs.query({ url: "https://github.com/*/*/pull/*" })).map((tab) => tab.url).filter((url) => url?.startsWith(prefix));
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
