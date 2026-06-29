# "The Study" theme — installation guide

This package reskins your **Fork in the Road** chatbot to the warm, editorial
*"The Study"* look (paper + clay, Newsreader serif headings, IBM Plex Sans body)
while keeping the original 3‑column layout and **all of your existing chat / API
streaming logic unchanged**.

Only presentation changes. No new dependencies.

---

## What's in here

```
study-theme-handoff/
├── app/
│   ├── chat-page.tsx     ← drop‑in replacement for app/chat-page.tsx
│   └── globals.css       ← drop‑in replacement for app/globals.css
├── tailwind.config.ts    ← drop‑in replacement for tailwind.config.ts
└── README.md             ← this file
```

---

## Install (3 files, ~2 minutes)

From the root of your repo (`my-book-ai/`):

1. **Back up your current files** (optional but recommended):
   ```bash
   cp app/chat-page.tsx app/chat-page.tsx.bak
   cp app/globals.css   app/globals.css.bak
   cp tailwind.config.ts tailwind.config.ts.bak
   ```

2. **Copy the three files over** your existing ones:
   ```bash
   cp study-theme-handoff/app/chat-page.tsx app/chat-page.tsx
   cp study-theme-handoff/app/globals.css   app/globals.css
   cp study-theme-handoff/tailwind.config.ts tailwind.config.ts
   ```

3. **Restart the dev server** (Tailwind/Next picks up the new tokens & font import):
   ```bash
   npm run dev
   ```

That's it. Open http://localhost:3000.

---

## Why each file changes

| File | What changed | Why it's needed |
|------|--------------|-----------------|
| `app/chat-page.tsx` | Re‑styled JSX only. Same props (`initialQuote`, `allQuestions`), same `send()` streaming logic, same state. Chapter icons replaced with serif numbers; right rail now shows *Today's reflection → In this answer → Related*. | The actual visual reskin. |
| `tailwind.config.ts` | Adds the `paper / rail / line / card / ink / muted / faint / clay / claysoft / navsel …` color tokens and a `serif` font family. Your original `cream / navy / gold / warm` tokens are kept too. | The new classes (`bg-paper`, `text-clay`, `font-serif`, …) won't compile without these tokens. |
| `app/globals.css` | Swaps the Google Fonts import to **Newsreader + IBM Plex Sans** and recolors the streaming cursor to clay. | Loads the two fonts the theme uses. |

> **Note:** `app/page.tsx`, `app/layout.tsx`, `app/api/**`, `lib/**`, and your
> `data/*.json` files are **unchanged** — you don't need to touch them.
> `layout.tsx` already applies `font-sans`, which now resolves to IBM Plex Sans.

---

## Palette reference

| Token | Hex | Use |
|-------|-----|-----|
| `paper` | `#F3ECDD` | App background |
| `rail` | `#EBE2CF` | Left sidebar |
| `card` | `#FBF6EA` | Input bar, suggestion cards |
| `ink` | `#2B2722` | Headings / strong text |
| `muted` | `#8A8073` | Secondary text |
| `faint` | `#A89A7C` | Labels / captions |
| `clay` | `#A0613C` | Accent (buttons, links, avatar) |
| `claydeep` | `#8A4F2D` | Accent hover / emphasis |
| `claysoft` | `#EBD9C2` | User message bubble |

Fonts: **Newsreader** (`font-serif`) for the wordmark, chapter numbers, and
quotes; **IBM Plex Sans** (`font-sans`) for everything else.

---

## Reverting

If you backed up in step 1:
```bash
mv app/chat-page.tsx.bak app/chat-page.tsx
mv app/globals.css.bak   app/globals.css
mv tailwind.config.ts.bak tailwind.config.ts
```

---

## Optional polish (not required)

- **Book cover in the sidebar** already uses `/public/title-page.png` (unchanged).
- The `@tailwindcss/typography` plugin is already in your `package.json`; the
  answer text relies on its `prose` classes plus a few `prose-*` overrides
  defined inline in `chat-page.tsx`.
- If you later want the title bar to use the serif at larger sizes, the
  `font-serif` utility is now available everywhere.
