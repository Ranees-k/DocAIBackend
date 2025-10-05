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
    
    // Create chat_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        answer TEXT NOT NULL,
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
    
    // Create indexes for chat_history table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_user_id 
      ON chat_history(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_document_id 
      ON chat_history(document_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_created_at 
      ON chat_history(created_at)
    `);
    
    // Add metadata columns to document_chunks table for intelligent chunking
    await pool.query(`
      ALTER TABLE document_chunks 
      ADD COLUMN IF NOT EXISTS heading VARCHAR(500),
      ADD COLUMN IF NOT EXISTS heading_level INTEGER,
      ADD COLUMN IF NOT EXISTS section VARCHAR(500),
      ADD COLUMN IF NOT EXISTS page_number INTEGER,
      ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
      ADD COLUMN IF NOT EXISTS total_chunks INTEGER,
      ADD COLUMN IF NOT EXISTS word_count INTEGER,
      ADD COLUMN IF NOT EXISTS char_count INTEGER,
      ADD COLUMN IF NOT EXISTS start_position INTEGER,
      ADD COLUMN IF NOT EXISTS end_position INTEGER,
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `);
    
    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_heading 
      ON document_chunks(heading)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_heading_level 
      ON document_chunks(heading_level)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_section 
      ON document_chunks(section)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_page_number 
      ON document_chunks(page_number)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index 
      ON document_chunks(document_id, chunk_index)
    `);
    
    // Add status columns to documents table for processing tracking
    await pool.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP
    `);
    
    // Create index for status queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_status 
      ON documents(status)
    `);
    
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration error:", error);
  } finally {
    await pool.end();
  }
}

runMigrations();