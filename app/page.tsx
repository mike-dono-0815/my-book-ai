import fs from "fs";
import path from "path";
import ChatPage from "./chat-page";

interface Quote    { text: string; source: string }
interface Chapter  { source: string; questions: string[] }

export default function Page() {
  const dataDir = path.join(process.cwd(), "data");

  // Today's quote — rotates daily
  const quotes: Quote[] = JSON.parse(fs.readFileSync(path.join(dataDir, "quotes.json"), "utf-8"));
  const day   = Math.floor(Date.now() / 86_400_000);
  const quote = quotes[day % quotes.length];

  // All chapter questions — flattened into one pool
  const questionsPath = path.join(dataDir, "questions.json");
  const allQuestions: string[] = fs.existsSync(questionsPath)
    ? (JSON.parse(fs.readFileSync(questionsPath, "utf-8")) as Chapter[]).flatMap((c) => c.questions)
    : [];

  return <ChatPage initialQuote={quote} allQuestions={allQuestions} />;
}
