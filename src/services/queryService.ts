// src/services/queryService.ts
import pool from "../config/db";
import { generateEmbedding } from "./embedingService";

/**
 * Search relevant document chunks by semantic similarity
 * Note: This is a simplified version that works with TEXT embeddings
 * For production, consider using pgvector extension or Supabase vector search
 */
export async function searchDocumentChunks(
  documentId: string,
  query: string,
  limit = 5
) {
  // Step 1: Embed the query
  const queryEmbedding = await generateEmbedding(query);

  // Step 2: Get all chunks for the document
  const { rows } = await pool.query(
    `SELECT id, chunk_text, embedding
     FROM document_chunks
     WHERE document_id = $1`,
    [documentId]
  );

  // Step 3: Calculate similarity in JavaScript (simplified approach)
  const chunksWithSimilarity = rows.map(row => {
    const storedEmbedding = JSON.parse(row.embedding);
    // Simple cosine similarity calculation
    const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding);
    return {
      ...row,
      similarity
    };
  });

  // Step 4: Sort by similarity and return top results
  return chunksWithSimilarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
