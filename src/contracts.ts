import { z } from "zod";

export const questionSchema = z.object({
  question: z.string().trim().min(1, "Enter a question first.").max(1500, "Keep the question under 1,500 characters."),
}).strict();
export const toolInputSchema = z.object({
  query: z.string().trim().min(1).max(1500),
});
export const documentSchema = z.object({ id: z.string(), title: z.string(), text: z.string() });
export const toolOutputSchema = z.object({ documents: z.array(documentSchema) });

export type LabEvent =
  | { type: "started"; runId: string; text: string }
  | { type: "model"; text: string; model: string }
  | { type: "tool"; text: string; query: string; documents: z.infer<typeof documentSchema>[] }
  | { type: "answer"; text: string }
  | { type: "result"; text: string; status: "complete" | "needs-review"; sourceIds: string[]; toolCalls: number; steps: number; durationMs: number }
  | { type: "error"; text: string };

export function checkCitations(answer: string, allowedIds: ReadonlySet<string>) {
  const ids = [...new Set([...answer.matchAll(/\[([a-z][a-z0-9-]*)\]/g)].map(match => match[1]))];
  return { valid: ids.length > 0 && ids.every(id => allowedIds.has(id)), ids };
}
