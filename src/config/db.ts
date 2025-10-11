import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Keep the existing pool for raw SQL queries if needed
import { Pool } from "pg";

// Supabase connection pooler configuration with better error handling
const pool = new Pool({
  host: process.env.DB_HOST || 'aws-1-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '6543'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.zcqqmlffuxnnppijsjaa',
  password: process.env.DB_PASSWORD ||'Ranees@123',
  // Connection pool settings optimized for Supabase
  max: 5, // Further reduced to avoid pool exhaustion
  min: 0, // Start with no connections
  idleTimeoutMillis: 10000, // Close idle connections faster
  connectionTimeoutMillis: 3000, // Faster timeout detection
  // SSL configuration for Supabase
  ssl: {
    rejectUnauthorized: false
  },
  // Additional settings for better reliability
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  // Query timeout
  query_timeout: 10000,
  // Statement timeout
  statement_timeout: 10000
});

// Add error handling for database connection
pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Test the connection with retry logic
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully to Supabase pooler');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    console.log('⚠️  Application will continue with degraded functionality');
  }
};

// Test connection after a short delay to allow server startup
setTimeout(testConnection, 1000);

export default pool;
