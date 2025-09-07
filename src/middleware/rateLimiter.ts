import type { Request, Response, NextFunction } from "express";
import pool from "../config/db.ts";

interface RateLimitData {
  ip: string;
  userId?: string;
  date: string;
  count: number;
}

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.body?.userId || req.headers['user-id'] as string;
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user is authenticated
    if (userId && typeof userId === 'string') {
      // Authenticated user - unlimited queries
      console.log(`Authenticated user ${userId} - unlimited access`);
      
      // Add user_id to request for tracking
      req.body = req.body || {};
      req.body.authenticatedUserId = userId;
    } else {
      // Anonymous user - check IP-based limit (3 queries per day)
      const ipLimit = await checkIPDailyLimit(ip, today || '');
      if (ipLimit >= 3) {
        return res.status(429).json({
          error: "Daily query limit exceeded",
          message: "You have reached the limit of 3 free queries per day. Please sign up or log in for unlimited access.",
          limit: 3,
          remaining: 0,
          requiresAuth: true
        });
      }
      
      // Add IP to request for tracking
      req.body = req.body || {};
      req.body.trackingIP = ip;
    }
    
    next();
  } catch (error) {
    console.error("Rate limiter error:", error);
    next(); // Continue on error to avoid blocking requests
  }
};

async function checkUserDailyLimit(userId: string, date: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM query_usage 
       WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, date]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error checking user daily limit:", error);
    return 0;
  }
}

async function checkIPDailyLimit(ip: string, date: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM query_usage 
       WHERE ip_address = $1 AND DATE(created_at) = $2 AND user_id IS NULL`,
      [ip, date]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error checking IP daily limit:", error);
    return 0;
  }
}

export const trackQueryUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.body?.authenticatedUserId || req.body?.userId;
    const documentId = req.body?.documentId;
    const query = req.body?.query;
    
    // Record the query usage
    await pool.query(
      `INSERT INTO query_usage (user_id, ip_address, document_id, query, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId || null, ip, documentId, query]
    );
    
    next();
  } catch (error) {
    console.error("Error tracking query usage:", error);
    next(); // Continue on error
  }
}; 