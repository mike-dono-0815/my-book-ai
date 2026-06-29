# App Design — "The Fork in the Road" AI Companion

## What It Does

A chatbot that answers people management and leadership questions grounded in the book's content. Users ask questions; the app finds the most relevant passages from the book and feeds them to an LLM to generate a contextual answer.

---

## Key Tech Decisions

### 1. AI Backend — Google Gemini (free tier)
- **LLM:** `gemini-2.5-flash` for answer generation (streaming)
- **Embeddings:** `gemini-embedding-2` (3072-dim vectors) for semantic search
- Both services are free within Google's API quota — no hosting cost for inference
- API key stored in `.env.local` (local) and as a Vercel environment variable (production); never committed to git

### 2. RAG — Retrieval-Augmented Generation
The app doesn't send the whole book to Gemini. Instead:
1. At build time, `ingest.py` splits the book into ~500-word chunks and pre-computes embeddings → `data/book-embeddings.json`
2. At query time, the user's question is embedded and compared to all chunks via cosine similarity
3. The top 5 most relevant chunks are injected into the Gemini prompt as grounding context

This keeps answers book-specific, controls token costs, and avoids hallucination.

### 3. Embeddings Storage — flat JSON (no vector DB)
Embeddings are stored in `data/book-embeddings.json` (170 chunks, ~10 MB). Cosine similarity search runs in-process on each request. This is sufficient at book scale and avoids the complexity and cost of a vector database (e.g. Pinecone, Supabase pgvector).

### 4. Book Privacy
The book's `.tex` source files live in a **private** GitHub repo (`../my-book`). The AI app repo is **public** but contains only:
- Pre-processed embeddings (numbers, no prose)
- Extracted quotes (`data/quotes.json`)
- Generated questions (`data/questions.json`)

The actual chapter text is never served as a static asset and is never committed to the public repo.

### 5. Data Pipeline (Python scripts, run once locally)
| Script | Purpose | Output |
|---|---|---|
| `ingest.py` | Parse `.tex` → strip LaTeX → chunk → embed | `data/book-embeddings.json` |
| `extract_quotes.py` | Extract `\begin{pullquote}` blocks → clean text | `data/quotes.json` (58 quotes) |
| `generate_questions.py` | Send chapter text to Gemini → 20 questions each | `data/questions.json` (100 questions) |

Scripts are not part of the deployed app — they run locally whenever book content changes.

### 6. Frontend — Next.js 15 App Router
- **`app/page.tsx`** — Server Component: reads quotes and questions from disk at request time, passes to client
- **`app/chat-page.tsx`** — Client Component: all interactive state (messages, streaming, suggestions)
- **`app/api/chat/route.ts`** — Serverless API route: embeds query, retrieves chunks, streams Gemini response

Three-column layout:
- Left (256px): chapter list + book cover
- Center (flex): chat input and message history
- Right (288px): today's quote + sources from last answer

### 7. Streaming Protocol
The API route streams two things in sequence:
1. A single JSON line: `{"sources":[...]}\n` — metadata about which chunks were used
2. Plain streamed text: the Gemini answer

The client buffers until the first `\n`, parses sources, then appends streaming text to the message bubble.

### 8. Markdown Rendering
AI responses are rendered with `react-markdown` + `@tailwindcss/typography` so that bold, bullet lists, and headings in Gemini's output display correctly. User messages remain plain text.

### 9. Daily Quote Rotation
`app/page.tsx` computes `quotes[Math.floor(Date.now() / 86_400_000) % quotes.length]` server-side. All visitors see the same quote on a given day; it advances at UTC midnight. No client-side randomness needed.

### 10. Clickable Question Suggestions
`data/questions.json` holds 100 questions (20 per chapter), grounded in the book's actual stories. On each new conversation, 4 are picked randomly from the full pool (`pickRandom(pool, 4)`) and shown as clickable chips. Clicking sends the question directly to the chat.

### 11. Deployment — Vercel
- Next.js deployed to Vercel (free hobby tier)
- `GEMINI_API_KEY` set as a Vercel environment variable
- `data/` files (embeddings, quotes, questions) are committed to the public repo and bundled at deploy time — they contain no prose, only derived data
- `.env.local`, `node_modules/`, and `.next/` are gitignored

---

## File Map

```
my-book-ai/
├── app/
│   ├── page.tsx          # Server Component — quote + questions loader
│   ├── chat-page.tsx     # Client Component — full UI
│   ├── layout.tsx        # Root layout, fonts, metadata
│   └── api/chat/
│       └── route.ts      # Streaming API endpoint
├── lib/
│   └── embeddings.ts     # Cosine similarity search over book-embeddings.json
├── data/
│   ├── book-embeddings.json   # 170 chunks × 3072-dim (committed, ~10 MB)
│   ├── quotes.json            # 58 pull quotes from the book
│   └── questions.json         # 100 chapter questions
├── public/
│   └── title-page.png    # Book cover image
├── ingest.py             # Build embeddings from .tex files
├── extract_quotes.py     # Extract pull quotes from .tex files
├── generate_questions.py # Generate chapter questions via Gemini
└── AppDesign.md          # This file
```
