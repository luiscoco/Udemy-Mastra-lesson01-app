import { createTool } from "@mastra/core/tools";
import { toolInputSchema, toolOutputSchema, type LabEvent } from "../../contracts.js";
import { searchNotes } from "../../documents.js";

export function createSearchLessonDocs(emit: (event: LabEvent) => void) {
  return createTool({
    id: "search-lesson-docs",
    description: "Search the bundled Introduction to Mastra handbook. Use it before answering lesson questions. Returns up to three passages with source IDs for citations.",
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
    execute: async ({ query }) => {
      const documents = searchNotes(query);
      emit({ type: "tool", query, documents, text: `searchLessonDocs returned ${documents.length} lesson passages.` });
      return { documents };
    },
  });
}
