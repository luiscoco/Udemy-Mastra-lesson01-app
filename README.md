# Mastra · Lesson 01 · Introduction to Mastra

A practical, document-grounded tutor for the first lesson of **Mastra AI Agents**. Five linked student pages follow the visual language and content structure of the reference Claude Agent SDK course applications.

![Lesson 1 application preview](docs/application-preview.png)

## Start the application

Use Node.js 24 or newer.

```powershell
git clone https://github.com/luiscoco/Udemy-Mastra-lesson01-app.git
cd Udemy-Mastra-lesson01-app
npm ci
npm start
```

Open **http://127.0.0.1:3201**. Starting the server does not call a model. **Try document search** immediately runs keyword search over the six bundled lesson notes, with no provider key and no fabricated AI answer.

## Configure the real Mastra tutor

Stop the server, then create a local `.env` file if one does not already exist:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Replace the placeholder with your own key:

```dotenv
OPENAI_API_KEY=your_api_key
MASTRA_MODEL=openai/gpt-4.1-mini
PORT=3201
```

Choose a model your provider account can access, in `openai/model-name` form. Restart with `npm start`, then choose **Run tutor agent**. Live generation uses your provider account and may incur API usage. The key remains on the server; `.env` is ignored by Git. Existing shell environment values take precedence over `.env`.

Bash alternative:

```bash
[ -f .env ] || cp .env.example .env
# Edit .env with your preferred editor.
npm start
```

## The five student pages

| Page | What the student does |
| --- | --- |
| Application lab | Asks a lesson question, tries local search or the live tutor, and inspects returned evidence and execution events. |
| What you will learn | Connects agents, tools, data, memory, workflows and observability to the first lesson. |
| How to run | Clones, configures, starts, changes and verifies the application. |
| Architecture & workflow | Follows a downloadable UML sequence and source-linked steps. |
| Code walkthrough | Reads excerpts generated from the actual TypeScript source, with line links and syntax highlighting. |

All pages support the shared light/dark theme and responsive layout. The astronaut artwork, typography, orange heading accent, blue navigation, pastel cards and code-highlighting integration follow the supplied reference apps.

## What runs

The live tutor uses the real `@mastra/core` runtime:

1. The local HTTP host validates the question with Zod.
2. A `Mastra` registry contains the tutor `Agent`.
3. The agent combines instructions, a configured model and `searchLessonDocs`.
4. `createTool()` defines the search operation and its input/output schemas.
5. The model can request the tool. The implementation returns up to three real passages with source IDs.
6. `generate()` returns the explanation. The host checks the finish reason and that cited IDs came from this run's evidence.

The application displays actual tool events, returned passages and the final answer. It does not show hidden model reasoning. The agent has a three-step limit, a 90-second deadline and a bounded output size. Stop requests cancellation; cancellation cannot undo provider work already completed.

**Citation-ID validation is a structural check.** Read the passages to determine whether the answer's claims are actually supported. A complete status does not certify semantic correctness.

The key-free search button directly calls the same `searchNotes()` helper used by the tool. It does not invoke an agent or a model and is labelled accordingly.

## Lesson scope

This first application implements one agent, one typed tool, a small keyword-search data source and an application event log. It introduces workflows, memory, vector retrieval, tracing and evaluations conceptually. It does not configure persistent conversation storage, a vector database, an executable support workflow, a trace exporter or an evaluation platform.

The framework's broader capabilities belong to the lesson's conceptual map; the UI distinguishes them from what this app actually runs.

## Terminal examples

```powershell
npm run search -- "memory and retrieval"
npm run sample -- "What is an agent?"
```

The first command is key-free. The second runs the real tutor and loads an optional `.env` file, using the same agent and checks as the browser.

## Make changes and verify

```powershell
npm run build
npm test
```

`build` regenerates all five pages and the browser script. Source snippets and GitHub line references come from the actual files, so rebuild after source edits. Generated public files are committed so a fresh clone can start immediately after `npm ci`.

Offline tests cover retrieval outcomes, invalid inputs, citation provenance, registration with the installed Mastra runtime, source-excerpt freshness and HTTP behavior. They make no paid model calls. A configured provider and a live run are needed to verify real model behavior in your own environment.

## Suggested student exercise

1. Run local search for **How do memory and retrieval differ?** Read the returned notes.
2. Run the configured tutor with the same question. Compare the answer with the evidence.
3. Change the tutor instructions to use a support-desk example. Rebuild and restart.
4. Ask an unsupported question. Inspect the response and any review status.
5. Explain which code belongs to the product, Mastra orchestration and provider infrastructure.

## Project layout

```text
src/
  agent.ts                     # Bounded generation and completion/citation checks
  contracts.ts                 # Request, tool and event contracts
  documents.ts                 # Six lesson notes and bounded keyword search
  client.ts                    # Browser interaction and actual event display
  server.ts                    # Local HTTP host; provider key stays here
  sample.ts                    # Terminal examples
  mastra/
    index.ts                   # Agent registration
    agents/tutor.ts            # Model, instructions and tools
    tools/search-lesson-docs.ts # Actual Mastra tool
scripts/build-pages.ts         # Generated student pages and source-linked excerpts
public/                       # Five pages, UML SVG, shared style and browser assets
tests/                        # Offline behavior and integration checks
```

## References and visual provenance

- [Lesson 1 visual/content reference](https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson01-app)
- [Lesson 60 visual/content reference](https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson60-app)
- [Mastra agents](https://mastra.ai/docs/agents/overview)
- [Agent.generate()](https://mastra.ai/reference/agents/generate)
- [createTool()](https://mastra.ai/reference/tools/create-tool)
- [Mastra registry](https://mastra.ai/reference/core/mastra-class)

The course astronaut, base stylesheet and code-highlighting integration come from the user's lesson 1 reference repository. Prism's license is retained in `public/prism-LICENSE.txt`. Lesson prose and the practical tutor are adapted to the supplied Introduction to Mastra lesson.
