import pool from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";
import crypto from "crypto";
export const getVendorStats = async (req, res) => {
  try {

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const products = await pool.query(
      "SELECT COUNT(*) FROM products WHERE vendor_id=$1",
      [vendorId]
    );

    const orders = await pool.query(
      "SELECT COUNT(*) FROM order_items WHERE vendor_id=$1",
      [vendorId]
    );

    const earnings = await pool.query(
      "SELECT COALESCE(SUM(vendor_earning),0) FROM order_items WHERE vendor_id=$1",
      [vendorId]
    );

    res.json({
      products: Number(products.rows[0].count),
      orders: Number(orders.rows[0].count),
      earnings: Number(earnings.rows[0].coalesce)
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};



export const getVendorOrders = async (req, res) => {

  try {

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const orders = await pool.query(
  `SELECT 
    oi.id AS item_id,       
    o.id AS order_id,
    oi.item_status,  
    o.created_at,
    oi.quantity,
    oi.vendor_earning,
    p.title AS product_title
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  WHERE oi.vendor_id = $1
  ORDER BY o.created_at DESC`,
  [vendorId]
);

    res.json(orders.rows);

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};



export const getVendorEarnings = async (req, res) => {

  const vendor = await pool.query(
    "SELECT id FROM vendors WHERE user_id=$1",
    [req.user.id]
  );

  const vendorId = vendor.rows[0].id;

  const earnings = await pool.query(
    `SELECT
      SUM(vendor_earning) as total
     FROM order_items
     WHERE vendor_id=$1`,
    [vendorId]
  );

  const orders = await pool.query(
    `SELECT 
      oi.*,
      p.title as product_title
     FROM order_items oi
     JOIN products p ON p.id=oi.product_id
     WHERE oi.vendor_id=$1`,
    [vendorId]
  );

  res.json({
    total: earnings.rows[0].total || 0,
    orders: orders.rows
  });
};



/* ================= GET ORDER DETAILS ================= */
export const getVendorOrderDetails = async (req,res)=>{

try{

const { id } = req.params;

/* 🔥 VENDOR CHECK */
const vendor = await pool.query(
  "SELECT id FROM vendors WHERE user_id=$1",
  [req.user.id]
);

if (!vendor.rows.length) {
  return res.status(404).json({ message: "Vendor not found" });
}

const vendorId = vendor.rows[0].id;

/* 🔥 ORDER */
const order = await pool.query(
`
SELECT 
o.id,
o.order_status,
o.delivery_date,
o.user_id,
u.name AS customer_name,
u.id AS customer_id,
a.phone,
a.house_no,
a.street,
a.locality,
a.city,
a.state,
a.pincode
FROM orders o
JOIN users u ON o.user_id=u.id
LEFT JOIN addresses a ON o.address_id=a.id
WHERE o.id=$1
`,
[id]
);

if (!order.rows.length) {
  return res.status(404).json({ message: "Order not found" });
}

/* 🔥 ITEMS (IMPORTANT FIX) */
const items = await pool.query(
`
SELECT 
oi.id,
oi.quantity,
oi.item_status,
oi.delivery_date,
oi.price_at_purchase,
p.title
FROM order_items oi
JOIN products p ON oi.product_id=p.id
WHERE oi.order_id=$1 AND oi.vendor_id=$2
`,
[id, vendorId]
);

res.json({
order: order.rows[0],
items: items.rows
});

}catch(err){

console.log("🔥 ERROR:", err);  // 👈 MUST SEE THIS
res.status(500).json({message:err.message});

}

};



/* ================= CONFIRM ORDER ================= */

export const confirmItem = async (req, res) => {
  const client = await pool.connect();

  try {
    const { item_id, delivery_date } = req.body;

    if (!item_id) {
      return res.status(400).json({ message: "item_id required" });
    }

    if (!delivery_date) {
      return res.status(400).json({ message: "Delivery date required" });
    }

    const today = new Date().toISOString().split("T")[0];

    if (delivery_date < today) {
      return res.status(400).json({ message: "Invalid delivery date" });
    }

    await client.query("BEGIN");

    // ✅ vendor check
    const vendor = await client.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      throw new Error("Vendor not found");
    }

    const vendorId = vendor.rows[0].id;

    // ✅ check item
    const itemCheck = await client.query(
      `SELECT * FROM order_items 
       WHERE id=$1 AND vendor_id=$2`,
      [item_id, vendorId]
    );

    if (!itemCheck.rows.length) {
      throw new Error("Not allowed");
    }

    // ❌ already confirmed
    if (["confirmed", "delivered"].includes(itemCheck.rows[0].item_status)) {
  throw new Error("Item already processed");
}

    // ✅ get user email
    const userData = await client.query(
  `SELECT 
  u.email,
  o.id as order_id,
  p.title as product_title
FROM order_items oi
JOIN orders o ON oi.order_id=o.id
JOIN users u ON o.user_id=u.id
JOIN products p ON oi.product_id=p.id
WHERE oi.id=$1`,
  [item_id]
);

    if (!userData.rows.length) {
      throw new Error("User email not found");
    }

   
    const email = userData.rows[0].email;
const orderId = userData.rows[0].order_id;
const productTitle = userData.rows[0].product_title;
    console.log("📧 Sending OTP to:", email);

    // ✅ generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    // ✅ DB update
    await client.query(
      `UPDATE order_items
       SET item_status='confirmed',
           delivery_date=$1,
           otp=$2,
           otp_used_at=NULL
       WHERE id=$3`,
      [delivery_date, hashedOtp, item_id]
    );

    await client.query("COMMIT"); // 🔥 COMMIT FIRST

    // 🔥 EMAIL AFTER COMMIT (IMPORTANT)
    try {
      await sendEmail({
        to: email,
        subject: "Delivery OTP",
        text: `
Your OTP is: ${otp}

Order ID: ${orderId.toString().slice(0,8)}
Product: ${productTitle}

Please share this OTP with delivery partner to receive your order.

- TrackMart
`
      });
    } catch (emailErr) {
      console.log("📧 Email failed:", emailErr.message);
      // ❗ order already confirmed, so ignore email failure
    }

    res.json({ message: "Item confirmed & OTP sent" });

  } catch (err) {
    await client.query("ROLLBACK");

    console.log("🔥 ERROR:", err);

    res.status(500).json({
      message: err.message || "Failed to confirm item"
    });

  } finally {
    client.release();
  }
};


export const markOrderDelivered = async (req, res) => {
  try {
    const { item_id, otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP required" });
    }

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    const vendorId = vendor.rows[0].id;

    const itemCheck = await pool.query(
      `SELECT * FROM order_items WHERE id=$1 AND vendor_id=$2`,
      [item_id, vendorId]
    );

    if (!itemCheck.rows.length) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const item = itemCheck.rows[0];

    if (item.otp_used_at) {
      return res.status(400).json({ message: "OTP already used" });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedOtp !== item.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await pool.query(
      `UPDATE order_items
       SET item_status='delivered',
           otp=NULL,
           otp_used_at=NOW()
       WHERE id=$1`,
      [item_id]
    );

    res.json({ message: "Item delivered successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};
export const getVendorPayments = async (req,res)=>{

try{

const vendor = await pool.query(
"SELECT id FROM vendors WHERE user_id=$1",
[req.user.id]
);

if(!vendor.rows.length){
return res.status(404).json({message:"Vendor not found"});
}

const vendorId = vendor.rows[0].id;

/* TOTAL RECEIVED */

const received = await pool.query(
`
SELECT COALESCE(SUM(vendor_earning),0) as total
FROM order_items
WHERE vendor_id=$1
AND payout_status='paid'
`,
[vendorId]
);

/* TOTAL PENDING */

const pending = await pool.query(
`
SELECT COALESCE(SUM(vendor_earning),0) as total
FROM order_items
WHERE vendor_id=$1
AND payout_status='pending'
`,
[vendorId]
);

/* PAYMENT HISTORY */

const history = await pool.query(
`
SELECT
oi.vendor_earning,
oi.payout_status,
o.created_at,
p.title as product_title
FROM order_items oi
JOIN orders o ON oi.order_id=o.id
LEFT JOIN products p ON oi.product_id=p.id
WHERE oi.vendor_id=$1
ORDER BY o.created_at DESC
`,
[vendorId]
);

res.json({
received: received.rows[0].total,
pending: pending.rows[0].total,
history: history.rows
});

  
}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};