import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createLessonServer } from "../src/server.js";

describe("local lesson HTTP boundary", { concurrency: false }, () => {
  let server: Server;
  let base: string;
  const previousKey = process.env.OPENAI_API_KEY;
  before(async () => {
    delete process.env.OPENAI_API_KEY;
    server = createLessonServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });
  const post = (path: string, data: unknown, origin = base) => fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(data),
  });

  test("all student pages and local assets are served with the expected types", async () => {
    for (const path of ["/", "/learn.html", "/run.html", "/architecture.html", "/walkthrough.html"]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type") || "", /text\/html/);
      assert.match(await response.text(), /Mastra/);
    }
    assert.equal((await fetch(`${base}/astronaut.png`)).status, 200);
    assert.equal((await fetch(`${base}/client.js`)).status, 200);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/src/agent.ts`)).status, 404);
  });

  test("local document search works without a provider key and reports zero model calls", async () => {
    const response = await post("/api/search", { question: "memory retrieval" });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, "local-search");
    assert.equal(result.modelCalls, 0);
    assert.equal(result.documents[0].id, "context");
  });

  test("configuration never sends a credential to the browser", async () => {
    process.env.OPENAI_API_KEY = "test-only-secret-not-a-real-key";
    try {
      const response = await fetch(`${base}/api/config`);
      const text = await response.text();
      assert.equal(JSON.parse(text).ready, true);
      assert.ok(!text.includes("test-only-secret"));
    } finally { delete process.env.OPENAI_API_KEY; }
  });

  test("a missing key prevents live generation but does not disable local search", async () => {
    const response = await post("/api/query", { question: "What is Mastra?" });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /OPENAI_API_KEY/);
  });

  test("bad input and cross-origin submissions are rejected", async () => {
    assert.equal((await post("/api/search", { question: " " })).status, 400);
    assert.equal((await post("/api/search", { question: "tools", extra: true })).status, 400);
    assert.equal((await post("/api/search", { question: "tools" }, "https://example.com")).status, 403);
    const invalidJson = await fetch(`${base}/api/search`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{invalid",
    });
    assert.equal(invalidJson.status, 400);
  });
});
