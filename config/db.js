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

  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

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
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS link VARCHAR(255);

  ALTER TABLE notifications
  ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text,
  ALTER COLUMN order_id TYPE VARCHAR(255) USING order_id::text;

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

  CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unread';

  CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  INSERT INTO platform_settings (key, value, description)
  VALUES ('platform_commission_percent', '5', 'Global Platform Commission Percentage applied to marketplace orders')
  ON CONFLICT (key) DO NOTHING;
`).catch(err => console.log("DB Migration Info:", err.message));

export default pool;