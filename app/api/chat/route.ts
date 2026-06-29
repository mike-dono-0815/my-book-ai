import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { findTopChunks } from "@/lib/embeddings";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are a warm, knowledgeable guide based on "The Fork in the Road" — a book about people management and leadership, written from first-hand experience leading teams at Amazon.

Your job is to help readers apply the book's ideas to their own leadership challenges.

When answering:
- Draw primarily from the book excerpts provided below.
- If the question isn't covered by those excerpts, draw on your general knowledge of people management and leadership — but keep the same warm, practical, story-grounded tone the book uses.
- Be conversational and direct. Avoid bullet-point lists unless the question genuinely calls for one.
- Keep answers focused — a few well-crafted paragraphs is usually better than an essay.
- Never reproduce large passages verbatim; synthesise and make the ideas your own in the answer.

CRITICAL — never assume the reader has read the book:
- Do not say "remember the lesson from X" or "as you'll recall from Chapter Y" or "as discussed in the book".
- Whenever you reference a named story, moment, or mechanism from the book, always introduce it briefly in your own words first.
  Use this pattern: "In the book (Chapter X), there is a moment where [one or two sentences describing the situation, what happened, and what it revealed — Situation / Behavior / Impact]."
- Then draw the lesson or apply it to the reader's question.
- The answer must make complete sense to someone who has never opened the book.`;

export interface SourceRef {
  source: string;
  section: string;
}

export interface PullQuote {
  text: string;
  source: string;
}

const allQuotes: PullQuote[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data/quotes.json"), "utf-8")
);

function pickQuoteForChapter(chapterSource: string): PullQuote | null {
  const pool = allQuotes.filter((q) => q.source === chapterSource);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function POST(req: NextRequest) {
  const { message } = await req.json() as { message: string };

  if (!message?.trim()) {
    return new Response("Message required", { status: 400 });
  }

  // Guard: embeddings not ready yet
  const { loadChunks: checkChunks } = await import("@/lib/embeddings");
  if (checkChunks().length === 0) {
    return new Response(
      JSON.stringify({ sources: [] }) + "\n" +
      "The book index is still being built — this takes about 20 minutes on first run. Please try again shortly!",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // 1. Embed the user's question
  const embedResult = await ai.models.embedContent({
    model: "models/gemini-embedding-2",
    contents: message,
  });
  const queryEmbedding = embedResult.embeddings![0].values as number[];

  // 2. Find the most relevant book passages
  const topChunks = findTopChunks(queryEmbedding, 5);
  const context = topChunks
    .map((c) => `[${c.source} — ${c.section}]\n${c.text}`)
    .join("\n\n---\n\n");

  const sources: SourceRef[] = topChunks.map((c) => ({
    source: c.source,
    section: c.section,
  }));

  // Pick a pull quote from the same chapter as the top result
  const pullquote = topChunks[0] ? pickQuoteForChapter(topChunks[0].source) : null;

  // 3. Stream response — first line is JSON metadata, rest is streamed text
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    config: { systemInstruction: SYSTEM_PROMPT },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Relevant excerpts from the book:\n\n${context}\n\n---\n\nQuestion: ${message}`,
          },
        ],
      },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // First chunk: metadata JSON on its own line — client parses this
      controller.enqueue(encoder.encode(JSON.stringify({ sources, pullquote }) + "\n"));
      try {
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
