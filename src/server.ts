import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ZodError } from "zod";
import { DEFAULT_QUESTION, MAX_STEPS, RUN_TIMEOUT_MS, modelName, providerReady, runTutor } from "./agent.js";
import { questionSchema } from "./contracts.js";
import { LESSON_NOTES, searchNotes } from "./documents.js";

const PUBLIC = new URL("../public/", import.meta.url);
const ASSETS: Record<string, string> = {
  "index.html": "text/html", "learn.html": "text/html", "run.html": "text/html",
  "architecture.html": "text/html", "walkthrough.html": "text/html",
  "style.css": "text/css", "lesson.css": "text/css", "code-highlighting.css": "text/css",
  "client.js": "text/javascript", "navigation.js": "text/javascript", "code-highlighting.js": "text/javascript",
  "prism.js": "text/javascript", "astronaut.png": "image/png", "architecture.svg": "image/svg+xml",
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") throw new HttpError(415, "Send a JSON request.");
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let failed = false;
    request.on("data", (chunk: Buffer) => {
      if (failed) return;
      bytes += chunk.length;
      if (bytes > 8000) {
        failed = true;
        chunks.length = 0;
        reject(new HttpError(413, "The request is too large."));
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      if (failed) return;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new HttpError(400, "Send valid JSON.")); }
    });
    request.on("error", () => reject(new HttpError(400, "The request could not be read.")));
    request.on("aborted", () => reject(new HttpError(400, "The request was cancelled.")));
  });
}

function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

export function createLessonServer() {
  let busy = false;
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const url = new URL(request.url || "/", "http://127.0.0.1");
    try {
      const asset = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      if (request.method === "GET" && Object.hasOwn(ASSETS, asset)) {
        const content = await readFile(new URL(asset, PUBLIC));
        const mime = ASSETS[asset];
        response.writeHead(200, { "Content-Type": mime + (mime.startsWith("text/") ? "; charset=utf-8" : "") });
        response.end(content);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        json(response, 200, { application: "mastra-lesson01", version: "1.0.0" }); return;
      }
      if (request.method === "GET" && url.pathname === "/api/config") {
        json(response, 200, { ready: providerReady(), model: modelName(), defaultQuestion: DEFAULT_QUESTION,
          maxSteps: MAX_STEPS, noteCount: LESSON_NOTES.length }); return;
      }
      if (request.method === "GET" && url.pathname === "/api/documents") {
        json(response, 200, { documents: LESSON_NOTES.map(({ id, title, text }) => ({ id, title, text })) }); return;
      }
      if (request.method === "POST" && ["/api/search", "/api/query"].includes(url.pathname)) {
        const host = request.headers.host;
        const origin = request.headers.origin;
        const ownHost = Boolean(host && /^(?:127\.0\.0\.1|localhost):\d+$/.test(host));
        if (!ownHost || (origin && origin !== `http://${host}`)) throw new HttpError(403, "Use this application's own local page.");
        const { question } = questionSchema.parse(await readJson(request));
        if (url.pathname === "/api/search") {
          json(response, 200, { mode: "local-search", modelCalls: 0, documents: searchNotes(question) }); return;
        }
        if (!providerReady()) throw new HttpError(503, "Add your OPENAI_API_KEY to .env and restart. The local document search works without a key.");
        if (busy) throw new HttpError(409, "One tutor run is active. Wait for it to finish or press Stop.");
        busy = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
        response.on("close", () => { if (!response.writableEnded) controller.abort(); });
        response.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
        const emit = (event: unknown) => { if (!response.destroyed) response.write(JSON.stringify(event) + "\n"); };
        try { await runTutor(question, emit, controller.signal); }
        catch {
          emit({ type: "error", text: controller.signal.aborted ? "The run was stopped or reached its time limit. You can try again."
            : "The provider could not finish this run. Check the key, model access and connection in How to run." });
        } finally {
          clearTimeout(timer);
          busy = false;
          if (!response.destroyed) response.end();
        }
        return;
      }
      json(response, 404, { error: "That page or endpoint does not exist." });
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 500;
      const message = error instanceof HttpError ? error.message : error instanceof ZodError ? error.issues[0]?.message || "Check the question."
        : "The application could not complete the request.";
      json(response, status, { error: message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT || 3201);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  modelName();
  const server = createLessonServer();
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(error.code === "EADDRINUSE" ? `Port ${port} is in use. Stop the existing server or set another PORT in .env.` : "The local server could not start.");
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log(`Mastra Lesson 01 · http://127.0.0.1:${port} · ${providerReady() ? "Live tutor configured" : "Local search ready; add a provider key for the live tutor"}`));
}
