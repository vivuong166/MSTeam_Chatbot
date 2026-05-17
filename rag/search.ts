import fetch from "node-fetch";
import fs from "fs";

const docs: string[] = JSON.parse(
  fs.readFileSync("./src/rag/data.json", "utf-8")
);

async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text
    })
  });

  const data = await res.json();
  return data.data[0].embedding;
}

function cosine(a: number[], b: number[]) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (normA * normB);
}

export async function searchRelevant(query: string) {
  const qVec = await embed(query);

  const scored = [];

  for (let doc of docs) {
    const dVec = await embed(doc);
    const score = cosine(qVec, dVec);
    scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(s => s.doc);
}