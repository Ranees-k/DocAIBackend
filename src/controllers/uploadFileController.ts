import { type Request, type Response } from "express";
import { saveFileRecord } from "../services/uploadFileService";
import { chunkText } from "../utils/chunkText";
// import { chunkTextIntelligently, chunkPDFTextIntelligently, ChunkingOptions, IntelligentChunk } from "../utils/intelligentChunking";
import { saveIntelligentDocumentChunks } from "../services/chunkService";
import { getChunkingStrategy, validateChunkingOptions } from "../config/chunkingConfig";
import fs from "fs/promises";
import pool from "../config/db";
import { generateEmbedding } from "../services/embedingService";
import  PDFParser  from "pdf2json";
import { chunkTextIntelligently, chunkPDFTextIntelligently, ChunkingOptions, IntelligentChunk } from 'intelligent-text-chunking'

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" }); return;
    }

    // Check file size (limit to 5MB for Render free tier)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxFileSize) {
      res.status(400).json({ 
        error: "File too large. Maximum size is 5MB for free tier." 
      }); 
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    let pageBreaks: number[] = [];

    // Save file metadata in DB first
    const doc = await saveFileRecord({
      userId: req.body.userId,
      filename: req.file.originalname,
      fileType: req.file.mimetype,
      fileUrl: fileUrl,
    });

    // Send immediate response to prevent timeout
    res.status(201).json({
      message: "✅ File uploaded successfully. Processing in background...",
      document: doc,
      processing: true
    });

    // Process file asynchronously to prevent timeout
    processFileAsync(req.file, doc.id, pageBreaks).catch(error => {
      console.error("❌ Background processing error:", error);
      // Update document status in DB to indicate failure
      pool.query(
        "UPDATE documents SET status = 'failed', error_message = $1 WHERE id = $2",
        [error.message, doc.id]
      );
    });

  } catch (err: any) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Async file processing function to prevent timeouts
async function processFileAsync(file: Express.Multer.File, docId: number, pageBreaks: number[]): Promise<void> {
  try {
    console.log(`🔄 Starting background processing for document ${docId}`);
    
    // Update status to processing
    await pool.query(
      "UPDATE documents SET status = 'processing' WHERE id = $1",
      [docId]
    );

    // Step 1: Extract text based on file type
    let rawText: string;

    if (file.mimetype === "application/pdf") {
      const pdfBuffer = await fs.readFile(file.path);
      
      const pdfData: any = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => resolve(pdfData));
        pdfParser.parseBuffer(pdfBuffer);
      });

      // ✅ Extract text from Pages
      rawText = pdfData.Pages.map((page: any) =>
        page.Texts.map((t: any) => decodeURIComponent(t.R[0].T)).join(" ")
      ).join("\n");

      // Calculate page breaks based on actual PDF page structure
      let currentPosition = 0;
      
      // Use the actual page data to determine page breaks
      for (let i = 0; i < pdfData.Pages.length - 1; i++) {
        const pageText = pdfData.Pages[i].Texts.map((t: any) => decodeURIComponent(t.R[0].T)).join(" ");
        currentPosition += pageText.length + 1; // +1 for the newline we add
        pageBreaks.push(currentPosition);
      }

    } else if (file.mimetype === "text/plain") {
      // Plain text
      rawText = await fs.readFile(file.path, "utf-8");
    } else {
      throw new Error("Unsupported file type");
    }

    console.log(`📄 Extracted text for document ${docId}, length: ${rawText.length}`);

    // Step 2: Intelligent chunking configuration
    const strategy = getChunkingStrategy(file.mimetype);

    const options: ChunkingOptions = {
      maxChunkSize: 800,        // Reduced for faster processing
      minChunkSize: 150,        // Reduced minimum chunk size
      overlapSize: 50,          // Reduced overlap
      respectHeadingBoundaries: true,
      respectParagraphBoundaries: true,
      respectSentenceBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 6
    };

    // Step 3: Intelligent chunking based on file type
    let intelligentChunks;

    if (file.mimetype === "application/pdf") {
      intelligentChunks = chunkPDFTextIntelligently(rawText, pageBreaks, options);
    } else {
      intelligentChunks = chunkTextIntelligently(rawText, options);
    }

    console.log(`📦 Created ${intelligentChunks.length} chunks for document ${docId}`);

    // Helper to clean text
    function cleanText(text: string): string {
      return text
        .replace(/\u0000/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();
    }

    // Step 4: Process chunks in batches to avoid memory issues
    const batchSize = 5; // Process 5 chunks at a time
    const chunksWithEmbeddings: Array<IntelligentChunk & { metadata: IntelligentChunk['metadata'] & { embedding?: number[] } }> = [];
    
    for (let i = 0; i < intelligentChunks.length; i += batchSize) {
      const batch = intelligentChunks.slice(i, i + batchSize);
      
      for (const chunk of batch) {
        const cleanedChunk = cleanText(chunk.text);
        if (cleanedChunk.length === 0) continue;

        try {
          const embedding = await generateEmbedding(cleanedChunk);
          
          chunksWithEmbeddings.push({
            text: cleanedChunk,
            metadata: {
              ...chunk.metadata,
              embedding: embedding
            }
          });
        } catch (embeddingError) {
          console.error(`❌ Embedding error for chunk ${i}:`, embeddingError);
          // Continue with other chunks even if one fails
        }
      }
      
      // Small delay between batches to prevent overwhelming the API
      if (i + batchSize < intelligentChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Save all chunks with metadata to database
    await saveIntelligentDocumentChunks(docId.toString(), chunksWithEmbeddings);

    // Update status to completed
    await pool.query(
      "UPDATE documents SET status = 'completed', processed_at = NOW() WHERE id = $1",
      [docId]
    );

    console.log(`✅ Successfully processed document ${docId} with ${chunksWithEmbeddings.length} chunks`);

    // Clean up uploaded file (since Render's filesystem is ephemeral)
    try {
      await fs.unlink(file.path);
      console.log(`🗑️ Cleaned up file: ${file.path}`);
    } catch (cleanupError) {
      console.error("⚠️ Failed to cleanup file:", cleanupError);
    }

  } catch (error: any) {
    console.error(`❌ Background processing failed for document ${docId}:`, error);
    
    // Update status to failed
    await pool.query(
      "UPDATE documents SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message, docId]
    );
    
    throw error;
  }
}

// Get document processing status
export const getDocumentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    
    const result = await pool.query(
      "SELECT id, filename, status, error_message, created_at, processed_at FROM documents WHERE id = $1",
      [docId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    
    const doc = result.rows[0];
    res.json({
      document: doc,
      isProcessing: doc.status === 'processing',
      isCompleted: doc.status === 'completed',
      hasError: doc.status === 'failed'
    });
  } catch (err: any) {
    console.error("❌ Status check error:", err);
    res.status(500).json({ error: err.message });
  }
};
