import { type Request, type Response } from "express";
import { saveFileRecord } from "../services/uploadFileService";
import { chunkText } from "../utils/chunkText";
import fs from "fs/promises";
import pool from "../config/db";
import { generateEmbedding } from "../services/embedingService";
import  PDFParser  from "pdf2json";

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" }); return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Save file metadata in DB
    const doc = await saveFileRecord({
      userId: req.body.userId,
      filename: req.file.originalname,
      fileType: req.file.mimetype,
      fileUrl: fileUrl,
    });

    // Step 1: Extract text based on file type
    let rawText: string;

    if (req.file.mimetype === "application/pdf") {
      const pdfBuffer = await fs.readFile(req.file.path);
      
      const pdfData: any = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => resolve(pdfData));
        pdfParser.parseBuffer(pdfBuffer);
      });

      console.log("pdfData", pdfData);

      // ✅ Extract text from Pages
      rawText = pdfData.Pages.map((page: any) =>
        page.Texts.map((t: any) => decodeURIComponent(t.R[0].T)).join(" ")
      ).join("\n");

      console.log("Extracted text preview:", rawText.substring(0, 200));
    } else if (req.file.mimetype === "text/plain") {
      // Plain text
      rawText = await fs.readFile(req.file.path, "utf-8");
      console.log("rawText", rawText);
    } else {
      res.status(400).json({ error: "Unsupported file type" }); return;
    }

    // Step 2: Chunk the text
    const chunks = chunkText(rawText);

    console.log("chunks", chunks);

    // Helper to clean text
    function cleanText(text: string): string {
      return text
        .replace(/\u0000/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();
    }

    // Step 3: Process chunks → embed → save to DB
    for (const chunk of chunks) {
      const cleanedChunk = cleanText(chunk);
      if (cleanedChunk.length === 0) continue;

      const embedding = await generateEmbedding(cleanedChunk);
      console.log(embedding, "embedding");

      // Format embedding as PostgreSQL vector literal
      const vectorString = `[${embedding.join(',')}]`;
      
      await pool.query(
        `INSERT INTO document_chunks (document_id, chunk_text, embedding) 
         VALUES ($1, $2, $3::vector)`,
        [doc.id, cleanedChunk, vectorString]
      );
    }

    // Step 4: Response
    res.status(201).json({
      message: "✅ Document uploaded successfully",
      document: doc,
      chunks: chunks.length,
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};
