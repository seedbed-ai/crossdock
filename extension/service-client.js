export const DEFAULT_SERVICE_URL = "http://127.0.0.1:3210";

export function normalizeServiceUrl(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Crossdock service URL is required");
  const match = value.trim().match(/^http:\/\/127\.0\.0\.1:(\d+)\/?$/);
  if (!match) throw new Error("Crossdock service URL must be an HTTP 127.0.0.1 loopback origin with an explicit port");
  const port = Number(match[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Crossdock service URL port must be between 1 and 65535");
  return `http://127.0.0.1:${port}`;
}

/**
 * Freeze the historical/default endpoint into active task state once.
 *
 * A recovered task must never inherit a newly edited dashboard preference,
 * because that could redirect private task data and retry state mid-handoff.
 */
export function migrateActiveTaskServiceUrl(taskState) {
  if (!taskState || typeof taskState !== "object") return { taskState, changed: false };
  if (taskState.service_url) {
    return { taskState: { ...taskState, service_url: normalizeServiceUrl(taskState.service_url) }, changed: false };
  }
  return { taskState: { ...taskState, service_url: DEFAULT_SERVICE_URL }, changed: true };
}

export function resolveServiceUrl({ taskState, preference }) {
  if (taskState?.service_url) return normalizeServiceUrl(taskState.service_url);
  return normalizeServiceUrl(preference);
}

export async function postServiceJson({ path, body, taskState = null, preference, fetchImpl = globalThis.fetch }) {
  if (typeof path !== "string" || !path.startsWith("/")) throw new Error("service path must start with /");
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  const serviceUrl = resolveServiceUrl({ taskState, preference });
  const response = await fetchImpl(`${serviceUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? payload.error ?? `handoff failed: ${response.status}`);
  return payload;
}
