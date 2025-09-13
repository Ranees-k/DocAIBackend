import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Keep the existing pool for raw SQL queries if needed
import { Pool } from "pg";

// Supabase connection pooler configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'aws-1-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '6543'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.zcqqmlffuxnnppijsjaa',
  password: process.env.DB_PASSWORD ||'Ranees@123',
  // Force IPv4 to avoid IPv6 issues
    // family: 4,
  // Connection pool settings for Supabase
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  // SSL configuration for Supabase
  ssl: {
    rejectUnauthorized: false
  }
});

// Add error handling for database connection
pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Test the connection
pool.connect()
  .then(client => {
    console.log('✅ Database connected successfully to Supabase pooler');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

export default pool;
