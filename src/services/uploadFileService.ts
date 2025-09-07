import pool from "../config/db.js";

interface DocumentRecord {
  userId: string;
  filename: string;
  fileType: string;
  fileUrl: string;
}

export const saveFileRecord = async (doc: DocumentRecord) => {
  const result = await pool.query(
    `INSERT INTO documents (user_id, filename, file_type, file_url) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [doc.userId, doc.filename, doc.fileType, doc.fileUrl]
  );

  return result.rows[0];
};
