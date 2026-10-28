import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const dataPath = path.resolve(process.cwd(), "rag", "data.json");
const rawDocs = fs.readFileSync(dataPath, "utf-8").trim();
const docs: string[] = rawDocs ? JSON.parse(rawDocs) : [];

type EmbeddingResponse = {
  embedding?: { values?: number[] };
  error?: { message?: string };
};

async function embed(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        taskType,
        content: { parts: [{ text }] }
      })
    }
  );

  const data = (await res.json()) as EmbeddingResponse;
  if (!res.ok || !data.embedding?.values) {
    throw new Error(data.error?.message || "Gemini embedding request failed");
  }

  return data.embedding.values;
}

function cosine(a: number[], b: number[]) {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

export async function searchRelevant(query: string) {
  const queryEmbedding = await embed(query, "RETRIEVAL_QUERY");
  const scored = await Promise.all(
    docs.map(async (doc) => ({
      doc,
      score: cosine(await embed(doc, "RETRIEVAL_DOCUMENT"), queryEmbedding)
    }))
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.doc);
}
