export const LESSON_NOTES = [
  {
    id: "orchestration", title: "What Mastra does", keywords: ["mastra", "orchestration", "framework", "product", "application"],
    text: "Mastra is a TypeScript framework for coordinating language models with an application's instructions, tools, data and workflows. Your product owns its interface and business rules. Mastra supplies the orchestration layer; model providers and other services supply the infrastructure. An agent framework does not replace the model or guarantee that an answer is correct.",
  },
  {
    id: "agent", title: "The agent and its loop", keywords: ["agent", "model", "instructions", "prompt", "loop", "generate", "stream", "tutor"],
    text: "An agent combines a model, instructions and available tools, with memory when configured. The model can request a tool, inspect its result and continue toward an answer. Give the run explicit limits. generate() returns a completed generation result; stream() supports incremental output. This example uses generate() and sends application events to the browser while work happens.",
  },
  {
    id: "tools", title: "Tools give the agent an action", keywords: ["tool", "tools", "schema", "search", "documents", "notes", "data", "evidence", "citation"],
    text: "A tool has an identifier, a description, an input schema and an implementation. Its schema validates values at the application boundary. Our searchLessonDocs tool performs keyword search over these six bundled lesson notes and returns source IDs with the passages. The tutor must cite returned source IDs. This is a small document-search example; it does not use embeddings or a vector database.",
  },
  {
    id: "workflows", title: "When a workflow helps", keywords: ["workflow", "workflows", "order", "ticket", "support", "human", "steps"],
    text: "A workflow expresses a defined sequence or branch. A support process might fetch customer data, classify a ticket, then draft a reply or pause for a human decision. An agent decides its next action within its instructions and available tools. This introductory app runs an agent; the support workflow is a conceptual example, not an implemented feature of this app.",
  },
  {
    id: "context", title: "Memory and retrieval", keywords: ["memory", "retrieval", "rag", "history", "semantic", "context", "storage", "embeddings"],
    text: "Memory can provide conversation history, selected working facts or relevant older messages when storage is configured. Retrieval supplies relevant source passages as evidence. A larger retrieval pipeline can chunk documents, embed them and query a vector store. This app uses local keyword retrieval and starts each tutor run without persisted conversation memory. Grounding still needs instructions and citation checks.",
  },
  {
    id: "observability", title: "Inspect and verify the result", keywords: ["trace", "traces", "observability", "logs", "evaluations", "verification", "verify", "limits", "integrations", "providers"],
    text: "Tracing records model calls, tool calls and workflow steps when configured. Logs expose events; evaluations assess properties such as relevance and evidence use. This app displays a small application event log, actual search results and checks on cited source IDs. It does not configure a telemetry backend or an evaluation platform. Provider choice, storage, authorization and operational checks remain application responsibilities.",
  },
] as const;

export type LessonDocument = { id: string; title: string; text: string };
const STOP_WORDS = new Set("a an the is are be to of in for and or with how what why does do can i it this that my me explain about from".split(" "));
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Search stays inside the lesson handbook; there is no filesystem or web access.
export function searchNotes(query: string): LessonDocument[] {
  const tokens = [...new Set(normalize(query).split(" ").filter(word => word && !STOP_WORDS.has(word)))];
  if (!tokens.length) return [];
  return LESSON_NOTES.map((document, index) => {
    const keywords = document.keywords.map(normalize);
    const body = normalize(`${document.title} ${document.text}`).split(" ");
    const score = tokens.reduce((sum, token) => sum + (keywords.some(word => word === token) ? 4 : body.includes(token) ? 1 : 0), 0);
    return { document, score, index };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3).map(({ document }) => ({ id: document.id, title: document.title, text: document.text }));
}
