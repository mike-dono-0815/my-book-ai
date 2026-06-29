"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import type { SourceRef } from "./api/chat/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// Fallback questions used before data/questions.json is generated
const FALLBACK_QUESTIONS = [
  "What is psychological safety and why does it matter?",
  "How should a leader respond when things go wrong?",
  "What makes the difference between a high-performing and a struggling team?",
  "How do you build trust between teams in conflict?",
  "What is single-threaded ownership?",
  "How do you make better decisions under pressure?",
];

// ── Book data ─────────────────────────────────────────────────────────────────

const CHAPTERS = [
  { id: "intro", label: "Introduction" },
  { id: "ch1",   label: "The Launch Disaster", num: 1 },
  { id: "ch2",   label: "The Friction Point",  num: 2 },
  { id: "ch3",   label: "The Olympus Bet",     num: 3 },
  { id: "ch4",   label: "The Choice Point",    num: 4 },
  { id: "ch5",   label: "The AI Frontier",     num: 5 },
  { id: "concl", label: "Conclusion" },
];

const RELATED_FALLBACK = ["Building Trust", "Intelligent Failure", "The Friction Point"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Quote { text: string; source: string }

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  streaming?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatPage({
  initialQuote,
  allQuestions,
}: {
  initialQuote: Quote;
  allQuestions: string[];
}) {
  const pool = allQuestions.length >= 4 ? allQuestions : FALLBACK_QUESTIONS;

  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [activeSources, setActiveSources] = useState<SourceRef[]>([]);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [suggested, setSuggested]         = useState<string[]>(() => pickRandom(pool, 4));
  const bottomRef                         = useRef<HTMLDivElement>(null);
  const inputRef                          = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let metaDone = false;
      let leftover = "";
      let accumulated = "";
      let latestSources: SourceRef[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });

        if (!metaDone) {
          leftover += raw;
          const nl = leftover.indexOf("\n");
          if (nl !== -1) {
            try {
              const meta = JSON.parse(leftover.slice(0, nl));
              if (meta.sources) {
                latestSources = meta.sources as SourceRef[];
                setActiveSources(latestSources);
              }
            } catch { /* treat as text */ }
            metaDone = true;
            accumulated = leftover.slice(nl + 1);
            leftover = "";
          }
        } else {
          accumulated += raw;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated, streaming: true };
          return updated;
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: accumulated, sources: latestSources };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
        return updated;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); send(input); }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  const relatedChapters = activeSources.length
    ? [...new Set(activeSources.map((s) => s.source))]
    : RELATED_FALLBACK;

  return (
    <div className="flex h-screen overflow-hidden bg-paper font-sans text-ink">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-[272px] flex-none flex flex-col bg-rail border-r border-line">

        <div className="px-[22px] pt-6 pb-[18px]">
          <p className="font-serif text-[20px] font-semibold leading-[1.12] text-ink">The Fork<br />in the Road</p>
          <p className="font-serif italic text-[13px] text-clay mt-[7px]">Your reading companion</p>
        </div>

        <div className="px-4">
          <button
            onClick={() => { setMessages([]); setActiveSources([]); setActiveChapter(null); setSuggested(pickRandom(pool, 4)); }}
            className="w-full flex items-center gap-[9px] px-[14px] py-[10px] rounded-[11px] border border-[#C9A77B] text-claydeep text-[13px] font-medium hover:bg-[#E4D3B8] transition-colors"
          >
            <span className="text-base leading-none -mt-px">+</span> New conversation
          </button>
        </div>

        <p className="px-[22px] pt-[22px] pb-2 text-[10px] font-semibold tracking-[1.6px] uppercase text-faint">
          Browse the book
        </p>
        <nav className="px-[11px] flex flex-col gap-px overflow-y-auto overflow-x-hidden flex-1">
          {CHAPTERS.map((ch) => {
            const active = activeChapter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => { setActiveChapter(ch.id); send(`Tell me about "${ch.label}" from the book.`); }}
                className={`flex items-center gap-[10px] px-3 py-2 rounded-lg text-left text-[13px] transition-colors ${
                  active ? "bg-navsel text-ink font-medium" : "text-[#5E574A] hover:bg-navhover"
                }`}
              >
                {ch.num
                  ? <span className={`font-serif ${active ? "text-clay" : "text-[#B59B6E]"}`}>{ch.num}</span>
                  : <span className="w-[7px] inline-block" />}
                <span className="truncate">{ch.label}</span>
              </button>
            );
          })}

          <div className="h-px bg-line mx-3 my-[9px]" />

          <button
            onClick={() => send("Give me an overview of the 50 mechanisms in the book.")}
            className="flex items-center justify-between px-3 py-[9px] rounded-lg text-[13px] text-ink hover:bg-navhover transition-colors"
          >
            The 50 Mechanisms
            <span className="font-serif text-[11px] text-white bg-clay rounded-full px-2 py-0.5">50</span>
          </button>
        </nav>

        <div className="p-[14px] border-t border-line">
          <div className="flex items-center gap-3 p-[9px] rounded-[10px] hover:bg-[#E4D3B8] transition-colors cursor-pointer">
            <div className="w-10 h-[54px] flex-none rounded-[3px] overflow-hidden shadow-sm">
              <Image src="/title-page.png" alt="The Fork in the Road" width={40} height={54} className="object-cover w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink leading-snug">About the book</p>
              <p className="text-[11px] text-muted leading-snug mt-0.5">Michael Donoser</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Center: chat ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="flex-none px-8 py-[17px] border-b border-linesoft flex items-baseline gap-[9px]">
          <span className="text-[12px] text-faint">Reading companion for</span>
          <span className="font-serif italic text-base text-ink">The Fork in the Road</span>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[680px] mx-auto px-8 pt-7 pb-9">

            {messages.length === 0 && (
              <div className="mt-2">
                <p className="text-center text-faint text-[13px] mb-5">Not sure where to start? Try one of these:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggested.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-left px-4 py-3 rounded-xl border border-cardEdge bg-card hover:border-clay hover:bg-claysoft transition-colors text-[13.5px] text-[#5E574A] leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end mb-6">
                  <div className="max-w-[80%] bg-claysoft text-[#3A3225] rounded-[16px] rounded-tr-[4px] px-[17px] py-3 text-[15px] leading-[1.55] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-[14px] mb-6">
                  <div className="flex-none w-[30px] h-[30px] rounded-full bg-clay text-[#FBF6EA] flex items-center justify-center font-serif text-[15px] mt-0.5">F</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] tracking-[0.4px] text-faint mb-2">Companion</p>
                    <div className={`prose prose-sm max-w-none text-[15px] leading-[1.72] text-[#33302A]
                        prose-p:my-0 prose-p:mb-[13px] prose-strong:text-claydeep prose-strong:font-semibold
                        prose-li:my-0 prose-li:mb-[9px] prose-ol:my-0 prose-ol:mb-[15px] prose-ul:my-0 prose-ul:mb-[15px]
                        ${msg.streaming ? "cursor" : ""}`}>
                      {msg.content ? <ReactMarkdown>{msg.content}</ReactMarkdown> : "…"}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <p className="text-[11.5px] text-muted mt-4">
                        From <span className="text-[#5E574A] font-semibold">{[...new Set(msg.sources.map((s) => s.source))][0]}</span>
                        {msg.sources[0]?.section ? <> · {msg.sources[0].section}</> : null}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <footer className="flex-none px-8 pt-[14px] pb-5 border-t border-linesoft">
          <form onSubmit={onSubmit} className="max-w-[680px] mx-auto flex items-end gap-[10px] bg-card border border-line rounded-[16px] pl-[18px] pr-[7px] py-[7px]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything about leadership or people management…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-transparent py-2 text-[14.5px] text-[#33302A] placeholder-[#B0A485] focus:outline-none leading-relaxed"
              style={{ maxHeight: "8rem", overflowY: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex-none w-[38px] h-[38px] rounded-[12px] bg-clay text-[#FBF6EA] hover:bg-claydeep disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-[17px]"
            >
              ↑
            </button>
          </form>
          <p className="max-w-[680px] mx-auto mt-2 text-center text-[11px] text-[#B0A485]">
            Answers draw from the book and general leadership knowledge · Shift+Enter for new line
          </p>
        </footer>
      </main>

      {/* ── Right sidebar ────────────────────────────────────────────────── */}
      <aside className="w-[300px] flex-none flex flex-col bg-[#EFE7D7] border-l border-line overflow-y-auto">

        <div className="px-[22px] pt-[22px] pb-5 border-b border-linesoft">
          <p className="text-[10px] font-semibold tracking-[1.6px] uppercase text-faint mb-3">Today&apos;s reflection</p>
          <p className="font-serif italic text-[16.5px] leading-[1.5] text-[#352F26]">
            &ldquo;{initialQuote.text}&rdquo;
          </p>
          <p className="text-[11.5px] text-muted mt-3">— {initialQuote.source}</p>
          <div className="flex gap-4 mt-[14px]">
            <button
              onClick={() => navigator.clipboard.writeText(`"${initialQuote.text}" — ${initialQuote.source}`)}
              className="text-[12px] text-muted hover:text-clay transition-colors"
            >
              Copy
            </button>
            <button className="text-[12px] text-muted hover:text-clay transition-colors">Save</button>
          </div>
        </div>

        {activeSources.length > 0 && (
          <div className="px-[22px] pt-[22px] pb-[18px] border-b border-linesoft">
            <p className="text-[10px] font-semibold tracking-[1.6px] uppercase text-faint mb-[14px]">In this answer</p>
            <div className="flex flex-col gap-[14px]">
              {[...new Map(activeSources.map((s) => [s.source, s])).values()].map((s) => (
                <div key={s.source} className="flex gap-[11px]">
                  <span className="flex-none w-[7px] h-[7px] rounded-[2px] bg-clay mt-[6px]" />
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{s.source}</p>
                    <p className="text-[11.5px] text-muted mt-0.5">{s.section}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-[22px] py-[22px]">
          <p className="text-[10px] font-semibold tracking-[1.6px] uppercase text-faint mb-3">Related</p>
          <div className="flex flex-col gap-[3px]">
            {relatedChapters.map((src) => (
              <button
                key={src}
                onClick={() => send(`Tell me more about ${src} from the book.`)}
                className="flex items-center justify-between px-[11px] py-[9px] rounded-[9px] text-[13px] text-[#5E574A] hover:bg-[#E4D3B8] transition-colors text-left"
              >
                <span className="truncate">{src}</span>
                <span className="text-[#C9A77B]">›</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
