import { createHighlighter } from "shiki";

export const SHIKI_THEME = "github-dark";

const INITIAL_LANGS = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "json",
  "html",
  "css",
  "python",
  "bash",
  "shell",
  "markdown",
  "plaintext",
];

let highlighterPromise;

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_THEME],
      langs: INITIAL_LANGS,
    });
  }
  return highlighterPromise;
}

const LANG_ALIASES = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  md: "markdown",
};

export async function resolveLang(highlighter, lang) {
  const requested = LANG_ALIASES[(lang || "").trim().toLowerCase()]
    || (lang || "plaintext").trim().toLowerCase()
    || "plaintext";

  const loaded = highlighter.getLoadedLanguages();
  if (loaded.includes(requested)) {
    return requested;
  }

  try {
    await highlighter.loadLanguage(requested);
    return requested;
  } catch {
    return "plaintext";
  }
}

export function loadedLangOrPlain(highlighter, lang) {
  const requested =
    LANG_ALIASES[(lang || "").trim().toLowerCase()] ||
    (lang || "plaintext").trim().toLowerCase() ||
    "plaintext";
  return highlighter.getLoadedLanguages().includes(requested)
    ? requested
    : "plaintext";
}

export function highlightCodeSync(highlighter, code, lang) {
  return highlighter.codeToHtml(code, {
    lang: loadedLangOrPlain(highlighter, lang),
    theme: SHIKI_THEME,
  });
}

export async function tokenizeCode(code, lang) {
  const highlighter = await getHighlighter();
  const language = await resolveLang(highlighter, lang);
  try {
    return highlighter.codeToTokens(code, {
      lang: language,
      theme: SHIKI_THEME,
    });
  } catch {
    return highlighter.codeToTokens(code, {
      lang: "plaintext",
      theme: SHIKI_THEME,
    });
  }
}
