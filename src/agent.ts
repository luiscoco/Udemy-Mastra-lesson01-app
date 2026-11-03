import { randomUUID } from "node:crypto";
import { createLessonMastra } from "./mastra/index.js";
import { checkCitations, type LabEvent } from "./contracts.js";

export const DEFAULT_QUESTION = "How does Mastra connect an agent with tools and data?";
export const MAX_STEPS = 3;
export const RUN_TIMEOUT_MS = 90_000;

export function modelName(value = process.env.MASTRA_MODEL): `openai/${string}` {
  const model = value?.trim() || "openai/gpt-4.1-mini";
  if (!/^openai\/[a-zA-Z0-9._-]+$/.test(model)) throw new Error("MASTRA_MODEL must be an OpenAI model in openai/model-name form.");
  return model as `openai/${string}`;
}

export function providerReady() {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && !/^(your_|replace|<)/i.test(key));
}

export async function runTutor(question: string, emit: (event: LabEvent) => void, signal: AbortSignal) {
  const started = performance.now();
  const model = modelName();
  const availableIds = new Set<string>();
  let toolCalls = 0;
  const observe = (event: LabEvent) => {
    if (event.type === "tool") {
      toolCalls += 1;
      for (const document of event.documents) availableIds.add(document.id);
    }
    emit(event);
  };
  emit({ type: "started", runId: randomUUID(), text: "The server received your question and is creating the lesson agent." });
  const mastra = createLessonMastra(model, observe);
  const tutor = mastra.getAgent("tutor");
  emit({ type: "model", model, text: `Calling tutor.generate() with a maximum of ${MAX_STEPS} model steps.` });
  const result = await tutor.generate(question, {
    maxSteps: MAX_STEPS,
    abortSignal: signal,
    modelSettings: { maxOutputTokens: 1200 },
  });
  if (signal.aborted) throw new Error("Run cancelled.");
  const answer = result.text.trim();
  const citations = checkCitations(answer, availableIds);
  const complete = result.finishReason === "stop" && answer.length > 0 && toolCalls > 0 && citations.valid;
  if (answer) emit({ type: "answer", text: answer });
  emit({ type: "result", status: complete ? "complete" : "needs-review",
    text: complete ? "The generation finished, searched the lesson notes and cited returned source IDs. Read the passages to check that they support the answer."
      : "Review this result: the run did not produce a finished answer with citations to returned passages. A run limit, missing evidence or an unsupported question may be the cause.",
    sourceIds: citations.ids, toolCalls, steps: result.steps.length,
    durationMs: Math.round(performance.now() - started),
  });
}
