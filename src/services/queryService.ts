// src/services/queryService.ts
import pool from "../config/db";
import { generateEmbedding } from "./embedingService";

/**
 * Search relevant document chunks by semantic similarity
 */
export async function searchDocumentChunks(
  documentId: string,
  query: string,
  limit = 5
) {
  // Step 1: Embed the query
  const queryEmbedding = await generateEmbedding(query);

  // Format embedding as PostgreSQL vector literal
  const vectorString = `[${queryEmbedding.join(',')}]`;

  // Step 2: Search with pgvector similarity operator
  const { rows } = await pool.query(
    `SELECT id, chunk_text, embedding
     FROM document_chunks
     WHERE document_id = $1
     ORDER BY embedding <-> $2::vector
     LIMIT $3`,
    [documentId, vectorString, limit]
  );
  return rows;
}
