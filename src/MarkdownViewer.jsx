import { useEffect, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { render as renderMermaid } from "pele";
import {
  getHighlighter,
  highlightCodeSync,
  resolveLang,
} from "./shikiHighlighter";

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMermaidFence(source, id) {
  try {
    const { svg } = renderMermaid(source, {
      idPrefix: `mermaid-${id}`,
      responsive: true,
    });

    return `<div class="mermaid-diagram">${svg}</div>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="mermaid-error"><strong>Mermaid diagram error</strong><pre>${escapeHtml(message)}</pre></div>`;
  }
}

export function MarkdownViewer({ content }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const highlighter = await getHighlighter();
      const renderer = new marked.Renderer();
      let mermaidId = 0;
      renderer.code = ({ text, lang }) => {
        const language = lang?.trim().split(/\s+/)[0]?.toLowerCase();
        if (language === "mermaid") {
          mermaidId += 1;
          return renderMermaidFence(text, mermaidId);
        }

        return highlightCodeSync(highlighter, text, language);
      };

      const loadedLangs = new Set();
      for (const match of content.matchAll(/^```+\s*([^\s`]+)/gm)) {
        const lang = match[1];
        if (!loadedLangs.has(lang)) {
          loadedLangs.add(lang);
          await resolveLang(highlighter, lang);
        }
      }

      const parsed = marked.parse(content, { breaks: true, renderer });
      const sanitized = DOMPurify.sanitize(parsed, {
        ADD_ATTR: ["style", "tabindex"],
      });
      if (!cancelled) {
        setHtml(sanitized);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
