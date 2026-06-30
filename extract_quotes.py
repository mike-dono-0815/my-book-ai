"""
Extract all \\begin{pullquote}...\\end{pullquote} blocks from the book's
tex files and save them to data/quotes.json.
"""

import re
import json
from pathlib import Path

BOOK_DIR   = Path("../my-book")
OUTPUT     = Path("data/quotes.json")

SOURCES = [
    ("Introduction",                  BOOK_DIR / "Intro.tex"),
    ("Chapter 1: The Launch Disaster", BOOK_DIR / "chapter1.tex"),
    ("Chapter 2: The Friction Point",  BOOK_DIR / "chapter2.tex"),
    ("Chapter 3: The Olympus Bet",     BOOK_DIR / "chapter3.tex"),
    ("Chapter 4: The Choice Point",    BOOK_DIR / "chapter4.tex"),
    ("Chapter 5: The AI Frontier",     BOOK_DIR / "chapter5.tex"),
    ("Conclusion",                     BOOK_DIR / "Conclusion.tex"),
]

PULLQUOTE_RE = re.compile(
    r"\\begin\{pullquote\}(.*?)\\end\{pullquote\}", re.DOTALL
)

def clean(text: str) -> str:
    # Strip LaTeX line comments: % to end of each line (handles %%, % at line end, etc.)
    text = re.sub(r"(?m)%.*$", "", text)

    # Remove formatting wrapper: {\color{...}\large\itshape ...}
    text = re.sub(r"\{\\color\{[^}]*\}[^}]*\}", lambda m: m.group(0), text)
    text = re.sub(r"\{\\color\{[^}]*\}\\large\\itshape\s*", "", text)

    # Remove any remaining LaTeX commands
    text = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{[^{}]*\}", " ", text)
    text = re.sub(r"\\[a-zA-Z]+\*?", " ", text)
    text = re.sub(r"[{}]", "", text)

    # Typographic fixes
    text = text.replace("---", "—").replace("--", "–")
    text = text.replace("``", "“").replace("''", "”")
    text = text.replace("`", "‘").replace("'", "’")
    text = text.replace("~", " ")

    # Strip outer quotation marks if the whole quote is wrapped in them
    text = text.strip()
    if text.startswith("“") and text.endswith("”"):
        text = text[1:-1].strip()

    # Normalise whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", " ", text)
    text = re.sub(r" *\n *", " ", text)

    return text.strip()


quotes = []
for source, path in SOURCES:
    if not path.exists():
        print(f"  [skip] {path.name}")
        continue
    raw = path.read_text(encoding="utf-8")
    for match in PULLQUOTE_RE.finditer(raw):
        text = clean(match.group(1))
        if text:
            quotes.append({"text": text, "source": source})
    print(f"  {path.name}: {sum(1 for q in quotes if q['source'] == source)} quotes")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(quotes, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(quotes)} quotes -> {OUTPUT}")
