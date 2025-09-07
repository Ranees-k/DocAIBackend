import pool from "../config/db.ts";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: string;
  requiresAuth: boolean;
}

export async function getRateLimitInfo(
  userId?: string, 
  ip?: string
): Promise<RateLimitInfo> {
  const today = new Date().toISOString().split('T')[0];
  
  if (userId) {
    // Authenticated user
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM query_usage 
       WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, today]
    );
    
    const used = parseInt(result.rows[0].count);
    const limit = 50;
    
    return {
      limit,
      remaining: Math.max(0, limit - used),
      resetTime: getNextDayResetTime(),
      requiresAuth: false
    };
  } else if (ip) {
    // Anonymous user
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM query_usage 
       WHERE ip_address = $1 AND DATE(created_at) = $2 AND user_id IS NULL`,
      [ip, today]
    );
    
    const used = parseInt(result.rows[0].count);
    const limit = 3;
    
    return {
      limit,
      remaining: Math.max(0, limit - used),
      resetTime: getNextDayResetTime(),
      requiresAuth: used >= limit
    };
  }
  
  return {
    limit: 3,
    remaining: 3,
    resetTime: getNextDayResetTime(),
    requiresAuth: false
  };
}

export async function checkRateLimit(
  userId?: string, 
  ip?: string
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const info = await getRateLimitInfo(userId, ip);
  return {
    allowed: info.remaining > 0,
    info
  };
}

function getNextDayResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

export async function recordQueryUsage(
  userId: string | null,
  ip: string,
  documentId: string | number,
  query: string
): Promise<void> {
  try {
    // Convert documentId to integer if it's a string
    const docId = typeof documentId === 'string' ? parseInt(documentId) : documentId;
    
    await pool.query(
      `INSERT INTO query_usage (user_id, ip_address, document_id, query, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, ip, docId, query]
    );
  } catch (error) {
    console.error("Error recording query usage:", error);
    throw error;
  }
} 