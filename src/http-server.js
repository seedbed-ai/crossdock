import { createServer } from "node:http";
import { dispatchHandoff } from "./service.js";

export function createHandoffServer({ github, maxBodyBytes = 4 * 1024 * 1024 }) {
  return createServer(async (request, response) => {
    try {
      assertAllowedOrigin(request, response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "POST" && !String(request.headers["content-type"] ?? "").startsWith("application/json")) {
        sendJson(response, 415, { error: "application_json_required" });
        return;
      }
      const body = await readJson(request, maxBodyBytes);
      const result = await dispatchHandoff({ method: request.method, path: new URL(request.url, "http://127.0.0.1").pathname, body, github });
      sendJson(response, result.status, result.body);
    } catch (error) {
      const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 500;
      sendJson(response, status, { error: "handoff_failed", message: error.message, github: error.payload ?? undefined });
    }
  });
}

export function assertAllowedOrigin(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!origin.startsWith("chrome-extension://")) {
    const error = new Error("browser origin is not authorized for the local Crossdock service");
    error.status = 403;
    throw error;
  }
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

async function readJson(request, maxBodyBytes) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error(`request body exceeds ${maxBodyBytes} byte limit`);
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
