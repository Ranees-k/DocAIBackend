import pool from "../config/db";

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
