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

  // Step 2: Handle documentId - if it's a UUID string, we need to find the actual document
  let actualDocumentId = documentId;
  
  // Check if documentId is a UUID string (not a number)
  if (isNaN(Number(documentId))) {
    console.log(`Document ID is UUID string: ${documentId}, searching for document by UUID`);
    // For now, we'll search all chunks since we don't have UUID mapping
    // In a real implementation, you'd want to add a UUID field to documents table
    const { rows } = await pool.query(
      `SELECT id, chunk_text, embedding
       FROM document_chunks
       ORDER BY created_at DESC
       LIMIT 100` // Limit to recent chunks to avoid performance issues
    );
    
    // Calculate similarity for all chunks
    const chunksWithSimilarity = rows.map(row => {
      const storedEmbedding = JSON.parse(row.embedding);
      const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding);
      return {
        ...row,
        similarity
      };
    });

    return chunksWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // Step 3: Get all chunks for the document (normal integer ID case)
  const { rows } = await pool.query(
    `SELECT id, chunk_text, embedding
     FROM document_chunks
     WHERE document_id = $1`,
    [actualDocumentId]
  );

  // Step 4: Calculate similarity in JavaScript (simplified approach)
  const chunksWithSimilarity = rows.map(row => {
    const storedEmbedding = JSON.parse(row.embedding);
    // Simple cosine similarity calculation
    const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding);
    return {
      ...row,
      similarity
    };
  });

  // Step 5: Sort by similarity and return top results
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
