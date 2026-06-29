import path from "path";
import fs from "fs";

export interface Chunk {
  id: string;
  source: string;
  section: string;
  text: string;
  embedding: number[];
}

// Module-level cache — persists across warm serverless invocations
let cache: Chunk[] | null = null;

export function loadChunks(): Chunk[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "book-embeddings.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  cache = JSON.parse(raw) as Chunk[];
  return cache;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function findTopChunks(queryEmbedding: number[], k = 5): Chunk[] {
  const chunks = loadChunks();
  return chunks
    .map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.chunk);
}
