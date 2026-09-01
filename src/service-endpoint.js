export const DEFAULT_SERVICE_URL = "http://127.0.0.1:3210";

/**
 * Normalize the browser-facing Crossdock service endpoint.
 *
 * The browser adapter is intentionally restricted to plain HTTP on the
 * numeric loopback host. Allowing arbitrary hosts would turn a convenience
 * setting into an exfiltration/SSRF boundary and would also exceed the
 * extension's declared host permissions.
 */
export function normalizeServiceUrl(value, label = "service_url") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  if (url.protocol !== "http:") throw new Error(`${label} must use http`);
  if (url.hostname !== "127.0.0.1") throw new Error(`${label} must use the 127.0.0.1 loopback host`);
  if (!url.port) throw new Error(`${label} must include an explicit port`);
  const port = parseServicePort(url.port, `${label} port`);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must not include credentials, query parameters, or fragments`);
  }
  if (url.pathname !== "/") throw new Error(`${label} must not include a path`);

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
