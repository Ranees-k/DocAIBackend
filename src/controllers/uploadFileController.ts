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

    const fileUrl = `/uploads/${req.file.filename}`;
    let pageBreaks: number[] = [];

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

    } else if (req.file.mimetype === "text/plain") {
      // Plain text
      rawText = await fs.readFile(req.file.path, "utf-8");
    } else {
      res.status(400).json({ error: "Unsupported file type" }); return;
    }

    console.log("rawText", rawText);
    // Step 2: Intelligent chunking configuration
    const strategyName = req.body.chunkingStrategy || req.query.chunkingStrategy;
    const customOptions = req.body.chunkingOptions || {};
    
    const strategy = getChunkingStrategy(req.file.mimetype, strategyName);


    const options: ChunkingOptions = {
      maxChunkSize: 1000,        // Increased from 500
      minChunkSize: 200,         // Added minimum chunk size
      overlapSize: 100,         // Increased overlap
      respectHeadingBoundaries: true,
      respectParagraphBoundaries: true,
      respectSentenceBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 6
    };

    // Step 3: Intelligent chunking based on file type
    let intelligentChunks;

    if (req.file.mimetype === "application/pdf") {
      intelligentChunks = chunkPDFTextIntelligently(rawText, pageBreaks, options);

    } else {
      intelligentChunks = chunkTextIntelligently(rawText, options);
    }


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
        options: options
      }
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};
