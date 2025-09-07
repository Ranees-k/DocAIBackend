import pool from "../config/db";

async function runMigrations() {
  try {
    console.log("Running migrations...");
    
    // Create query_usage table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS query_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(45) NOT NULL,
        document_id INTEGER,  -- Changed from VARCHAR to INTEGER
        query TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_query_usage_user_date 
      ON query_usage(user_id, DATE(created_at))
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_query_usage_ip_date 
      ON query_usage(ip_address, DATE(created_at))
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_query_usage_created_at 
      ON query_usage(created_at)
    `);
    
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration error:", error);
  } finally {
    await pool.end();
  }
}

runMigrations();