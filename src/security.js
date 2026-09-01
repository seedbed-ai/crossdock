const FORBIDDEN_GITHUB_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*[^\s]{8,}/i,
];

/**
 * Rejects common secret-like plaintext before it crosses a GitHub boundary.
 *
 * This is deliberately a narrow fail-closed preflight, not a claim that
 * Crossdock can recognize every possible secret or sensitive-data format.
 */
export function assertGithubSafe(value, label = "content") {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  const canonical = value.replace(/\r\n?/g, "\n");
  for (const pattern of FORBIDDEN_GITHUB_PATTERNS) {
    if (pattern.test(canonical)) {
      throw new Error(`${label} appears to contain Forbidden-from-GitHub material`);
    }
  }
  return value;
}