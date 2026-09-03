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

async function submitCodexPrompt(prompt) {
  requireCodexPage();
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Codex prompt is empty");

  const input = findCodexPromptInput(true);
  setEditableValue(input, prompt);

  const beforeUrl = location.href;
  findCodexSubmitButton(true).click();

  const taskUrl = await waitForCodexSubmission({ beforeUrl, prompt });
  return { taskUrl };
}

async function waitForCodexSubmission({ beforeUrl, prompt }) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (location.href !== beforeUrl) return location.href;

    const currentInput = findCodexPromptInput(false);
    const currentValue = currentInput ? editableValue(currentInput) : "";
    const composerNoLongerContainsPrompt = !currentInput || currentValue !== prompt;
    const submitStillAvailable = Boolean(findCodexSubmitButton(false));

    // Codex may transition in place before assigning a task URL. Require both
    // the submitted prompt to leave the composer and the submit/start control
    // to disappear before claiming that submission succeeded.
    if (composerNoLongerContainsPrompt && !submitStillAvailable) return location.href;

    await sleep(100);
  }

  throw new Error("Codex task submission was not confirmed; the task may still be waiting in the composer");
}

function findCodexPromptInput(required = true) {
  const selectors = ["textarea", '[contenteditable="true"][role="textbox"]', '[contenteditable="true"][data-placeholder]'];
  const nodes = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))].filter(isVisible);
  if (nodes.length > 1) throw new Error(`Codex prompt input must resolve to at most one visible element; found ${nodes.length}`);
  if (required && nodes.length !== 1) throw new Error(`Codex prompt input must resolve to exactly one visible element; found ${nodes.length}`);
  return nodes[0] ?? null;
}

function findCodexSubmitButton(required = true) {
  const semanticSelectors = [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    '[role="button"][data-testid="send-button"]',
    '[role="button"][data-testid="composer-submit-button"]',
  ];
  const semantic = [...new Set(semanticSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
    .filter(isVisible)
    .filter(isEnabled);

  if (semantic.length > 1) throw new Error(`Codex submit control is ambiguous; found ${semantic.length} semantic candidates`);
  if (semantic.length === 1) return semantic[0];

  const labels = ["Create task", "Start task", "Run task", "Submit", "Send"];
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(isVisible)
    .filter(isEnabled)
    .filter((node) => normalizedLabels.has(accessibleText(node).toLowerCase()));

  if (buttons.length > 1) throw new Error(`Codex submit control is ambiguous; found ${buttons.length} label candidates`);
  if (required && buttons.length !== 1) throw new Error(`required Codex submit control not found; expected one of: ${labels.join(", ")}`);
  return buttons[0] ?? null;
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
  const semanticCandidates = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
    .filter(isVisible)
    .map((node) => normalizeText(node.innerText))
    .filter(Boolean);
  if (semanticCandidates.length) return semanticCandidates.at(-1);

  const structuredCandidates = findHeadingAnchoredCodexReports();
  if (structuredCandidates.length !== 1) {
    throw new Error(`unable to identify the complete Codex report from known semantic structure; found ${structuredCandidates.length} candidates`);
  }
  return structuredCandidates[0];
}

function findHeadingAnchoredCodexReports() {
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')]
    .filter(isVisible)
    .filter((node) => normalizeText(node.innerText || node.textContent) === "Summary");

  const reports = [];
  for (const summary of headings) {
    const report = reportTextFromSummaryHeading(summary);
    if (report) reports.push(report);
  }
  return [...new Set(reports)];
}

function reportTextFromSummaryHeading(summary) {
  let node = summary;
  for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
    if (!isVisible(node)) continue;
    const text = normalizeText(node.innerText);
    if (!text) continue;

    const sliced = sliceCodexReportText(text);
    if (sliced) return sliced;
  }
  return null;
}

function sliceCodexReportText(text) {
  const lines = normalizeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const summaryIndex = lines.findIndex((line) => line === "Summary");
  if (summaryIndex < 0) return null;

  const testingIndex = lines.findIndex((line, index) => index > summaryIndex && line === "Testing");
  if (testingIndex < 0) return null;

  // The current Codex task UI renders the completion report as a structured
  // Summary/Testing block without the old report-specific data-testid. Anchor
  // on those visible semantic headings and take the smallest ancestor that
  // contains both, then discard any prompt/task chrome that precedes Summary.
  const reportLines = lines.slice(summaryIndex);
  if (reportLines.length < 4) return null;
  return reportLines.join("\n");
}

function findPullRequestLinks(targetRepository) {
  const prefix = targetRepository ? `https://github.com/${targetRepository}/pull/` : "https://github.com/";
  return [...document.querySelectorAll('a[href*="github.com/"]')].filter(isVisible).map((anchor) => anchor.href)
    .filter((href) => href.startsWith(prefix) && /\/pull\/\d+(?:$|[?#])/.test(href));
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

function editableValue(node) {
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) return node.value;
  if (node.isContentEditable) return node.textContent ?? "";
  return "";
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
function isEnabled(node) { return !node.disabled && node.getAttribute("aria-disabled") !== "true"; }
function requireCodexPage() { if (!location.pathname.startsWith("/codex")) throw new Error("active ChatGPT tab is not a Codex page"); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
