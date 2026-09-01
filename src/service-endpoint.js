export const DEFAULT_SERVICE_URL = "http://127.0.0.1:3210";

/**
 * Normalize the browser-facing Crossdock service endpoint.
 *
 * The accepted grammar is intentionally narrower than a generic URL:
 * `http://127.0.0.1:<port>` with an optional trailing slash. Validating the
 * raw form also preserves an explicitly written default HTTP port such as 80,
 * which the WHATWG URL parser otherwise canonicalizes away.
 */
export function normalizeServiceUrl(value, label = "service_url") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  const raw = value.trim();
  const match = raw.match(/^http:\/\/127\.0\.0\.1:(\d+)\/?$/);
  if (!match) {
    throw new Error(`${label} must be an HTTP 127.0.0.1 loopback origin with an explicit port and no credentials, path, query, or fragment`);
  }
  const port = parseServicePort(match[1], `${label} port`);
  return `http://127.0.0.1:${port}`;
}

/** Parse a loopback service port from environment/configuration input. */
export function parseServicePort(value, label = "PORT") {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be an integer between 1 and 65535`);
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} must be an integer between 1 and 65535`);
  return port;
}
