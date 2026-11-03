import { DEFAULT_QUESTION, RUN_TIMEOUT_MS, providerReady, runTutor } from "./agent.js";
import { searchNotes } from "./documents.js";
import { questionSchema } from "./contracts.js";

const searchOnly = process.argv.includes("--search");
const { question } = questionSchema.parse({ question: process.argv.slice(2).filter(arg => arg !== "--search").join(" ") || DEFAULT_QUESTION });
if (searchOnly) {
  console.log("Local keyword search over the lesson handbook. No model call is made.");
  console.log(JSON.stringify(searchNotes(question), null, 2));
} else if (!providerReady()) {
  console.error("Configure OPENAI_API_KEY in .env or this terminal. Use npm run search for the key-free document lookup.");
  process.exitCode = 1;
} else {
  try {
    await runTutor(question, event => {
      console.log(JSON.stringify(event));
      if (event.type === "result" && event.status !== "complete") process.exitCode = 1;
    }, AbortSignal.timeout(RUN_TIMEOUT_MS));
  } catch {
    console.error("The tutor could not finish. Check the provider configuration and model access.");
    process.exitCode = 1;
  }
}
