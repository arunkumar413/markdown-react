# markdown-react

A split-pane Markdown editor built with React. Type Markdown on the left and see a live preview on the right. The editor keeps the Markdown syntax visible (`#`, `**`, ` ``` `) while styling those blocks to match the preview.

## Features

- **Live split view** — editor and preview stay in sync as you type
- **Headings** — `#` through `######` render as `h1`–`h6`; the editor uses the same sizes and weights as the preview
- **Paragraphs** — Enter starts a new line in both the editor and the preview
- **Bold and italics** — `**bold**`, `__bold__`, `*italic*`, and `_italic_` are emphasized in the editor the same way they appear in the preview
- **Lists** — ordered and unordered lists render in the preview
- **Links** — `[text](url)` becomes a clickable link in the preview
- **Fenced code blocks** — ` ``` ` blocks are syntax-highlighted with [Shiki](https://shiki.style/) in both panes (language from the fence info string, for example ` ```js `)
- **Safe preview** — Markdown is parsed with [marked](https://marked.js.org/) and sanitized with [DOMPurify](https://github.com/cure53/DOMPurify)
- **Inter typeface** — editor and preview use Inter; code blocks stay monospace

## Getting started

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173/markdown-react/`).

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with Oxlint |

## GitHub Pages

Pushes to `main` build the Vite app and publish `dist` to the `gh-pages` branch.

1. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).
2. In the GitHub repo, open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Set **Branch** to `gh-pages` / `/ (root)`, then save.

Do not point Pages at `main`. That serves the Vite source `index.html`, which requests `/src/main.jsx` and 404s.

The live app is:

https://arunkumar413.github.io/markdown-react/

## Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [marked](https://marked.js.org/) for Markdown parsing
- [DOMPurify](https://github.com/cure53/DOMPurify) for HTML sanitization
- [Shiki](https://shiki.style/) for code highlighting
