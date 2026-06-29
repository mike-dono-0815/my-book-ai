import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Fork in the Road — Ask the Book",
  description: "A conversational guide to the people management and leadership ideas in The Fork in the Road.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream font-sans antialiased">{children}</body>
    </html>
  );
}
