import { useEffect, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  getHighlighter,
  highlightCodeSync,
  resolveLang,
} from "./shikiHighlighter";

export function MarkdownViewer({ content }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const highlighter = await getHighlighter();
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }) =>
        highlightCodeSync(highlighter, text, lang?.trim().split(/\s+/)[0]);

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
