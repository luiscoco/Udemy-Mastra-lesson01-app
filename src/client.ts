type Note = { id: string; title: string; text: string };
type Event = { type: string; text?: string; model?: string; query?: string; documents?: Note[];
  status?: string; sourceIds?: string[]; toolCalls?: number; steps?: number; durationMs?: number; runId?: string };
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = element<HTMLFormElement>("question-form");
const question = element<HTMLTextAreaElement>("question");
const runButton = element<HTMLButtonElement>("run-agent");
const searchButton = element<HTMLButtonElement>("search-notes");
const stopButton = element<HTMLButtonElement>("stop");
const answer = element<HTMLDivElement>("answer");
const events = element<HTMLOListElement>("events");
const evidence = element<HTMLDivElement>("evidence");
const sourceLinks = element<HTMLDivElement>("source-links");
const configuration = element<HTMLParagraphElement>("configuration");
const feedback = element<HTMLParagraphElement>("feedback");
let ready = false;
let active = false;
let stopped = false;
let controller: AbortController | undefined;
const documents = new Map<string, Note>();

function status(text: string) { element("run-status").textContent = text; }
function stage(number: number) {
  for (const node of document.querySelectorAll<HTMLElement>("[data-stage]")) node.dataset.active = String(Number(node.dataset.stage) === number);
}
function busy(value: boolean) {
  active = value;
  runButton.disabled = value || !ready;
  searchButton.disabled = value;
  stopButton.disabled = !value;
  question.disabled = value;
  for (const chip of document.querySelectorAll<HTMLButtonElement>("[data-question]")) chip.disabled = value;
}
function log(title: string, text: string) {
  const row = document.createElement("li");
  const heading = document.createElement("strong");
  const description = document.createElement("span");
  heading.textContent = title;
  description.textContent = text;
  row.append(heading, description);
  events.append(row);
  events.scrollTop = events.scrollHeight;
}
function addEvidence(notes: Note[]) {
  for (const note of notes) documents.set(note.id, note);
  evidence.replaceChildren();
  if (!documents.size) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No matching lesson passages were returned. Try a question about Mastra, agents, tools, memory or workflows.";
    evidence.append(empty);
  }
  for (const note of documents.values()) {
    const card = document.createElement("article");
    card.className = "evidence-card";
    card.id = `source-${note.id}`;
    const id = document.createElement("span");
    id.className = "source-id";
    id.textContent = `[${note.id}]`;
    const title = document.createElement("h3");
    title.textContent = note.title;
    const body = document.createElement("p");
    body.textContent = note.text;
    card.append(id, title, body);
    evidence.append(card);
  }
  element("evidence-count").textContent = `${documents.size} returned sources`;
}
function reset(mode: string) {
  documents.clear();
  answer.textContent = "";
  events.replaceChildren();
  evidence.replaceChildren();
  sourceLinks.replaceChildren();
  feedback.textContent = "";
  feedback.className = "meta";
  element("run-mode").textContent = mode;
  element("tool-count").textContent = "0";
  element("step-count").textContent = "0";
  element("evidence-count").textContent = "No sources yet";
  stage(1);
}
function handle(event: Event) {
  if (event.type === "started") log("1 · Application request", event.text || "");
  if (event.type === "model") {
    status("Running");
    stage(1);
    log("2 · Mastra → model", `${event.model}. ${event.text || ""}`);
  }
  if (event.type === "tool") {
    stage(2);
    addEvidence(event.documents || []);
    element("tool-count").textContent = String(Number(element("tool-count").textContent) + 1);
    log("3 · Tool returned evidence", `Query: ${event.query || ""}. ${event.text || ""}`);
  }
  if (event.type === "answer") {
    stage(3);
    answer.textContent = event.text || "";
    log("4 · Model answer", "The generated answer is displayed above. Compare its citations with the returned passages.");
  }
  if (event.type === "result") {
    stage(3);
    status(event.status === "complete" ? "Complete" : "Needs review");
    element("step-count").textContent = String(event.steps ?? 0);
    element("tool-count").textContent = String(event.toolCalls ?? 0);
    feedback.textContent = event.text || "";
    for (const id of event.sourceIds || []) {
      if (!documents.has(id)) continue;
      const link = document.createElement("a");
      link.href = `#source-${id}`;
      link.textContent = `[${id}]`;
      sourceLinks.append(link);
    }
    log("5 · Application checks", `${event.text} Duration: ${((event.durationMs || 0) / 1000).toFixed(1)} seconds.`);
  }
  if (event.type === "error") {
    status("Could not finish");
    feedback.textContent = event.text || "The run could not finish.";
    feedback.className = "meta error";
    log("Run stopped", feedback.textContent);
  }
}
async function request(mode: "agent" | "search") {
  if (active) return;
  if (!question.value.trim()) { question.setCustomValidity("Enter a question first."); question.reportValidity(); return; }
  question.setCustomValidity("");
  if (!form.reportValidity()) return;
  reset(mode === "agent" ? "Live Mastra agent" : "Local search · no model call");
  busy(true);
  stopped = false;
  controller = new AbortController();
  status(mode === "agent" ? "Connecting" : "Searching");
  try {
    const response = await fetch(mode === "agent" ? "/api/query" : "/api/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.value.trim() }), signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json() as { error?: string };
      throw new Error(body.error || "The server could not complete the request.");
    }
    if (mode === "search") {
      const result = await response.json() as { documents: Note[] };
      addEvidence(result.documents);
      answer.textContent = result.documents.length
        ? `Found ${result.documents.length} relevant lesson passages. Read the evidence below. Configure a provider key and choose Run tutor agent to have a model explain these concepts.`
        : "No matching passages were found in the lesson handbook. Try one of the suggested questions.";
      log("Local document search", `The same searchNotes() helper used by the agent's tool returned ${result.documents.length} passages. No agent or model was invoked.`);
      stage(2);
      status("Search complete");
      feedback.textContent = "This is a real keyword lookup over the bundled notes. It is not an AI-generated answer.";
    } else {
      if (!response.body) throw new Error("The server returned no event stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminal = false;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as Event;
        handle(event);
        if (event.type === "result" || event.type === "error") terminal = true;
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) consume(line);
      }
      buffer += decoder.decode();
      consume(buffer);
      if (!terminal) throw new Error("The connection closed before a final result arrived. Try again.");
    }
  } catch (error) {
    status(stopped ? "Stopped" : "Could not finish");
    feedback.className = "meta error";
    feedback.textContent = stopped ? "You stopped this run. The server was asked to cancel the model request."
      : error instanceof Error ? error.message : "The request could not finish.";
    log(stopped ? "Cancelled" : "Request error", feedback.textContent);
  } finally { busy(false); controller = undefined; }
}

form.addEventListener("submit", event => { event.preventDefault(); void request("agent"); });
question.addEventListener("input", () => question.setCustomValidity(""));
searchButton.addEventListener("click", () => void request("search"));
stopButton.addEventListener("click", () => { stopped = true; controller?.abort(); });
for (const chip of document.querySelectorAll<HTMLButtonElement>("[data-question]")) {
  chip.addEventListener("click", () => { question.value = chip.dataset.question || ""; question.setCustomValidity(""); question.focus(); });
}
void (async () => {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error();
    const config = await response.json() as { ready: boolean; model: string; noteCount: number; maxSteps: number };
    ready = config.ready;
    const pill = element("provider-status");
    pill.textContent = ready ? "Live tutor configured" : "Provider key needed for live tutor";
    pill.classList.toggle("ready", ready);
    configuration.textContent = `${config.model} · ${config.noteCount} bundled notes · up to ${config.maxSteps} model steps per run`;
    element("setup-hint").hidden = ready;
    busy(false);
  } catch {
    configuration.textContent = "Could not reach the application server. Start it with npm start and reload this page.";
    element("provider-status").textContent = "Server unavailable";
    searchButton.disabled = true;
  }
})();
export {};
