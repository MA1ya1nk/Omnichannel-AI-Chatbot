import { Mistral } from "@mistralai/mistralai";
import { prisma } from "../prisma.js";
import { env } from "../env.js";

const EMBEDDING_MODEL = "mistral-embed";
const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });

function splitIntoChunks(text: string, maxChars = 1200): string[] {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

async function createEmbedding(text: string): Promise<number[]> {
  const response = (await client.embeddings.create({
    model: EMBEDDING_MODEL,
    inputs: [text]
  })) as unknown as {
    data?: Array<{ embedding?: number[] }>;
  };

  const vector = response.data?.[0]?.embedding;
  if (!vector || vector.length === 0) {
    throw new Error("Failed to generate embedding vector.");
  }
  return vector;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function ingestKnowledgeDocument(input: {
  title: string;
  mimeType: string;
  rawText: string;
  uploadedBy?: string;
}) {
  const chunks = splitIntoChunks(input.rawText);
  if (chunks.length === 0) {
    throw new Error("No readable text found in uploaded document.");
  }

  const document = await prisma.knowledgeDocument.create({
    data: {
      title: input.title,
      mimeType: input.mimeType,
      uploadedBy: input.uploadedBy
    }
  });

  for (const chunk of chunks) {
    const embedding = await createEmbedding(chunk);
    await prisma.knowledgeChunk.create({
      data: {
        documentId: document.id,
        content: chunk,
        embedding
      }
    });
  }

  return { id: document.id, title: document.title, chunks: chunks.length };
}

export async function retrieveKnowledgeContext(query: string, topK = 4): Promise<string | null> {
  const normalized = query.trim();
  if (!normalized) {
    return null;
  }

  const queryEmbedding = await createEmbedding(normalized);
  const chunks = await prisma.knowledgeChunk.findMany({
    include: { document: true },
    take: 300
  });

  if (chunks.length === 0) {
    return null;
  }

  const ranked = chunks
    .map((chunk: (typeof chunks)[number]) => {
      const embedding = Array.isArray(chunk.embedding) ? (chunk.embedding as number[]) : [];
      return {
        chunk,
        score: cosineSimilarity(queryEmbedding, embedding)
      };
    })
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, topK)
    .filter((item: { score: number }) => item.score > 0.15);

  if (ranked.length === 0) {
    return null;
  }

  return ranked
    .map(
      ({ chunk }: { chunk: (typeof chunks)[number] }, index: number) =>
        `[Doc ${index + 1}: ${chunk.document.title}]\n${chunk.content.replace(/\s+/g, " ").trim()}`
    )
    .join("\n\n");
}
