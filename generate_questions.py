"""
Generate 20 questions per chapter (100 total) grounded in the book's
actual stories and mechanisms. Saves to data/questions.json.
"""

import os, json, time, sys
sys.path.insert(0, ".")
import ingest
from google import genai

OUTPUT = "data/questions.json"

CHAPTERS = [
    {
        "source": "Chapter 1: The Launch Disaster",
        "theme":  "psychological safety, blame vs. execution, speaking up under pressure",
        "path":   ingest.BOOK_DIR / "chapter1.tex",
    },
    {
        "source": "Chapter 2: The Friction Point",
        "theme":  "conflict vs. collaboration, cross-team trust, interpersonal dynamics",
        "path":   ingest.BOOK_DIR / "chapter2.tex",
    },
    {
        "source": "Chapter 3: The Olympus Bet",
        "theme":  "process vs. purpose, adaptive planning, single-threaded ownership",
        "path":   ingest.BOOK_DIR / "chapter3.tex",
    },
    {
        "source": "Chapter 4: The Choice Point",
        "theme":  "high-stakes decision-making, loud voices vs. structured decisions",
        "path":   ingest.BOOK_DIR / "chapter4.tex",
    },
    {
        "source": "Chapter 5: The AI Frontier",
        "theme":  "leading through AI adoption, command-and-control vs. empowerment",
        "path":   ingest.BOOK_DIR / "chapter5.tex",
    },
]

PROMPT_TEMPLATE = """You are reading a chapter from a people management and leadership book called "The Fork in the Road".

The chapter is: {source}
Core theme: {theme}

Here is the chapter content (LaTeX stripped):
---
{content}
---

Generate exactly 20 questions that a reader — a manager or team leader — might ask a chatbot based on this chapter.

Requirements:
- Each question must be directly grounded in the stories, characters, mechanisms, or situations from THIS chapter (not generic leadership advice)
- Questions should feel natural, as if a leader is asking for personal guidance
- Vary the scope: some about specific mechanisms (e.g. "What is the Forward Question?"), some about applying the story's lessons (e.g. "How do I handle a team member who blames others in a crisis?")
- Keep each question under 15 words
- No numbering, no bullet points — just one question per line
- Do not repeat similar questions

Output ONLY the 20 questions, one per line, nothing else."""


def extract_chapter_text(path) -> str:
    body = ingest.extract_body(path)
    # Take first 8000 words to stay within context; chapters are long
    text = ingest.strip_latex(body)
    words = text.split()
    return " ".join(words[:8000])


def main():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise SystemExit("Set GEMINI_API_KEY first.")

    client = genai.Client(api_key=api_key)
    all_questions = []

    for ch in CHAPTERS:
        print(f"\nGenerating questions for {ch['source']} ...")
        content = extract_chapter_text(ch["path"])
        prompt  = PROMPT_TEMPLATE.format(
            source=ch["source"],
            theme=ch["theme"],
            content=content,
        )

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw = resp.text.strip()
        questions = [q.strip() for q in raw.splitlines() if q.strip()][:20]
        print(f"  Got {len(questions)} questions")
        for q in questions:
            print(f"    - {q}")

        all_questions.append({
            "source":    ch["source"],
            "questions": questions,
        })
        time.sleep(2)  # polite pause between chapters

    import pathlib
    pathlib.Path(OUTPUT).parent.mkdir(exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    total = sum(len(c["questions"]) for c in all_questions)
    print(f"\nSaved {total} questions -> {OUTPUT}")


if __name__ == "__main__":
    main()
