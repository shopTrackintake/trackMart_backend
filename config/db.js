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
  ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS serving_size VARCHAR(100),
  ADD COLUMN IF NOT EXISTS servings_per_container VARCHAR(100),
  ADD COLUMN IF NOT EXISTS net_weight VARCHAR(100),
  ADD COLUMN IF NOT EXISTS flavour VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dietary_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS manufacturer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manufacturer_address TEXT,
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mfg_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS fssai_license VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nutrition_per_100g TEXT,
  ADD COLUMN IF NOT EXISTS nutrition_per_serving TEXT;

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

  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    order_id INT,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS order_id INT,
  ADD COLUMN IF NOT EXISTS link VARCHAR(255);

  ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_note TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

  ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
`).catch(err => console.log("DB Migration Info:", err.message));

export default pool;