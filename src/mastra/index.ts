import { Mastra } from "@mastra/core/mastra";
import { createTutor } from "./agents/tutor.js";
import type { LabEvent } from "../contracts.js";

// Build one registry per run so its event callback belongs to that browser run.
export function createLessonMastra(model: `openai/${string}`, emit: (event: LabEvent) => void) {
  const tutor = createTutor(model, emit);
  return new Mastra({ agents: { tutor } });
}
