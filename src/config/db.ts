import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Keep the existing pool for raw SQL queries if needed
import { Pool } from "pg";

// Supabase connection pooler configuration optimized for Render
const pool = new Pool({
  host: process.env.DB_HOST || 'aws-1-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '6543'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.zcqqmlffuxnnppijsjaa',
  password: process.env.DB_PASSWORD || 'Ranees@123',
  // Connection pool settings optimized for Render free tier
  max: 2, // Very conservative for free tier
  min: 0, // Start with no connections
  idleTimeoutMillis: 5000, // Close idle connections very quickly
  connectionTimeoutMillis: 10000, // Longer timeout for initial connection
  // SSL configuration for Supabase
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  },
  // Additional settings for better reliability on Render
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  // Query timeout settings
  query_timeout: 30000, // 30 seconds for queries
  statement_timeout: 30000, // 30 seconds for statements
  // Connection retry settings
  allowExitOnIdle: true,
  // Additional timeout settings
  application_name: 'DocAI-Backend'
});

// Add error handling for database connection
pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Test the connection with retry logic optimized for Render
const testConnection = async (retryCount = 0) => {
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  try {
    console.log(`🔄 Testing database connection (attempt ${retryCount + 1}/${maxRetries + 1})...`);
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();
    
    console.log('✅ Database connected successfully to Supabase pooler');
    console.log(`📅 Database time: ${result.rows[0].current_time}`);
    console.log(`🗄️  Database version: ${result.rows[0].db_version.split(' ')[0]}`);
    
  } catch (err: any) {
    console.error(`❌ Database connection failed (attempt ${retryCount + 1}):`, err.message);
    
    if (retryCount < maxRetries) {
      console.log(`⏳ Retrying in ${retryDelay/1000} seconds...`);
      setTimeout(() => testConnection(retryCount + 1), retryDelay);
    } else {
      console.error('❌ Database connection failed after all retries');
      console.log('⚠️  Application will continue with degraded functionality');
      console.log('💡 Consider checking:');
      console.log('   - Supabase project status');
      console.log('   - Environment variables');
      console.log('   - Network connectivity');
    }
  }
};

// Test connection after a longer delay to allow server startup on Render
setTimeout(testConnection, 3000);

// Health check function for monitoring
export const checkDatabaseHealth = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (err: any) {
    return { 
      status: 'unhealthy', 
      error: err.message, 
      timestamp: new Date().toISOString() 
    };
  }
};

export default pool;
