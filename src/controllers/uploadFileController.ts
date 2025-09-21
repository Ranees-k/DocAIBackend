import { type Request, type Response } from "express";
import { saveFileRecord } from "../services/uploadFileService";
import { chunkText } from "../utils/chunkText";
import { chunkTextIntelligently, chunkPDFTextIntelligently, ChunkingOptions, IntelligentChunk } from "../utils/intelligentChunking";
import { saveIntelligentDocumentChunks } from "../services/chunkService";
import { getChunkingStrategy, validateChunkingOptions } from "../config/chunkingConfig";
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

    // Step 2: Intelligent chunking configuration
    const strategyName = req.body.chunkingStrategy || req.query.chunkingStrategy;
    const customOptions = req.body.chunkingOptions || {};
    
    const strategy = getChunkingStrategy(req.file.mimetype, strategyName);
    const chunkingOptions = validateChunkingOptions({
      ...strategy.options,
      ...customOptions
    });

    // Step 3: Intelligent chunking based on file type
    let intelligentChunks;
    let pageBreaks: number[] = [];

    if (req.file.mimetype === "application/pdf") {
      // For PDFs, we can track page breaks for better context
      // This is a simplified approach - in production you might want more sophisticated page detection
      const pageBreakPattern = /\f/g; // Form feed character often indicates page breaks
      let match;
      while ((match = pageBreakPattern.exec(rawText)) !== null) {
        pageBreaks.push(match.index);
      }
      
      intelligentChunks = chunkPDFTextIntelligently(rawText, pageBreaks, chunkingOptions);
    } else {
      intelligentChunks = chunkTextIntelligently(rawText, chunkingOptions);
    }

    console.log(`Generated ${intelligentChunks.length} intelligent chunks`);

    // Helper to clean text
    function cleanText(text: string): string {
      return text
        .replace(/\u0000/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();
    }

    // Step 4: Process chunks → embed → save to DB with metadata
    const chunksWithEmbeddings: Array<IntelligentChunk & { metadata: IntelligentChunk['metadata'] & { embedding?: number[] } }> = [];
    
    for (const chunk of intelligentChunks) {
      const cleanedChunk = cleanText(chunk.text);
      if (cleanedChunk.length === 0) continue;

      const embedding = await generateEmbedding(cleanedChunk);
      console.log(`Generated embedding for chunk ${chunk.metadata.chunkIndex + 1}/${chunk.metadata.totalChunks}`);

      // Create chunk with embedding
      chunksWithEmbeddings.push({
        text: cleanedChunk,
        metadata: {
          ...chunk.metadata,
          embedding: embedding
        }
      });
    }

    // Save all chunks with metadata to database
    await saveIntelligentDocumentChunks(doc.id, chunksWithEmbeddings);

    // Step 5: Response with intelligent chunking info
    const chunkSummary = {
      totalChunks: intelligentChunks.length,
      chunksWithHeadings: intelligentChunks.filter(c => c.metadata.heading).length,
      averageChunkSize: Math.round(intelligentChunks.reduce((sum, c) => sum + c.metadata.charCount, 0) / intelligentChunks.length),
      sections: [...new Set(intelligentChunks.map(c => c.metadata.section).filter(Boolean))],
      headingLevels: [...new Set(intelligentChunks.map(c => c.metadata.headingLevel).filter(Boolean))].sort()
    };

    res.status(201).json({
      message: "✅ Document uploaded successfully with intelligent chunking",
      document: doc,
      chunking: {
        strategy: strategy.name,
        description: strategy.description,
        summary: chunkSummary,
        options: chunkingOptions
      }
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};
