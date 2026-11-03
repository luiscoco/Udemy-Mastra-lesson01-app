import { marked } from "marked";
import DOMPurify from "dompurify";

let nextCodeId = 0;
const aliases: Record<string, string> = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", sh: "bash", shell: "bash", ps1: "powershell" };
const labels: Record<string, string> = { typescript: "TypeScript", javascript: "JavaScript", json: "JSON", bash: "Bash", powershell: "PowerShell" };

// Model output is untrusted. Sanitize parsed Markdown before inserting any HTML.
export function renderAnswer(container: HTMLElement, markdown: string) {
  const html = marked.parse(markdown, { async: false, gfm: true });
  container.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "del", "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "blockquote", "pre", "code", "hr", "a", "table", "thead", "tbody", "tr", "th", "td"],
    ALLOWED_ATTR: ["href", "title", "class", "start"],
    RETURN_TRUSTED_TYPE: false,
  });
  container.classList.add("markdown-answer");
  for (const code of container.querySelectorAll<HTMLElement>("pre > code")) {
    const declared = [...code.classList].find(name => name.startsWith("language-"))?.slice(9).toLowerCase() || "typescript";
    const language = Object.hasOwn(aliases, declared) ? aliases[declared] : declared;
    code.className = `language-${language}`;
    code.id = `answer-code-${++nextCodeId}`;
    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";
    const caption = document.createElement("p");
    caption.className = "source";
    caption.textContent = Object.hasOwn(labels, language) ? labels[language] : language;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.dataset.copy = code.id;
    copy.textContent = "Copy code";
    copy.setAttribute("aria-label", `Copy code: ${caption.textContent}`);
    toolbar.append(caption, copy);
    code.parentElement!.before(toolbar);
  }
  for (const table of container.querySelectorAll("table")) {
    const wrapper = document.createElement("div");
    wrapper.className = "table";
    table.before(wrapper);
    wrapper.append(table);
  }
  // The shared Prism observer highlights these code blocks using the exact
  // same grammars and token palette as the application's explanation pages.
}
