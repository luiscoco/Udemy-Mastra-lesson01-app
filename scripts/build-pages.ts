import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { LESSON_NOTES } from "../src/documents.js";
import { DEFAULT_QUESTION } from "../src/agent.js";

const ROOT = new URL("../", import.meta.url);
const REPO = "https://github.com/luiscoco/Udemy-Mastra-lesson01-app";
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
let codeNumber = 0;

function code(content: string, language = "typescript", caption = "Copy this example") {
  const id = `code-${++codeNumber}`;
  return `<div class="code-toolbar"><p class="source">${caption}</p><button type="button" data-copy="${id}" aria-label="Copy code: ${escape(caption.replace(/<[^>]*>/g, ""))}">Copy code</button></div><pre><code id="${id}" class="language-${language}">${escape(content)}</code></pre>`;
}

async function source(path: string, from?: string, before?: string) {
  const lines = (await readFile(new URL(path, ROOT), "utf8")).trimEnd().split(/\r?\n/);
  const first = from ? lines.findIndex(line => line.includes(from)) : 0;
  if (first < 0) throw new Error(`Missing source excerpt: ${path}: ${from}`);
  const next = before ? lines.findIndex((line, index) => index > first && line.includes(before)) : lines.length;
  if (next < 0) throw new Error(`Missing source excerpt end: ${path}: ${before}`);
  return code(lines.slice(first, next).join("\n"), "typescript",
    `Source: <a href="${REPO}/blob/main/${path}#L${first + 1}-L${next}">${escape(path)} · lines ${first + 1}–${next}</a>`);
}

