// src/controllers/queryController.ts
import { type Request, type Response } from "express";
import { searchDocumentChunks } from "../services/queryService.ts";
import { generateAnswer } from "../services/llmService.ts";
import { checkRateLimit, recordQueryUsage } from "../services/rateLimitService.ts";
import pool from "../config/db.ts";

export const queryDocument = async (req: Request, res: Response) => {
  try {
    const { documentId, query, limit, userId } = req.body;
    console.log(req.body, "req.body");
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (!documentId || !query) {
      return res.status(400).json({ error: "documentId and query are required" });
    }

    // Check rate limit
    const rateLimitCheck = await checkRateLimit(userId, ip);
    console.log(rateLimitCheck);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: "Daily query limit exceeded",
        message: rateLimitCheck.info.requiresAuth 
          ? "You have reached the limit of 3 free queries per day. Please sign up or log in to continue."
          : "You have reached your daily limit. Please try again tomorrow.",
        limit: rateLimitCheck.info.limit,
        remaining: rateLimitCheck.info.remaining,
        resetTime: rateLimitCheck.info.resetTime,
        requiresAuth: rateLimitCheck.info.requiresAuth
      });
    }

    // Step 1: Search chunks
    const results = await searchDocumentChunks(documentId, query, limit || 5);

    // Step 2: Build context (join top chunks)
    const context = results.map((r: any) => r.chunk_text).join("\n\n");

    // Step 3: Get AI answer
    const answer = await generateAnswer(query, context);

    // Record query usage
    await recordQueryUsage(userId || null, ip, documentId, query);

    // Save to chat history if user is authenticated
    if (userId) {
      await pool.query(
        `INSERT INTO chat_history (user_id, document_id, question, answer) 
         VALUES ($1, $2, $3, $4)`, 
        [userId, documentId, query, answer]
      );
    }

    res.status(200).json({
      message: "✅ Query processed successfully",
      query,
      matches: results,
      answer,
      rateLimit: {
        limit: rateLimitCheck.info.limit,
        remaining: rateLimitCheck.info.remaining - 1,
        resetTime: rateLimitCheck.info.resetTime
      }
    });
  } catch (err: any) {
    console.error("❌ Query error:", err);
    res.status(500).json({ error: err.message });
  }
};

// New endpoint to check rate limit status
export const getRateLimitStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    const { checkRateLimit } = await import("../services/rateLimitService.ts");
    const rateLimitCheck = await checkRateLimit(userId, ip);
    
    res.status(200).json({
      allowed: rateLimitCheck.allowed,
      ...rateLimitCheck.info
    });
  } catch (err: any) {
    console.error("❌ Rate limit status error:", err);
    res.status(500).json({ error: err.message });
  }
};
