"""
Ingestion script: reads book .tex files, strips LaTeX markup, splits into
section-level chunks, generates Gemini embeddings, and writes
data/book-embeddings.json for the RAG API to consume.

Run once (or whenever the book changes):
    python ingest.py
"""

import os
import re
import json
import time
from pathlib import Path
from google import genai

# ── Config ────────────────────────────────────────────────────────────────────

BOOK_DIR      = Path("../my-book")
OUTPUT_PATH   = Path("data/book-embeddings.json")
EMBED_MODEL   = "models/gemini-embedding-2"
MAX_WORDS     = 500   # soft limit per chunk; splits on paragraph boundaries
API_DELAY     = 0.25  # seconds between embedding calls (free tier: 15 RPM max)

SOURCES = [
    ("Introduction",                   BOOK_DIR / "Intro.tex"),
    ("Chapter 1: The Launch Disaster",  BOOK_DIR / "chapter1.tex"),
    ("Chapter 2: The Friction Point",   BOOK_DIR / "chapter2.tex"),
    ("Chapter 3: The Olympus Bet",      BOOK_DIR / "chapter3.tex"),
    ("Chapter 4: The Choice Point",     BOOK_DIR / "chapter4.tex"),
    ("Chapter 5: The AI Frontier",      BOOK_DIR / "chapter5.tex"),
    ("Conclusion",                      BOOK_DIR / "Conclusion.tex"),
]

# ── LaTeX helpers ─────────────────────────────────────────────────────────────

def _remove_command(text: str, command: str) -> str:
    """Remove \\command{...} while correctly handling nested braces."""
    result = []
    i = 0
    cmd = f"\\{command}{{"
    while i < len(text):
        idx = text.find(cmd, i)
        if idx == -1:
            result.append(text[i:])
            break
        result.append(text[i:idx])
        j = idx + len(cmd)
        depth = 1
        while j < len(text) and depth > 0:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
            j += 1
        i = j
    return "".join(result)


def extract_body(path: Path) -> str:
    """Return only the body of a .tex file (between \\begin/end{document} if present)."""
    text = path.read_text(encoding="utf-8")
    match = re.search(r"\\begin\{document\}(.*?)(?:\\end\{document\}|$)", text, re.DOTALL)
    return match.group(1) if match else text


def strip_latex(text: str) -> str:
    """Convert LaTeX markup to clean readable prose."""
    # Strip % comments
    text = re.sub(r"%.*$", "", text, flags=re.MULTILINE)

    # Drop-cap: \lettrine[...]{X}{rest} → Xrest
    text = re.sub(r"\\lettrine\[.*?\]\{(\w)\}\{([^}]*)\}", r"\1\2", text)

    # Footnotes contain useful context but break chunk flow — remove them
    text = _remove_command(text, "footnote")

    # Remove table environments (too complex to parse usefully)
    for env in ("tabular", "tabularx", "table"):
        text = re.sub(rf"\\begin\{{{env}\*?\}}.*?\\end\{{{env}\*?\}}", " ", text, flags=re.DOTALL)

    # Remove visual-only environments
    for env in ("center", "figure", "AddToShipoutPictureBG"):
        text = re.sub(rf"\\begin\{{{env}\*?\}}.*?\\end\{{{env}\*?\}}", " ", text, flags=re.DOTALL)

    # Keep prose from named environments, just strip the tags
    for env in ("pullquote", "infobox", "itemize", "enumerate", "description", "mdframed"):
        text = re.sub(rf"\\begin\{{{env}\*?\}}", "", text)
        text = re.sub(rf"\\end\{{{env}\*?\}}", "", text)

    # List items → bullet
    text = re.sub(r"\\item\b", "•", text)

    # Inline formatting: extract content
    for cmd in ("textit", "textbf", "emph", "textsc", "texttt", "textrm", "textsf",
                "underline", "MakeUppercase", "MakeLowercase"):
        # Iterative pass to handle simple (non-nested) cases
        text = re.sub(rf"\\{cmd}\{{([^{{}}]*)\}}", r"\1", text)

    # Font-size groups: {\large ...} → content
    text = re.sub(r"\{\\(?:large|small|tiny|huge|Huge|normalsize|footnotesize|scriptsize)\s+([^{}]*)\}", r"\1", text)

    # Color: {\color{x} text} and \textcolor{x}{text}
    text = re.sub(r"\{\\color\{[^}]*\}\s*([^{}]*)\}", r"\1", text)
    text = re.sub(r"\\textcolor\{[^}]*\}\{([^{}]*)\}", r"\1", text)

    # Font-feature groups: {\addfontfeatures{...} text}
    text = re.sub(r"\{\\addfontfeatures\{[^}]*\}\s*([^{}]*)\}", r"\1", text)

    # Remove remaining commands with optional args + one brace arg
    text = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{[^{}]*\}", " ", text)

    # Remove bare commands (no args)
    text = re.sub(r"\\[a-zA-Z]+\*?", " ", text)

    # Remove leftover braces
    text = text.replace("{", " ").replace("}", " ")

    # Typographic replacements
    text = text.replace("---", "—").replace("--", "–")
    text = text.replace("``", "“").replace("''", "”")
    text = text.replace("`", "‘").replace("'", "’")
    text = text.replace("~", " ")
    text = text.replace("\\ ", " ")
    text = text.replace("\\\\", "\n")

    # Normalise whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ── Chunking ──────────────────────────────────────────────────────────────────

