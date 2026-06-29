import fs from "fs";
import path from "path";
import ChatPage from "./chat-page";

interface Quote {
  text: string;
  source: string;
}

export default function Page() {
  const filePath = path.join(process.cwd(), "data", "quotes.json");
  const quotes: Quote[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Rotate daily
  const day = Math.floor(Date.now() / 86_400_000);
  const quote = quotes[day % quotes.length];

  return <ChatPage initialQuote={quote} />;
}
