import { memo, useCallback, useEffect, useRef, useState } from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { tokenizeCode } from "./shikiHighlighter";

const INITIAL_MARKDOWN = `# Markdown-react
A simple markdown editor and previewer based on react and markdown

## Features:
1) Supports headings (h1-h6)
2) Paragraphs
3) Lists
4) [Links](http://google.com)
5) **Bold** text
6) *Italics* text
7) Code blocks using shiki

## Code block
\`\`\`js
function Test() {
  console.log("Hello, world");
}
\`\`\`
`;

const HEADING_CLASSES = ["md-h1", "md-h2", "md-h3", "md-h4", "md-h5", "md-h6"];
const CODE_CLASSES = [
  "md-code-line",
  "md-code-fence",
  "md-code-open",
  "md-code-close",
];

function getCurrentBlock(editor, node) {
  if (node === editor) {
    return editor;
  }

  while (node && node.parentNode !== editor) {
    node = node.parentNode;
  }

  return node ?? editor;
}

function headingLevel(text) {
  const match = text.match(/^(#{1,6})\s/);
  return match ? match[1].length : 0;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function caretTextOffset(root) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) && root !== range.startContainer) {
    return null;
  }

  const prefix = range.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  return prefix.toString().length;
}

function setCaretTextOffset(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent.length;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  placeCaretInBlock(root, true);
}