function page(current: string, title: string, heading: string, lead: string, body: string) {
  const links = [["index.html", "Application lab"], ["learn.html", "What you will learn"], ["run.html", "How to run"],
    ["architecture.html", "Architecture & workflow"], ["walkthrough.html", "Code walkthrough"]];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Learn Introduction to Mastra with a practical document-grounded tutor, source-linked code and a guided application workflow.">
<title>Mastra · Lesson 01 · ${escape(title)}</title><link rel="icon" href="/astronaut.png">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/lesson.css"><link rel="stylesheet" href="/code-highlighting.css"></head>
<body><a class="skip-link" href="#content">Skip to lesson content</a><main>
<div class="brand"><a href="/">How <span>Mastra</span> Works</a><span class="badge">LESSON 01 / INTRODUCTION</span></div>
<header class="hero"><div><div class="eyebrow">AGENTS · TOOLS · ORCHESTRATION</div><h1>${heading}</h1><p class="lead">${lead}</p></div><img src="/astronaut.png" width="190" height="190" alt="Course astronaut mascot"></header>
<nav class="nav" aria-label="Application sections">${links.map(([path, label]) => `<a href="${path === "index.html" ? "/" : `/${path}`}"${current === path ? ' aria-current="page"' : ""}>${label}</a>`).join("")}<button id="theme" type="button">Dark mode</button></nav>
<div id="content" tabindex="-1">${body}</div>
<footer>MASTRA AI AGENTS · LESSON 01 · INTRODUCTION TO MASTRA<br>TypeScript · a local teaching application · provider credentials stay on the server<br><a href="https://mastra.ai/docs">Official Mastra documentation</a> · <a href="${REPO}">Application source on GitHub</a></footer>
</main><script src="/navigation.js"></script><script src="/prism.js"></script><script src="/code-highlighting.js"></script>${current === "index.html" ? '<script type="module" src="/client.js"></script>' : ""}</body></html>\n`;
}

export async function buildPages() {
  codeNumber = 0;
  const notes = LESSON_NOTES.map(note => `<article class="evidence-card" id="note-${note.id}"><span class="source-id">[${note.id}]</span><h3>${escape(note.title)}</h3><p>${escape(note.text)}</p></article>`).join("");
  const index = page("index.html", "Your Mastra tutor", "Meet your <em>Mastra tutor.</em>",
    "Ask a question. Find evidence in the lesson notes. See how an agent, a tool and a model work together.", `
<div class="flow" aria-label="The lesson's three stages"><div data-stage="1"><b>01 · Agent</b><p>Instructions and a model</p></div><span aria-hidden="true">→</span><div data-stage="2"><b>02 · Tool + data</b><p>Search the lesson notes</p></div><span aria-hidden="true">→</span><div data-stage="3"><b>03 · Explain</b><p>Cite and check the evidence</p></div></div>
<section class="workspace" aria-label="Practical application"><article class="panel"><p class="eyebrow">A DOCUMENT-GROUNDED LESSON TUTOR</p><h2>Ask about Mastra.</h2>
<p>Your product supplies the interface. Mastra coordinates the tutor and its search tool. The configured model produces the explanation.</p>
<div class="pill-row"><span class="status-pill" id="provider-status">Checking configuration</span></div><p class="meta" id="configuration">Connecting to the local application…</p>
<form id="question-form"><label for="question">Your lesson question</label><textarea id="question" name="question" required maxlength="1500" rows="5" aria-describedby="question-help">${escape(DEFAULT_QUESTION)}</textarea><p id="question-help" class="meta">Ask about agents, tools, workflows, memory, retrieval or observability. Up to 1,500 characters.</p>
<div class="question-chips" aria-label="Suggested questions">${["What is an agent?", "How do memory and retrieval differ?", "When should I use a workflow?"].map(q => `<button type="button" data-question="${escape(q)}">${escape(q)}</button>`).join("")}</div>
<div class="actions"><button id="run-agent" class="primary" type="submit" disabled>Run tutor agent</button><button id="search-notes" type="button">Try document search</button><button id="stop" type="button" disabled>Stop</button></div></form>
<p class="note compact" id="setup-hint">Start with <strong>Try document search</strong>, which works without a key. To run the real tutor, configure your provider key in <code>.env</code> and restart. <a href="/run.html">Follow the setup steps →</a></p>
<details><summary>What runs in each mode?</summary><p class="compact"><strong>Run tutor agent</strong> calls Mastra and your configured model. The model can request the search tool, then return an explanation with source IDs.</p><p class="compact"><strong>Try document search</strong> runs the same keyword-search helper directly. It returns actual matching passages and makes no model call.</p></details></article>
<article class="panel"><div class="output-heading"><h2>Answer & evidence</h2><span class="status-pill" id="run-mode">Ready to explore</span></div>
<div class="stats"><div class="stat"><span>Run status</span><strong id="run-status">Ready</strong></div><div class="stat"><span>Agent tool calls</span><strong id="tool-count">0</strong></div><div class="stat"><span>Model steps</span><strong id="step-count">0</strong></div></div>
<div id="answer" aria-live="polite" aria-label="Answer or local search summary"></div><div id="source-links" class="source-links" aria-label="Cited evidence"></div><p id="feedback" class="meta" role="status" aria-live="polite"></p>
<h3>Returned passages</h3><p id="evidence-count" class="meta">No sources yet</p><div id="evidence"><p class="empty">The tool's actual passages will appear here. Compare them with the tutor's citations.</p></div>
<details open><summary>Execution events</summary><ol id="events" aria-label="Execution events" aria-live="polite"></ol></details>
<p class="footnote">This is an application event log. A production trace backend, semantic vector search and persistent memory are topics for later lessons.</p></article></section>
<section class="step"><h2>Pause, inspect, explain.</h2><div class="grid"><article class="card"><span class="number">01</span><h3>Read the evidence</h3><p>Try the document search. Which passages were returned, and which part of your question do they support?</p></article><article class="card"><span class="number">02</span><h3>Run the agent</h3><p>Once configured, inspect the actual tool calls. Did the tutor cite returned source IDs? A valid ID still needs a factual support check.</p></article><article class="card"><span class="number">03</span><h3>Find the boundary</h3><p>Ask about tomorrow's weather. The six lesson notes do not supply that evidence. The tutor should state the limitation.</p></article></div></section>
<details><summary>Read all six bundled lesson notes</summary>${notes}</details>
<div class="actions"><a class="button" href="/learn.html">Explore the concepts →</a><a class="button" href="/walkthrough.html">Read the actual code →</a></div>`);

  const objectives = [
    ["Place Mastra in the stack", "Separate your product interface and business rules from orchestration, model providers and data services. The tutor page is the product; the Mastra registry connects its agent and tool."],
    ["Recognize an agent", "Identify its model, instructions and available tools. Follow the bounded loop from a question through a tool result to an explanation."],
    ["Inspect a typed tool", "Read the search description, Zod input schema, implementation and returned source passages. The model chooses arguments; the application validates the boundary."],
    ["Distinguish context sources", "Conversation memory carries information between turns when configured. Retrieval supplies relevant evidence. This app retrieves bundled notes and does not persist a conversation."],
    ["Know when order matters", "A workflow defines steps and branches, such as classify → draft or request a human decision. Our tutor is an agent example; that workflow is introduced conceptually."],
    ["Verify observed outcomes", "Inspect actual application events and source IDs. Traces, structured logs and evaluations serve different purposes; a production telemetry backend is not configured here."],
  ];
  const learn = page("learn.html", "What you will learn", "Understand the <em>moving pieces.</em>",
    "Connect the first lesson's concepts to the application you can run and inspect.", `
<div class="grid">${objectives.map(([title, text], index) => `<article class="card"><span class="number">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></article>`).join("")}</div>
<section class="step"><h2>Three architectural layers</h2><div class="layer"><strong>Your product</strong><span>Interface, users, input validation and business rules</span></div><div class="layer"><strong>Mastra orchestration</strong><span>Agents, tools and their execution; workflows and configured context as an application grows</span></div><div class="layer"><strong>AI infrastructure</strong><span>Model providers, databases, vector stores and external services</span></div><p>The browser does not need to know how a model requests a tool. The host calls the registered agent and presents the observable results.</p></section>
<section class="step"><h2>What this first app implements</h2><div class="table"><table><thead><tr><th>Concept</th><th>In this app</th><th>Explore later</th></tr></thead><tbody><tr><td>Agent</td><td>One registered tutor with a model and instructions</td><td>Specialized agents and collaboration</td></tr><tr><td>Tool + data</td><td>A typed keyword lookup over six local notes</td><td>External APIs, chunking, embeddings and vector retrieval</td></tr><tr><td>Context</td><td>Instructions, the current question and returned passages</td><td>Configured history, working memory and semantic recall</td></tr><tr><td>Workflow</td><td>A conceptual support-ticket example</td><td>Executable branches and human decisions</td></tr><tr><td>Observability</td><td>An application event log and citation-ID checks</td><td>Trace storage, evaluation datasets and operational monitoring</td></tr></tbody></table></div></section>
<section class="step"><h2>Check your understanding</h2><details><summary>Is Mastra the language model?</summary><p>No. Mastra coordinates the application pieces. The configured model provider performs inference.</p></details><details><summary>Does a tool description enforce valid input?</summary><p>The description guides the model. Runtime schema validation checks the supplied values. Application permissions and scope still need explicit controls.</p></details><details><summary>Does a correct citation ID prove the answer is supported?</summary><p>No. This application checks that cited IDs came from the tool's results. A student must still read the passages and verify the claims; semantic evaluation is a separate concern.</p></details><details><summary>When is a workflow useful?</summary><p>When the application needs a defined sequence or branch. A ticket process can fetch data, classify, then draft or wait for a human decision.</p></details></section>
<section class="note"><strong>Your takeaway:</strong> Mastra gives a TypeScript application a coordinated way to use agents, tools, data and workflows. The product still owns its behavior, evidence checks and operational limits.</section><div class="actions"><a class="button" href="/">← Try the application</a><a class="button" href="/architecture.html">Follow the request →</a></div>`);

  const pkg = JSON.parse(await readFile(new URL("package.json", ROOT), "utf8"));
  const run = page("run.html", "How to run", "From clone to <em>first question.</em>",
    "Start with a key-free document lookup, then configure a provider to run the actual Mastra tutor.", `
<section class="step"><span class="number">01</span><h2>Install and start</h2><p>Use Node.js 24 or newer and npm. The committed lockfile fixes the dependency versions. Starting the server does not call a model.</p>${code(`git clone ${REPO}.git\ncd Udemy-Mastra-lesson01-app\nnpm ci\nnpm start`, "powershell", "Clone and start the completed application")}<p>Open <a href="http://127.0.0.1:3201">http://127.0.0.1:3201</a>. Keep the terminal open. Press Ctrl+C to stop the server.</p><p>Choose <strong>Try document search</strong> in the application lab. This works immediately and returns real passages without a provider key.</p></section>
<section class="step"><span class="number">02</span><h2>Configure the live tutor</h2><p>Stop the server first. Copy the example only if you do not already have a local configuration file.</p>${code('if (!(Test-Path .env)) { Copy-Item .env.example .env }\nnotepad .env', "powershell", "PowerShell: create your local configuration")}${code('OPENAI_API_KEY=your_api_key\nMASTRA_MODEL=openai/gpt-4.1-mini\nPORT=3201', "dotenv", "Replace the placeholder in your own .env file")}<p>Use a model your provider account can access. The app accepts an <code>openai/model-name</code> identifier. Your key stays on the server and is never sent to the browser.</p>${code('npm start', "powershell", "Restart after changing the environment")}<p>A key already set in the launching shell takes precedence over the optional <code>.env</code> file. Another terminal does not inherit an environment variable set later in the first terminal.</p><details><summary>Bash / macOS / Linux alternative</summary>${code('[ -f .env ] || cp .env.example .env\n# Edit .env with your preferred editor.\nnpm start', "bash", "Bash setup")}</details></section>
<section class="step"><span class="number">03</span><h2>Run and inspect</h2><ol class="check-list"><li>Ask: <strong>${escape(DEFAULT_QUESTION)}</strong></li><li>Choose <strong>Run tutor agent</strong>. This calls your provider and may incur API usage.</li><li>Inspect the search event, returned passages, final answer and cited IDs.</li><li>Confirm that the answer's claims are supported by the passages, beyond the automatic ID check.</li><li>Try <strong>Stop</strong> during a run. The server requests cancellation. Each run also has a 90-second deadline and at most three model steps.</li></ol><p>The answer is generated with <code>generate()</code> and displayed when ready. Application events arrive while the run is active.</p></section>
<section class="step"><h2>Terminal samples</h2>${code('npm run search -- "memory and retrieval"\nnpm run sample -- "What is an agent?"', "powershell", "Search needs no key; sample calls the real tutor")}<p>The sample command loads an optional local <code>.env</code> file. It uses the same agent, tool and checks as the browser application.</p></section>
<section class="step"><h2>Build and verify your changes</h2>${code('npm run build\nnpm test', "powershell", "Regenerate pages and browser code, then run the offline checks")}<p>The code walkthrough excerpts are generated from the actual TypeScript files. Rebuild after editing source so the pages and line references stay current. The tests do not call a paid model.</p><p>Installed Mastra version: <code>${escape(pkg.dependencies?.["@mastra/core"] || "See package-lock.json")}</code>. This complete project includes both source files and the generated public pages.</p></section>
<section class="step"><h2>Troubleshooting</h2><div class="table"><table><thead><tr><th>What you see</th><th>What to check</th></tr></thead><tbody><tr><td>Provider key needed</td><td>Replace the placeholder in <code>.env</code>, then restart the same server process. You can still try local search.</td></tr><tr><td>Provider could not finish</td><td>Check credentials, model access, provider credit and network access. The UI intentionally does not display raw provider exceptions.</td></tr><tr><td>Needs review</td><td>The generation did not finish with valid returned-source citations. Read the evidence, try a supported lesson question, or inspect the run limit.</td></tr><tr><td>No matching passages</td><td>Ask about a lesson topic. The search is limited to the six bundled notes.</td></tr><tr><td>Port is in use</td><td>Stop the existing server or set a different <code>PORT</code> in <code>.env</code>. Use the URL printed in the terminal.</td></tr></tbody></table></div></section><div class="actions"><a class="button" href="/">← Run the application</a><a class="button" href="/walkthrough.html">Inspect the source →</a></div>`);

  const excerpts = {
    input: await source("src/contracts.ts", "export const questionSchema", "export const toolInputSchema"),
    documents: await source("src/documents.ts", "export function searchNotes"),
    tool: await source("src/mastra/tools/search-lesson-docs.ts"),
    tutor: await source("src/mastra/agents/tutor.ts"),
    registry: await source("src/mastra/index.ts"),
    generation: await source("src/agent.ts", "  const result = await tutor.generate"),
    citations: await source("src/contracts.ts", "export function checkCitations"),
  };
  const walkthrough = page("walkthrough.html", "Code walkthrough", "Read the <em>working code.</em>",
    "Every excerpt comes from this application. Follow the small pieces that make the tutor work.", `
<section class="note">The lesson video uses introductory pseudocode. This repository turns that idea into a runnable TypeScript example with <code>Agent</code>, <code>createTool()</code> and a registered <code>Mastra</code> instance. Excerpts link to the complete source for surrounding context.</section>
${[
    ["Validate the application request", "The browser supplies a question. Zod trims and validates it before any run starts. This is a product boundary; it is separate from the tool's own input schema.", excerpts.input],
    ["Give the tool a bounded data source", "The search helper ranks the six bundled notes and returns at most three passages. It cannot read arbitrary files or browse the web.", excerpts.documents],
    ["Define a real Mastra tool", "The tool's description tells the model what it can do. Its schema specifies arguments and returned evidence. The implementation performs the actual lookup and emits an application event.", excerpts.tool],
    ["Combine model, instructions and tools", "The tutor instructions require evidence and source citations. The model identifier selects the provider and model; the tool record exposes one supported capability.", excerpts.tutor],
    ["Register the agent", "The application registers the tutor with Mastra, then retrieves it by its registry key. Each run receives its own event callback, so observed results belong to that run.", excerpts.registry],
    ["Generate, limit and inspect", "generate() runs the agent with a step limit, an abort signal and an output bound. The host checks the termination reason and source IDs before labelling the answer complete. An ID check does not prove that every claim is supported.", excerpts.generation],
    ["Check citation IDs", "Only IDs actually returned during this run are accepted. Reading the passages and evaluating semantic support remain distinct tasks.", excerpts.citations],
  ].map(([title, text, snippet], index) => `<section class="step"><span class="number">${String(index + 1).padStart(2, "0")}</span><h2>${title}</h2><p>${text}</p>${snippet}</section>`).join("")}
<section class="step"><h2>Try one focused change</h2><p>Edit the tutor instructions to explain concepts using a support-desk example. Rebuild, restart and ask the same question. Check which parts of the answer change and whether the returned evidence still supports them.</p><p>For a data change, edit one bundled note and run local search first. You can inspect the tool's behavior before involving a model.</p></section><div class="actions"><a class="button" href="/architecture.html">← Follow the sequence</a><a class="button" href="/">Run your version →</a></div>`);

  const architecture = page("architecture.html", "Architecture and workflow", "Follow one <em>question.</em>",
    "Trace the product boundary, Mastra orchestration, model calls and returned evidence.", `
<section class="step"><h2>One small application, three layers</h2><div class="grid"><article class="card"><h3>Product</h3><p>Five student pages, the question form, the local HTTP host and result checks.</p></article><article class="card"><h3>Orchestration</h3><p>A Mastra registry, one tutor agent, its instructions and the lesson-search tool.</p></article><article class="card"><h3>Infrastructure</h3><p>A configured model provider and six local source notes. No external database is required.</p></article></div><p>This sequence shows a live tutor run in which the model requests the search tool. Tool choice comes from the model; the application checks whether evidence was actually used.</p><a class="button" href="/architecture.svg" download>Download the UML sequence SVG</a></section>
<div class="diagram"><img src="/architecture.svg" alt="Sequence from browser question through request validation, Mastra agent generation, model tool request, local document search, cited answer and application checks"></div>
${[
    ["Validate the student's question", "Browser → local host. Invalid questions are rejected before the agent is invoked.", excerpts.input],
    ["Create the agent and its registry", "Host → Mastra. The tutor receives its model, instructions and search tool, then is registered under the tutor key.", excerpts.registry],
    ["Expose the search operation", "Mastra → tool. The tool validates its query and returns bounded source passages when the model requests it.", excerpts.tool],
    ["Use the actual returned evidence", "Tool → model. The model receives source IDs and passages, then can produce a grounded explanation. No external search service is involved.", excerpts.documents],
    ["Finish and check", "Model → host → browser. The host handles the final text, checks completion and cited IDs, and reports the observed tool calls and step count.", excerpts.generation],
  ].map(([title, text, snippet], index) => `<section class="step workflow-step" id="workflow-step-${index + 1}"><span class="number">${String(index + 1).padStart(2, "0")}</span><h2>${title}</h2><p>${text}</p>${snippet}</section>`).join("")}
<section class="note"><strong>Local search path:</strong> Try document search calls the search helper directly and returns passages to the browser. It bypasses agent generation and makes zero model calls. Its events and results are labelled accordingly.</section>
<section class="step"><h2>Agent loop and defined workflows</h2><p>The tutor can choose a tool within its instructions and run limit. A future support-ticket workflow could require a fixed sequence: fetch customer data → classify → draft or pause for a human decision. This app introduces that distinction without pretending to execute an unimplemented workflow.</p></section><div class="actions"><a class="button" href="/walkthrough.html">Explain each code step →</a><a class="button" href="/">Return to the lab →</a></div>`);
  return { "index.html": index, "learn.html": learn, "run.html": run, "walkthrough.html": walkthrough, "architecture.html": architecture };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const pages = await buildPages();
  for (const [name, html] of Object.entries(pages)) await writeFile(new URL(`public/${name}`, ROOT), html);
  console.log("Built all five student pages from the current lesson content and source excerpts.");
}
