import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { checkCitations, questionSchema } from "../src/contracts.js";
import { searchNotes, LESSON_NOTES } from "../src/documents.js";
import { createLessonMastra } from "../src/mastra/index.js";
import { modelName } from "../src/agent.js";
import { buildPages } from "../scripts/build-pages.js";

test("retrieval selects relevant, bounded evidence and does not invent matches", () => {
  assert.equal(searchNotes("memory retrieval")[0]?.id, "context");
  assert.equal(searchNotes("workflow ticket")[0]?.id, "workflows");
  assert.ok(searchNotes("Mastra agent tools data").length <= 3);
  assert.deepEqual(searchNotes("orbital banana zephyr"), []);
  assert.ok(searchNotes("agents tools").every(result => LESSON_NOTES.some(note => note.id === result.id && note.text === result.text)));
});

test("the question boundary rejects empty, oversized and extra configuration values", () => {
  assert.deepEqual(questionSchema.parse({ question: "  What is an agent?  " }), { question: "What is an agent?" });
  for (const invalid of [{ question: " " }, { question: 42 }, { question: "a".repeat(1501) }, { question: "hi", model: "injected" }]) {
    assert.equal(questionSchema.safeParse(invalid).success, false);
  }
});

test("citation checks require IDs from this run's evidence", () => {
  const evidence = new Set(["tools", "agent"]);
  assert.equal(checkCitations("An agent can use a tool. [agent] [tools]", evidence).valid, true);
  assert.equal(checkCitations("An unsupported claim. [made-up]", evidence).valid, false);
  assert.equal(checkCitations("Valid and invalid. [tools] [made-up]", evidence).valid, false);
  assert.equal(checkCitations("An answer with no citation.", evidence).valid, false);
});

test("the installed Mastra runtime registers the actual tutor without making a model call", () => {
  const mastra = createLessonMastra("openai/gpt-4.1-mini", () => {});
  assert.equal(mastra.getAgent("tutor").name, "Mastra Lesson 1 Tutor");
  assert.equal(modelName("openai/gpt-4.1-mini"), "openai/gpt-4.1-mini");
  assert.throws(() => modelName("other:model"));
});

test("all five teaching pages contain the current generated source excerpts", async () => {
  const pages = await buildPages();
  assert.equal(Object.keys(pages).length, 5);
  for (const [file, expected] of Object.entries(pages)) {
    const actual = await readFile(new URL(`../public/${file}`, import.meta.url), "utf8");
    assert.equal(actual, expected, `Rebuild stale student page: ${file}`);
    assert.match(actual, /aria-current="page"/);
    assert.match(actual, /<title>Mastra · Lesson 01/);
  }
});