function placeCaretInBlock(block, atEnd = false) {
  const selection = window.getSelection();
  const range = document.createRange();
  const textNode =
    block.firstChild?.nodeType === Node.TEXT_NODE ? block.firstChild : null;

  if (textNode) {
    range.setStart(textNode, atEnd ? textNode.textContent.length : 0);
  } else {
    range.setStart(block, 0);
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getCaretPosition(editor) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const block = getCurrentBlock(editor, range.startContainer);
  const blocks = [...editor.childNodes];
  const blockIndex = blocks.indexOf(block);

  if (blockIndex === -1) {
    return { blockIndex: Math.max(blocks.length - 1, 0), offset: 0 };
  }

  const offset =
    block.nodeType === Node.TEXT_NODE
      ? range.startOffset
      : (caretTextOffset(block) ?? 0);

  return { blockIndex, offset };
}

function setCaretPosition(editor, position) {
  if (!position) {
    return;
  }

  const blocks = [...editor.childNodes];
  const block = blocks[position.blockIndex] ?? blocks.at(-1);
  if (!block) {
    return;
  }

  if (block.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.setStart(
      block,
      Math.min(position.offset, block.textContent.length),
    );
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  if (!(block.textContent ?? "")) {
    placeCaretInBlock(block);
    return;
  }

  setCaretTextOffset(block, position.offset);
}

function renderInlineHtml(text) {
  let html = "";
  let plain = "";
  let index = 0;

  const flushPlain = () => {
    if (plain) {
      html += escapeHtml(plain);
      plain = "";
    }
  };

  const tryDelim = (delim, className) => {
    if (!text.startsWith(delim, index)) {
      return false;
    }

    const innerStart = index + delim.length;
    const end = text.indexOf(delim, innerStart);
    if (end === -1) {
      return false;
    }

    const inner = text.slice(innerStart, end);
    if (!inner || inner !== inner.trim()) {
      return false;
    }

    flushPlain();
    html += `<span class="${className}">${escapeHtml(text.slice(index, end + delim.length))}</span>`;
    index = end + delim.length;
    return true;
  };

  while (index < text.length) {
    if (
      tryDelim("***", "md-bold md-italic") ||
      tryDelim("___", "md-bold md-italic") ||
      tryDelim("**", "md-bold") ||
      tryDelim("__", "md-bold") ||
      tryDelim("*", "md-italic") ||
      tryDelim("_", "md-italic")
    ) {
      continue;
    }

    plain += text[index];
    index += 1;
  }

  flushPlain();
  return html;
}

function applyHeadingClass(element, level) {
  element.classList.remove("md-heading", ...HEADING_CLASSES);
  if (level) {
    element.classList.add("md-heading", `md-h${level}`);
  }
}

function clearCodeClasses(element) {
  element.classList.remove(...CODE_CLASSES);
  element.style.removeProperty("background-color");
  element.style.removeProperty("color");
}

function parseFenceOpen(text) {
  const match = text.match(/^(`{3,})(.*)$/);
  if (!match) {
    return null;
  }
  const lang = match[2].trim().split(/\s+/)[0] || "plaintext";
  return { ticks: match[1], lang };
}

function isFenceClose(text) {
  return /^`{3,}\s*$/.test(text);
}

function findFenceRanges(blocks) {
  const ranges = [];
  let index = 0;

  while (index < blocks.length) {
    const text = blocks[index].textContent ?? "";
    const open = parseFenceOpen(text);
    if (!open) {
      index += 1;
      continue;
    }

    let end = index + 1;
    let closed = false;
    while (end < blocks.length) {
      const line = blocks[end].textContent ?? "";
      if (isFenceClose(line)) {
        closed = true;
        break;
      }
      end += 1;
    }

    ranges.push({
      start: index,
      end: closed ? end : blocks.length - 1,
      closeIndex: closed ? end : -1,
      lang: open.lang,
    });
    index = closed ? end + 1 : blocks.length;
  }

  return ranges;
}

function tokensToHtml(lineTokens) {
  if (!lineTokens?.length) {
    return "<br>";
  }

  return lineTokens
    .map((token) => {
      const color = token.color ? ` style="color:${token.color}"` : "";
      return `<span class="md-token"${color}>${escapeHtml(token.content)}</span>`;
    })
    .join("");
}

function setBlockHtml(block, html) {
  if (block.innerHTML === html) {
    return;
  }
  block.innerHTML = html;
}

function styleBlock(block) {
  const text = block.textContent ?? "";
  setBlockHtml(block, renderInlineHtml(text) || "<br>");
}

function wrapTopLevelTextNodes(editor) {
  for (const child of [...editor.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      const div = document.createElement("div");
      div.textContent = child.textContent;
      child.replaceWith(div);
    }
  }
}

function setEditorMarkdown(editor, markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks = lines.map((line) => {
    const div = document.createElement("div");
    if (line) {
      div.textContent = line;
    } else {
      div.appendChild(document.createElement("br"));
    }
    return div;
  });
  editor.replaceChildren(...blocks);
}

let styleGeneration = 0;

function insertParagraphAfter(block) {
  const newBlock = document.createElement("div");
  newBlock.appendChild(document.createElement("br"));
  block.after(newBlock);
  placeCaretInBlock(newBlock);
}

function handleEditorKeyDown(evt) {
  if (evt.key !== "Enter" || evt.shiftKey || evt.altKey || evt.ctrlKey || evt.metaKey) {
    return;
  }

  const editor = evt.currentTarget;
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  let block = getCurrentBlock(editor, range.startContainer);

  if (block.nodeType === Node.TEXT_NODE && block.parentNode === editor) {
    const div = document.createElement("div");
    div.textContent = block.textContent;
    block.replaceWith(div);
    block = div;
  }

  if (!(block instanceof HTMLElement) || block === editor || block.parentNode !== editor) {
    return;
  }

  evt.preventDefault();

  const text = block.textContent ?? "";
  const offset = caretTextOffset(block) ?? text.length;

  if (offset < text.length) {
    const after = text.slice(offset);
    block.textContent = text.slice(0, offset) || "";
    if (!block.textContent) {
      block.innerHTML = "<br>";
    }
    const newBlock = document.createElement("div");
    newBlock.textContent = after;
    block.after(newBlock);
    placeCaretInBlock(newBlock);
  } else {
    insertParagraphAfter(block);
  }

  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

async function styleEditorBlocks(editor) {
  const generation = ++styleGeneration;
  const caret = getCaretPosition(editor);
  wrapTopLevelTextNodes(editor);

  const blocks = [...editor.children].filter(
    (child) => child instanceof HTMLElement,
  );
  const fences = findFenceRanges(blocks);
  const inFence = new Map();

  for (const fence of fences) {
    for (let index = fence.start; index <= fence.end; index += 1) {
      inFence.set(index, fence);
    }
  }

  for (const [index, block] of blocks.entries()) {
    const fence = inFence.get(index);
    if (!fence) {
      clearCodeClasses(block);
      applyHeadingClass(block, headingLevel(block.textContent ?? ""));
      styleBlock(block);
    }
  }

  for (const fence of fences) {
    for (let index = fence.start; index <= fence.end; index += 1) {
      const block = blocks[index];
      applyHeadingClass(block, 0);
      block.classList.remove(...CODE_CLASSES);
      if (index === fence.start) {
        block.classList.add("md-code-fence", "md-code-open");
      } else if (index === fence.closeIndex) {
        block.classList.add("md-code-fence", "md-code-close");
      } else {
        block.classList.add("md-code-line");
      }
    }

    const codeLines = [];
    for (let index = fence.start + 1; index <= fence.end; index += 1) {
      if (index === fence.closeIndex) {
        continue;
      }
      codeLines.push(blocks[index].textContent ?? "");
    }

    const result = await tokenizeCode(codeLines.join("\n"), fence.lang);
    if (generation !== styleGeneration) {
      return;
    }
    let codeLineIndex = 0;

    for (let index = fence.start; index <= fence.end; index += 1) {
      const block = blocks[index];
      applyHeadingClass(block, 0);
      block.classList.remove(...CODE_CLASSES);
      if (result.bg) {
        block.style.backgroundColor = result.bg;
      }
      if (result.fg) {
        block.style.color = result.fg;
      }

      if (index === fence.start) {
        block.classList.add("md-code-fence", "md-code-open");
        block.style.removeProperty("color");
        setBlockHtml(block, escapeHtml(block.textContent ?? "") || "<br>");
        continue;
      }

      if (index === fence.closeIndex) {
        block.classList.add("md-code-fence", "md-code-close");
        block.style.removeProperty("color");
        setBlockHtml(block, escapeHtml(block.textContent ?? "") || "<br>");
        continue;
      }

      block.classList.add("md-code-line");
      const lineTokens = result.tokens[codeLineIndex] ?? [];
      codeLineIndex += 1;
      setBlockHtml(block, tokensToHtml(lineTokens) || "<br>");
    }
  }

  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const caretBlock = range ? getCurrentBlock(editor, range.startContainer) : null;
  if (caretBlock instanceof HTMLElement && caretBlock !== editor) {
    const fenceLine = [...blocks].findIndex((block) => block === caretBlock);
    if (fenceLine === -1 || !inFence.has(fenceLine)) {
      applyHeadingClass(caretBlock, headingLevel(caretBlock.textContent ?? ""));
    }
  }

  setCaretPosition(editor, caret);
}

const MarkdownEditor = memo(function MarkdownEditor({ initialContent, onInput }) {
  const editorRef = useRef(null);
  const didHydrate = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || didHydrate.current) {
      return;
    }

    didHydrate.current = true;
    setEditorMarkdown(editor, initialContent ?? "");
    styleEditorBlocks(editor);
  }, [initialContent]);

  return (
    <div
      ref={editorRef}
      onInput={onInput}
      onKeyDown={handleEditorKeyDown}
      className="markdown-editor"
      contentEditable={true}
      suppressContentEditableWarning={true}
    />
  );
});

export default function App() {
  const [mdContent, setContent] = useState(INITIAL_MARKDOWN);

  const handleChange = useCallback((evt) => {
    const editor = evt.currentTarget;
    requestAnimationFrame(() => {
      styleEditorBlocks(editor).then(() => {
        setContent(editor.innerText);
      });
    });
  }, []);

  return (
    <div className="App">
      <MarkdownEditor initialContent={mdContent} onInput={handleChange} />
      <MarkdownViewer content={mdContent} />
    </div>
  );
}
