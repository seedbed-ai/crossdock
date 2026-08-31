import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHandoffServer } from "../src/http-server.js";

function githubMock() { return { async getPullRequest() { throw new Error("not expected"); } }; }

async function withServer(fn, options = {}) {
  const server = createHandoffServer({ github: githubMock(), ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await fn(server.address().port); } finally { await new Promise((resolve) => server.close(resolve)); }
}

function request(port, { method = "GET", path = "/health", origin, contentType, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (contentType) headers["Content-Type"] = contentType;
    const req = http.request({ hostname: "127.0.0.1", port, method, path, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "null") }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

test("health permits non-browser local clients", async () => {
  await withServer(async (port) => {
    const result = await request(port);
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
  });
});

test("browser requests reject arbitrary web origins", async () => {
  await withServer(async (port) => {
    const result = await request(port, { origin: "https://example.com" });
    assert.equal(result.status, 403);
  });
});

test("extension origin receives scoped CORS response", async () => {
  await withServer(async (port) => {
    const origin = "chrome-extension://abcdefghijklmnop";
    const result = await request(port, { origin });
    assert.equal(result.status, 200);
    assert.equal(result.headers["access-control-allow-origin"], origin);
  });
});

test("POST requires JSON content type", async () => {
  await withServer(async (port) => {
    const result = await request(port, { method: "POST", path: "/pr/snapshot", origin: "chrome-extension://abcdefghijklmnop", contentType: "text/plain", body: "{}" });
    assert.equal(result.status, 415);
  });
});

test("request bodies are bounded", async () => {
  await withServer(async (port) => {
    const result = await request(port, { method: "POST", path: "/pr/snapshot", origin: "chrome-extension://abcdefghijklmnop", contentType: "application/json", body: JSON.stringify({ text: "x".repeat(100) }) });
    assert.equal(result.status, 413);
  }, { maxBodyBytes: 20 });
});
