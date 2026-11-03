import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { createLessonServer } from "../src/server.js";
import { searchNotes } from "../src/documents.js";

const snippet = `import { Agent } from "@mastra/core/agent";

const agent = new Agent({
  id: "example-agent",
  name: "Example agent",
  model: "openai/gpt-4.1-mini",
  instructions: "Explain concepts clearly.",
});

const result = await agent.generate("What is Mastra?");
console.log(result.text);`;
let responseText = ["## Create an agent", "", "Combine a **model** and instructions, then call `generate()`.", "",
  "```typescript", snippet, "```", "", "- Read the result.", "- Check the evidence. [agent]", "",
  "```ts", "const maximumSteps = 3;", "```"].join("\n");
const server = createLessonServer();
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const docs = new URL("../docs/", import.meta.url);
let browser: Browser | undefined;
try {
  const executablePath = process.env.BROWSER_EXECUTABLE || (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/google-chrome");
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  // A plain script avoids transpiler-generated helpers in the isolated browser realm.
  await context.addInitScript(`Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async text => { window.testCopied = text; } }, configurable: true
  });`);
  await context.route("**/api/config", route => route.fulfill({ json: {
    ready: true, model: "renderer-test-fixture", noteCount: 6, maxSteps: 3,
  } }));
  // Exercise the actual browser event handler without making a paid model call.
  await context.route("**/api/query", route => route.fulfill({
    contentType: "application/x-ndjson",
    body: [
      { type: "started", runId: "markdown-regression", text: "Recorded response fixture." },
      { type: "tool", query: "agent model tools", documents: searchNotes("agent model tools"), text: "Fixture evidence." },
      { type: "answer", text: responseText },
      { type: "result", status: "complete", sourceIds: ["agent"], toolCalls: 1, steps: 2, durationMs: 20, text: "Renderer test fixture." },
    ].map(event => JSON.stringify(event)).join("\n") + "\n",
  }));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/walkthrough.html", { waitUntil: "networkidle" });
  await page.waitForSelector("pre code[data-syntax-highlighted=true]");
  const reference = await page.locator("pre code").first().evaluate(code => ({
    background: getComputedStyle(code.parentElement!).backgroundColor,
    radius: getComputedStyle(code.parentElement!).borderRadius,
    font: getComputedStyle(code).fontSize,
    keyword: getComputedStyle(code.querySelector(".token.keyword")!).color,
  }));
  await page.locator("button[data-copy]").first().click();
  assert.match(await page.evaluate(() => (window as Window & { testCopied?: string }).testCopied!), /export const questionSchema/);
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run tutor agent", exact: true }).click();
  await page.waitForFunction(() => document.getElementById("run-status")?.textContent === "Complete");
  await page.waitForFunction(() => document.querySelectorAll("#answer pre code[data-syntax-highlighted=true]").length === 2);
  assert.equal(await page.locator("#answer h2").innerText(), "Create an agent");
  assert.equal(await page.locator("#answer strong").innerText(), "model");
  assert.equal(await page.locator("#answer ul li").count(), 2);
  assert.equal(await page.locator("#answer code.language-typescript").count(), 2);
  assert.ok(!(await page.locator("#answer").innerText()).includes("```"));
  const rendered = await page.locator("#answer pre code").first().evaluate(code => ({
    background: getComputedStyle(code.parentElement!).backgroundColor,
    radius: getComputedStyle(code.parentElement!).borderRadius,
    font: getComputedStyle(code).fontSize,
    keyword: getComputedStyle(code.querySelector(".token.keyword")!).color,
  }));
  assert.deepEqual(rendered, reference, "AI code must use the explanation page's actual palette and panel style.");
  await page.locator("#answer button[data-copy]").first().click();
  assert.equal((await page.evaluate(() => (window as Window & { testCopied?: string }).testCopied!)).trim(), snippet);
  await mkdir(docs, { recursive: true });
  await page.locator("#answer").screenshot({ path: fileURLToPath(new URL("answer-formatting-preview.png", docs)) });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.locator("#answer pre").first().evaluate(node => getComputedStyle(node).backgroundColor), reference.background);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  for (const code of await page.locator("#answer pre code").all()) {
    assert.ok(await code.evaluate(node => node.scrollWidth <= node.clientWidth + 1), "Long response code must wrap within its panel.");
  }

  responseText = '<script>window.testAttack=1</script><img src="x" onerror="window.testAttack=1"><a href="javascript:window.testAttack=1">Unsafe link</a>\n\n```typescript\nconst safe = "<script>literal text</script>";\n```';
  await page.getByRole("button", { name: "Run tutor agent", exact: true }).click();
  await page.waitForFunction(() => document.getElementById("run-status")?.textContent === "Complete");
  assert.equal(await page.locator("#answer script, #answer img, #answer [onerror], #answer a[href^='javascript:']").count(), 0);
  assert.equal(await page.evaluate(() => (window as Window & { testAttack?: number }).testAttack), undefined);
  assert.match(await page.locator("#answer pre code").innerText(), /<script>literal text<\/script>/);
  assert.deepEqual(errors, []);
  const report = { status: "pass", checkedAt: new Date().toISOString(), responseSource: "Controlled Markdown response fixture; no model call",
    checks: ["Markdown headings, emphasis and lists render", "Fenced TypeScript and ts aliases are highlighted",
      "Code panel, font and keyword colors match explanation snippets", "Static and dynamic copy controls work",
      "Dark theme and mobile layout work", "Unsafe HTML and JavaScript URLs are removed", "Code literals remain unchanged", "No browser errors"] };
  await writeFile(new URL("answer-formatting-qa.json", docs), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
