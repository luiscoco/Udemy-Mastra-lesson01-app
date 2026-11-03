(() => {
  const key = "mastra-lesson01-theme";
  try { document.documentElement.dataset.theme = localStorage.getItem(key) || "light"; } catch {}
  const button = document.getElementById("theme");
  const label = () => { if (button) button.textContent = document.documentElement.dataset.theme === "dark" ? "Light mode" : "Dark mode"; };
  label();
  if (button) button.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(key, document.documentElement.dataset.theme); } catch {}
    label();
  });
  for (const copy of document.querySelectorAll("button[data-copy]")) {
    copy.addEventListener("click", async () => {
      const source = document.getElementById(copy.dataset.copy);
      if (!source) return;
      try {
        await navigator.clipboard.writeText(source.textContent || "");
        copy.textContent = "Copied";
      } catch { copy.textContent = "Select code to copy"; }
      setTimeout(() => { copy.textContent = "Copy code"; }, 2000);
    });
  }
})();
