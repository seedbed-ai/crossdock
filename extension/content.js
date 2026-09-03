chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case "crossdock.capturePrompt": return { assistantResponse: captureLatestAssistantResponse(), url: location.href };
    case "crossdock.submitCodex": return submitCodexPrompt(message.prompt);
    case "crossdock.inspectCodex": return inspectCodexTask();
    case "crossdock.findPrUrls": return { prUrls: findPullRequestLinks(message.targetRepository) };
    case "crossdock.prepareCreatePr": return prepareCreatePr(message.captureReport !== false);
    case "crossdock.prepareBranchUpdate": return prepareBranchUpdate(message.captureReport !== false);
    default: throw new Error(`unsupported content message: ${message.type}`);
  }
}

function captureLatestAssistantResponse() {
  const nodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')]
    .filter(isVisible).map((node) => normalizeText(node.innerText)).filter(Boolean);
  if (!nodes.length) throw new Error("no visible ChatGPT assistant message found");
  return nodes.at(-1);
}

function submitCodexPrompt(prompt) {
  requireCodexPage();
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Codex prompt is empty");
  const input = findUniqueVisible(["textarea", '[contenteditable="true"][role="textbox"]', '[contenteditable="true"][data-placeholder]'], "Codex prompt input");
  setEditableValue(input, prompt);
  findUniqueButton(["Create task", "Start task", "Run task", "Submit"]).click();
  return { taskUrl: location.href };
}

function inspectCodexTask() {
  requireCodexPage();
  return { taskUrl: location.href, createPrAvailable: Boolean(findButton(["Create PR"], false)), updateBranchAvailable: Boolean(findButton(["Update branch"], false)) };
}

function prepareCreatePr(captureReport = true) {
  requireCodexPage();
  const result = { taskUrl: location.href };
  if (captureReport) result.report = captureCodexReport();
  findButton(["Create PR"], true).click();
  return result;
}

function prepareBranchUpdate(captureReport = true) {
  requireCodexPage();
  const result = { taskUrl: location.href };
  if (captureReport) result.report = captureCodexReport();
  findButton(["Update branch"], true).click();
  return result;
}

function captureCodexReport() {
  const selectors = ['[data-testid="codex-task-report"]', '[data-testid*="final-report"]', '[data-testid*="task-report"]', '[data-message-author-role="assistant"]'];
  const candidates = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter(isVisible).map((node) => normalizeText(node.innerText)).filter(Boolean);
  if (!candidates.length) throw new Error("unable to identify the complete Codex report from known semantic selectors");
  return candidates.at(-1);
}

function findPullRequestLinks(targetRepository) {
  const prefix = targetRepository ? `https://github.com/${targetRepository}/pull/` : "https://github.com/";
  return [...document.querySelectorAll('a[href*="github.com/"]')].filter(isVisible).map((anchor) => anchor.href)
    .filter((href) => href.startsWith(prefix) && /\/pull\/\d+(?:$|[?#])/.test(href));
}

function findUniqueVisible(selectors, label) {
  const nodes = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))].filter(isVisible);
  if (nodes.length !== 1) throw new Error(`${label} must resolve to exactly one visible element; found ${nodes.length}`);
  return nodes[0];
}

function findUniqueButton(labels) {
  const button = findButton(labels, false);
  if (!button) throw new Error(`no unique visible button found for: ${labels.join(", ")}`);
  return button;
}

function findButton(labels, required) {
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(isVisible).filter((node) => normalizedLabels.has(accessibleText(node).toLowerCase()));
  if (buttons.length > 1) throw new Error(`button selector is ambiguous for: ${labels.join(", ")}`);
  if (required && buttons.length !== 1) throw new Error(`required button not found: ${labels.join(", ")}`);
  return buttons[0] ?? null;
}

function setEditableValue(node, value) {
  node.focus();
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value");
    if (!descriptor?.set) throw new Error("Codex prompt input value setter is unavailable");
    descriptor.set.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    if (node.value !== value) throw new Error("Codex prompt input did not retain the submitted prompt");
    return;
  }
  if (node.isContentEditable) {
    node.textContent = value;
    node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    if (node.textContent !== value) throw new Error("Codex prompt input did not retain the submitted prompt");
    return;
  }
  throw new Error("unsupported Codex prompt input element");
}

function accessibleText(node) { return normalizeText(node.getAttribute("aria-label") || node.innerText || node.textContent || ""); }
function normalizeText(value) { return String(value ?? "").replace(/\r\n?/g, "\n").trim(); }
function isVisible(node) { const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0; }
function requireCodexPage() { if (!location.pathname.startsWith("/codex")) throw new Error("active ChatGPT tab is not a Codex page"); }
