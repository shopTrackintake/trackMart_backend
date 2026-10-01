import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Database Migrations
pool.query(`
  ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 0;

  ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bank_holder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(50),
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fssai_number VARCHAR(50);
`).catch(err => console.log("DB Migration Info:", err.message));

export default pool;