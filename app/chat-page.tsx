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
  { id: "intro", label: "Introduction",            icon: <IconBook /> },
  { id: "ch1",   label: "The Launch Disaster",     icon: <IconBolt /> },
  { id: "ch2",   label: "The Friction Point",      icon: <IconHandshake /> },
  { id: "ch3",   label: "The Olympus Bet",         icon: <IconMountain /> },
  { id: "ch4",   label: "The Choice Point",        icon: <IconFork /> },
  { id: "ch5",   label: "The AI Frontier",         icon: <IconCpu /> },
  { id: "concl", label: "Conclusion",              icon: <IconCheck /> },
];

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

  return (
    <div className="flex h-screen overflow-hidden bg-cream font-sans">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 flex-none flex flex-col border-r border-stone-200 bg-white overflow-y-auto">

        <div className="px-5 py-5 border-b border-stone-100">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center flex-none">
              <IconBookOpen className="w-4 h-4 text-gold" />
            </div>
            <div>
              <p className="text-navy font-semibold text-xs tracking-widest uppercase leading-none">The Fork</p>
              <p className="text-navy font-semibold text-xs tracking-widest uppercase leading-none">in the Road</p>
            </div>
          </div>
          <p className="mt-1.5 text-gold text-xs italic font-medium pl-[42px]">Wisdom. Applied.</p>
        </div>

        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => { setMessages([]); setActiveSources([]); setActiveChapter(null); setSuggested(pickRandom(pool, 4)); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-navy/5 hover:bg-navy/10 text-navy text-sm font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span> New conversation
          </button>
        </div>

        <div className="px-3 py-2 flex-1">
          <p className="px-2 py-1 text-[10px] font-semibold tracking-widest text-stone-400 uppercase mb-1">
            Browse the Book
          </p>
          <nav className="space-y-0.5">
            {CHAPTERS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => { setActiveChapter(ch.id); send(`Tell me about "${ch.label}" from the book.`); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
                  activeChapter === ch.id
                    ? "bg-amber-50 text-navy font-medium"
                    : "text-stone-600 hover:bg-stone-50 hover:text-navy"
                }`}
              >
                <span className={`flex-none w-5 h-5 ${activeChapter === ch.id ? "text-gold" : "text-stone-400"}`}>
                  {ch.icon}
                </span>
                <span className="truncate leading-snug">{ch.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-stone-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-amber-50 transition-colors cursor-pointer">
            <div className="w-12 h-16 flex-none rounded overflow-hidden shadow-sm">
              <Image src="/title-page.png" alt="The Fork in the Road" width={48} height={64} className="object-cover w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-navy leading-snug">About the book</p>
              <p className="text-[11px] text-stone-400 leading-snug mt-0.5">Leadership stories from Amazon &amp; beyond</p>
            </div>
            <IconChevronRight className="flex-none w-4 h-4 text-stone-300" />
          </div>
        </div>
      </aside>

      {/* ── Center: chat ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="flex-none px-6 py-4 border-b border-stone-200 bg-white">
          <p className="text-stone-400 text-sm">Your AI companion based on</p>
          <p className="text-navy font-semibold text-lg leading-tight italic">The Fork in the Road</p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="mt-6">
              <p className="text-center text-stone-400 text-sm mb-5">Not sure where to start? Try one of these:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {suggested.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-left px-4 py-3 rounded-xl border border-stone-200 bg-white hover:border-gold hover:bg-amber-50 transition-colors text-sm text-stone-600 leading-snug shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex-none w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                msg.role === "user" ? "bg-stone-200 text-stone-500" : "bg-navy"
              }`}>
                {msg.role === "user" ? "You" : <IconBookOpen className="w-4 h-4 text-gold" />}
              </div>
              {msg.role === "user" ? (
                <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-stone-100 text-stone-700">
                  {msg.content}
                </div>
              ) : (
                <div className={`max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-white border border-stone-200 text-stone-700 shadow-sm prose prose-sm prose-stone max-w-none ${msg.streaming ? "cursor" : ""}`}>
                  {msg.content
                    ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                    : "…"}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <footer className="flex-none px-6 py-4 border-t border-stone-200 bg-white">
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything about leadership or people management…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold disabled:opacity-50 leading-relaxed"
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
              className="flex-none w-10 h-10 rounded-xl bg-navy hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <IconArrowUp className="w-4 h-4 text-gold" />
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-stone-300">
            Answers draw from the book and general leadership knowledge · Shift+Enter for new line
          </p>
        </footer>
      </main>

      {/* ── Right sidebar ────────────────────────────────────────────────── */}
      <aside className="w-72 flex-none flex flex-col border-l border-stone-200 bg-white overflow-y-auto">

        <div className="p-5 border-b border-stone-100">
          <p className="text-[10px] font-semibold tracking-widest text-stone-400 uppercase mb-3">Today&apos;s Quote</p>
          <div className="relative">
            <IconQuote className="w-6 h-6 text-gold/40 mb-1" />
            <p className="text-navy text-[15px] font-medium leading-relaxed italic">
              &ldquo;{initialQuote.text}&rdquo;
            </p>
            <p className="mt-3 text-xs text-stone-400">— {initialQuote.source}</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => navigator.clipboard.writeText(`"${initialQuote.text}" — ${initialQuote.source}`)}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-navy transition-colors"
            >
              <IconCopy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>

        {activeSources.length > 0 && (
          <div className="p-5 border-b border-stone-100">
            <p className="text-[10px] font-semibold tracking-widest text-stone-400 uppercase mb-3">In This Answer</p>
            <div className="space-y-3">
              {[...new Map(activeSources.map((s) => [s.source, s])).values()].map((s) => (
                <div key={s.source} className="flex gap-2.5">
                  <IconBook className="flex-none w-4 h-4 text-gold mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-navy">{s.source}</p>
                    <p className="text-[11px] text-stone-400 leading-snug">{s.section}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSources.length > 0 && (
          <div className="p-5">
            <p className="text-[10px] font-semibold tracking-widest text-stone-400 uppercase mb-3">Related Chapters</p>
            <div className="space-y-1.5">
              {[...new Set(activeSources.map((s) => s.source))].map((src) => (
                <button
                  key={src}
                  onClick={() => send(`Tell me more about ${src} from the book.`)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-amber-50 hover:text-navy transition-colors text-left"
                >
                  <span className="truncate">{src}</span>
                  <IconChevronRight className="flex-none w-4 h-4 text-stone-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSources.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-xs text-stone-300 text-center leading-relaxed">
              Ask a question to see which parts of the book were used to answer it.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconBook({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}
function IconBookOpen({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}
function IconBolt({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}
function IconHandshake({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}
function IconMountain({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2.25a2.25 2.25 0 0 1 0 4.5H3m0 0h18M3 3v18m4.5-5.25h9" />
    </svg>
  );
}
function IconFork({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}
function IconCpu({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
    </svg>
  );
}
function IconCheck({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
function IconChevronRight({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}
function IconArrowUp({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
    </svg>
  );
}
function IconQuote({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.51.884-3.995 3.026-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.511.884-3.996 3.026-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  );
}
function IconCopy({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  );
}
