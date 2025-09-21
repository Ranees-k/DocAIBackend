import pool from "../config/db";
import { IntelligentChunk } from "../utils/intelligentChunking";

export const saveDocumentChunks = async (
  documentId: string,
  chunks: { text: string; embedding: number[] }[]
) => {
  const values = chunks.map(
    (c) => `('${documentId}', $${chunks.indexOf(c) * 2 + 1}, $${chunks.indexOf(c) * 2 + 2})`
  );

  const flatParams = chunks.flatMap((c) => [c.text, c.embedding]);

  const query = `
    INSERT INTO document_chunks (document_id, chunk_text, embedding)
    VALUES ${chunks
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
      .join(", ")}
    RETURNING id;
  `;

  const params = [documentId, ...flatParams];
  return pool.query(query, params);
};

export const saveIntelligentDocumentChunks = async (
  documentId: string,
  chunks: Array<IntelligentChunk & { metadata: IntelligentChunk['metadata'] & { embedding?: number[] } }>
) => {
  const query = `
    INSERT INTO document_chunks (
      document_id, 
      chunk_text, 
      embedding, 
      heading, 
      heading_level, 
      section, 
      page_number, 
      chunk_index, 
      total_chunks, 
      word_count, 
      char_count, 
      start_position, 
      end_position, 
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id;
  `;

  const results: any[] = [];
  
  for (const chunk of chunks) {
    const { rows } = await pool.query(query, [
      documentId,
      chunk.text,
      JSON.stringify(chunk.metadata.embedding || []), // Store embedding as JSON string
      chunk.metadata.heading || null,
      chunk.metadata.headingLevel || null,
      chunk.metadata.section || null,
      chunk.metadata.pageNumber || null,
      chunk.metadata.chunkIndex,
      chunk.metadata.totalChunks,
      chunk.metadata.wordCount,
      chunk.metadata.charCount,
      chunk.metadata.startPosition,
      chunk.metadata.endPosition,
      JSON.stringify(chunk.metadata) // Store full metadata as JSONB
    ]);
    results.push(rows[0]);
  }

  return results;
};
