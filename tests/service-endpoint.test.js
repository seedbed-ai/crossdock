import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SERVICE_URL, normalizeServiceUrl, parseServicePort } from "../src/service-endpoint.js";

test("default service URL is explicit loopback with port", () => {
  assert.equal(DEFAULT_SERVICE_URL, "http://127.0.0.1:3210");
});

test("service URL normalization accepts only explicit HTTP loopback origins", () => {
  assert.equal(normalizeServiceUrl("http://127.0.0.1:3210"), "http://127.0.0.1:3210");
  assert.equal(normalizeServiceUrl("http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
});

test("service URL rejects non-loopback, non-http, implicit-port, and decorated endpoints", () => {
  for (const value of [
    "https://127.0.0.1:3210",
    "http://localhost:3210",
    "http://0.0.0.0:3210",
    "http://127.0.0.1",
    "http://127.0.0.1:3210/path",
    "http://127.0.0.1:3210/?x=1",
    "http://user:pass@127.0.0.1:3210",
  ]) {
    assert.throws(() => normalizeServiceUrl(value));
  }
});

test("service port parser accepts the full valid TCP port range", () => {
  assert.equal(parseServicePort("1"), 1);
  assert.equal(parseServicePort(3210), 3210);
  assert.equal(parseServicePort("65535"), 65535);
});

test("service port parser rejects ambiguous or invalid values", () => {
  for (const value of ["", "0", "65536", "3210.5", " 12x ", -1, null]) {
    assert.throws(() => parseServicePort(value), /integer between 1 and 65535/);
  }
});