def make_chunks(source: str, body: str) -> list[dict]:
    """Split a tex body into section-level chunks, sub-chunking long sections."""
    section_re = re.compile(r"\\(?:sub)*section\*?\{([^}]+)\}")
    boundaries = [(m.start(), m.end(), m.group(1)) for m in section_re.finditer(body)]

    if not boundaries:
        clean = strip_latex(body)
        return [{"source": source, "section": source, "text": clean}] if clean.strip() else []

    chunks = []
    for idx, (start, end, raw_title) in enumerate(boundaries):
        next_start = boundaries[idx + 1][0] if idx + 1 < len(boundaries) else len(body)
        section_body = strip_latex(body[end:next_start]).strip()
        title = strip_latex(raw_title).strip()

        if not section_body:
            continue

        words = section_body.split()
        if len(words) <= MAX_WORDS:
            chunks.append({"source": source, "section": title,
                           "text": f"{title}\n\n{section_body}"})
        else:
            # Sub-chunk on paragraph boundaries
            paragraphs = [p.strip() for p in section_body.split("\n\n") if p.strip()]
            current, count, part = [], 0, 1
            for para in paragraphs:
                pw = len(para.split())
                if count + pw > MAX_WORDS and current:
                    label = f"{title} (part {part})"
                    chunks.append({"source": source, "section": label,
                                   "text": f"{title}\n\n" + "\n\n".join(current)})
                    current, count, part = [para], pw, part + 1
                else:
                    current.append(para)
                    count += pw
            if current:
                label = f"{title} (part {part})" if part > 1 else title
                chunks.append({"source": source, "section": label,
                               "text": f"{title}\n\n" + "\n\n".join(current)})

    return chunks


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise SystemExit("ERROR: set GEMINI_API_KEY before running.")

    client = genai.Client(api_key=api_key)

    # ── Collect chunks ────────────────────────────────────────────────────────
    all_chunks = []
    for source_name, tex_path in SOURCES:
        if not tex_path.exists():
            print(f"  [skip] {tex_path.name} not found")
            continue
        body = extract_body(tex_path)
        chunks = make_chunks(source_name, body)
        print(f"  {tex_path.name}: {len(chunks)} chunks")
        all_chunks.extend(chunks)

    print(f"\nTotal chunks: {len(all_chunks)}")

    # ── Embed ─────────────────────────────────────────────────────────────────
    print(f"Embedding with {EMBED_MODEL} ...\n")
    results = []
    for i, chunk in enumerate(all_chunks):
        label = f"{chunk['source']} — {chunk['section'][:55]}"
        print(f"  [{i+1:3}/{len(all_chunks)}] {label}")
        try:
            resp = client.models.embed_content(model=EMBED_MODEL, contents=chunk["text"])
            embedding = resp.embeddings[0].values
            results.append({
                "id":        f"chunk_{i}",
                "source":    chunk["source"],
                "section":   chunk["section"],
                "text":      chunk["text"],
                "embedding": list(embedding),
            })
        except Exception as exc:
            print(f"           ERROR: {exc} — skipping chunk")
            time.sleep(5)

        time.sleep(API_DELAY)

    # ── Save ──────────────────────────────────────────────────────────────────
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Saved {len(results)} chunks → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
