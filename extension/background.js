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
      return sendToTab(tab.id, { type: "crossdock.capturePrompt" });
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
      const beforeTabs = new Set(await matchingPrTabUrls(message.targetRepository));
      const beforePage = new Set((await sendToTab(tab.id, { type: "crossdock.findPrUrls", targetRepository: message.targetRepository })).prUrls);
      const prepared = await sendToTab(tab.id, { type: "crossdock.prepareCreatePr" });
      const prUrl = await waitForPrUrl({ tabId: tab.id, targetRepository: message.targetRepository, beforeTabs, beforePage });
      return { ...prepared, prUrl };
    }
    case "crossdock.applyBranchUpdate": {
      const tab = await findChatGptTab(true);
      return sendToTab(tab.id, { type: "crossdock.prepareBranchUpdate" });
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

async function waitForPrUrl({ tabId, targetRepository, beforeTabs, beforePage }) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const tabUrls = await matchingPrTabUrls(targetRepository);
    const newTabUrl = tabUrls.find((url) => !beforeTabs.has(url));
    if (newTabUrl) return newTabUrl;
    try {
      const current = await sendToTab(tabId, { type: "crossdock.findPrUrls", targetRepository });
      const newPageUrl = current.prUrls.find((url) => !beforePage.has(url));
      if (newPageUrl) return newPageUrl;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("timed out waiting for coding-agent-created PR URL");
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
