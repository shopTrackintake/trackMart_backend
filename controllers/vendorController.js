import pool from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";
import crypto from "crypto";
import { notifyUser } from "../services/notificationService.js";

/* ================= VENDOR STATS ================= */
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


/* ================= GET VENDOR ORDERS ================= */
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
        p.title AS product_title,
        p.image_url,
        p.price AS unit_price
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


/* ================= GET VENDOR EARNINGS ================= */
export const getVendorEarnings = async (req, res) => {
  try {
    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const earnings = await pool.query(
      `SELECT SUM(vendor_earning) as total
       FROM order_items
       WHERE vendor_id=$1`,
      [vendorId]
    );

    const orders = await pool.query(
      `SELECT oi.*, p.title as product_title
       FROM order_items oi
       JOIN products p ON p.id=oi.product_id
       WHERE oi.vendor_id=$1`,
      [vendorId]
    );

    res.json({
      total: earnings.rows[0].total || 0,
      orders: orders.rows
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= GET ORDER DETAILS ================= */
export const getVendorOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const order = await pool.query(
      `SELECT 
        o.id,
        o.order_status,
        o.payment_method,
        o.payment_status,
        o.total_amount,
        o.created_at,
        o.delivery_date,
        o.user_id,
        u.name AS customer_name,
        u.email AS customer_email,
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
      WHERE o.id=$1`,
      [id]
    );

    if (!order.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const items = await pool.query(
      `SELECT 
        oi.id,
        oi.quantity,
        oi.item_status,
        oi.delivery_date,
        oi.price_at_purchase,
        oi.vendor_earning,
        p.title,
        p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id=p.id
      WHERE oi.order_id=$1 AND oi.vendor_id=$2`,
      [id, vendorId]
    );

    res.json({
      order: order.rows[0],
      items: items.rows
    });

  } catch (err) {
    console.log("🔥 ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= SET IN TRANSIT (CONFIRM & SEND OTP) ================= */
export const confirmItem = async (req, res) => {
  const client = await pool.connect();

  try {
    const { item_id, delivery_date } = req.body;

    if (!item_id) {
      return res.status(400).json({ message: "item_id required" });
    }

    await client.query("BEGIN");

    const vendor = await client.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      throw new Error("Vendor not found");
    }

    const vendorId = vendor.rows[0].id;

    const itemCheck = await client.query(
      `SELECT * FROM order_items 
       WHERE id=$1 AND vendor_id=$2`,
      [item_id, vendorId]
    );

    if (!itemCheck.rows.length) {
      throw new Error("Not allowed");
    }

    const currentStatus = itemCheck.rows[0].item_status;
    if (["in_transit", "delivered"].includes(currentStatus)) {
      throw new Error("Item already in transit or delivered");
    }

    const userData = await client.query(
      `SELECT 
        u.id as buyer_user_id,
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
      throw new Error("User details not found");
    }

    const buyerUserId = userData.rows[0].buyer_user_id;
    const email = userData.rows[0].email;
    const orderId = userData.rows[0].order_id;
    const productTitle = userData.rows[0].product_title;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    // Set status to in_transit
    await client.query(
      `UPDATE order_items
       SET item_status='in_transit',
           delivery_date=COALESCE($1, delivery_date),
           otp=$2,
           otp_used_at=NULL
       WHERE id=$3`,
      [delivery_date || null, hashedOtp, item_id]
    );

    // Update main order status to in_transit
    await client.query(
      `UPDATE orders SET order_status='in_transit' WHERE id=$1`,
      [orderId]
    );

    // Deduct product stock
    await client.query(
      `UPDATE products
       SET stock = GREATEST(0, stock - $1)
       WHERE id = $2`,
      [itemCheck.rows[0].quantity, itemCheck.rows[0].product_id]
    );

    // Create in-app notification for buyer with Delivery OTP
    if (buyerUserId) {
      await notifyUser({
        userId: buyerUserId,
        title: `🚚 Delivery OTP: ${otp}`,
        message: `Your order for "${productTitle}" (Order #${orderId.toString().slice(0, 8).toUpperCase()}) is now In Transit! Your Delivery OTP is ${otp}. Please share this 6-digit OTP with your delivery person upon arrival.`,
        type: "order_otp",
        orderId,
        link: "/customer/orders"
      });
    }

    // Create in-app notification for vendor confirming dispatch
    await notifyUser({
      userId: req.user.id,
      title: `🚚 Item Dispatched (In Transit)`,
      message: `Item "${productTitle}" for Order #${orderId.toString().slice(0, 8).toUpperCase()} has been marked as In Transit. Delivery OTP generated.`,
      type: "order_status",
      orderId,
      link: `/vendor/orders/${orderId}`
    });

    await client.query("COMMIT");

    // Send email with OTP to customer
    try {
      await sendEmail({
        to: email,
        subject: "Your TrackMart Order is In Transit - Delivery OTP",
        text: `
Your order is now IN TRANSIT!

Product: ${productTitle}
Order ID: #${orderId.toString().slice(0, 8)}

Your 6-Digit Delivery OTP is: ${otp}

Please share this OTP with the delivery person upon arrival to verify delivery.

- TrackMart
`
      });
    } catch (emailErr) {
      console.log("📧 Email failed:", emailErr.message);
    }

    res.json({ message: "Order set to In Transit & OTP sent to customer" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.log("🔥 ERROR:", err);
    res.status(500).json({
      message: err.message || "Failed to update status to In Transit"
    });
  } finally {
    client.release();
  }
};


/* ================= MARK DELIVERED (REQUIRES OTP) ================= */
export const markOrderDelivered = async (req, res) => {
  try {
    const { item_id, otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "6-digit Delivery OTP required" });
    }

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const itemCheck = await pool.query(
      `SELECT oi.*, p.title as product_title, o.user_id as buyer_user_id
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.id=$1 AND oi.vendor_id=$2`,
      [item_id, vendorId]
    );

    if (!itemCheck.rows.length) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const item = itemCheck.rows[0];

    if (item.item_status === "delivered" || item.otp_used_at) {
      return res.status(400).json({ message: "Order item already delivered" });
    }

    if (item.item_status !== "in_transit" && item.item_status !== "confirmed") {
      return res.status(400).json({ message: "Order must be In Transit before marking as delivered" });
    }

    const hashedOtp = crypto.createHash("sha256").update(String(otp).trim()).digest("hex");

    if (hashedOtp !== item.otp) {
      return res.status(400).json({ message: "Invalid OTP. Please enter the correct 6-digit OTP from customer." });
    }

    await pool.query(
      `UPDATE order_items
       SET item_status='delivered',
           otp=NULL,
           otp_used_at=NOW()
       WHERE id=$1`,
      [item_id]
    );

    // Update parent order status to delivered if all items delivered
    const remainingUndelivered = await pool.query(
      `SELECT id FROM order_items WHERE order_id=$1 AND item_status != 'delivered'`,
      [item.order_id]
    );

    if (remainingUndelivered.rows.length === 0) {
      await pool.query(
        `UPDATE orders SET order_status='delivered' WHERE id=$1`,
        [item.order_id]
      );
    }

    /* ================= NOTIFY BUYER OF DELIVERY ================= */
    if (item.buyer_user_id) {
      await notifyUser({
        userId: item.buyer_user_id,
        title: "✅ Order Delivered",
        message: `Your order for "${item.product_title}" (Order #${item.order_id.toString().slice(0, 8).toUpperCase()}) has been delivered successfully!`,
        type: "order_delivered",
        orderId: item.order_id,
        link: "/customer/orders"
      });
    }

    /* ================= NOTIFY VENDOR OF DELIVERY ================= */
    await notifyUser({
      userId: req.user.id,
      title: "✅ Item Delivered Successfully",
      message: `Item "${item.product_title}" for Order #${item.order_id.toString().slice(0, 8).toUpperCase()} was verified with OTP and delivered.`,
      type: "order_delivered",
      orderId: item.order_id,
      link: `/vendor/orders/${item.order_id}`
    });

    res.json({ message: "Item delivered successfully with OTP verification" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= GET VENDOR PAYMENTS ================= */
export const getVendorPayments = async (req, res) => {
  try {
    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    /* TOTAL RECEIVED (paid payouts) */
    const received = await pool.query(
      `SELECT COALESCE(SUM(vendor_earning),0) as total
       FROM order_items
       WHERE vendor_id=$1
       AND payout_status='paid'`,
      [vendorId]
    );

    /* TOTAL PENDING (ONLINE PENDING PAYOUTS) */
    const pending = await pool.query(
      `SELECT COALESCE(SUM(oi.vendor_earning),0) as total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id=$1
       AND oi.payout_status='pending'
       AND (o.payment_method = 'ONLINE' OR o.payment_method IS NULL)`,
      [vendorId]
    );

    /* COD DUES (0% commission) */
    const codDue = await pool.query(
      `SELECT COALESCE(SUM(oi.commission_amount),0) as total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id=$1
       AND oi.item_status='delivered'
       AND oi.payout_status='pending'
       AND o.payment_method = 'COD'`,
      [vendorId]
    );

    /* PAYMENT HISTORY */
    const history = await pool.query(
      `SELECT
        oi.vendor_earning,
        oi.payout_status,
        oi.payout_reference,
        o.created_at,
        o.payment_method,
        p.title as product_title
       FROM order_items oi
       JOIN orders o ON oi.order_id=o.id
       LEFT JOIN products p ON oi.product_id=p.id
       WHERE oi.vendor_id=$1
       ORDER BY o.created_at DESC`,
      [vendorId]
    );

    res.json({
      received: Number(received.rows[0].total || 0),
      pending: Number(pending.rows[0].total || 0),
      dues: Number(codDue.rows[0].total || 0),
      history: history.rows
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= RESEND DELIVERY OTP ================= */
export const resendOtp = async (req, res) => {
  try {
    const { item_id } = req.body;

    if (!item_id) {
      return res.status(400).json({ message: "item_id required" });
    }

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const itemCheck = await pool.query(
      `SELECT * FROM order_items WHERE id=$1 AND vendor_id=$2`,
      [item_id, vendorId]
    );

    if (!itemCheck.rows.length) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const item = itemCheck.rows[0];

    if (item.item_status === "delivered") {
      return res.status(400).json({ message: "Order item is already delivered" });
    }

    // Get buyer details
    const userData = await pool.query(
      `SELECT 
        u.id as buyer_user_id,
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
      return res.status(404).json({ message: "User details not found" });
    }

    const buyerUserId = userData.rows[0].buyer_user_id;
    const email = userData.rows[0].email;
    const orderId = userData.rows[0].order_id;
    const productTitle = userData.rows[0].product_title;

    // Generate new 6-digit OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(newOtp).digest("hex");

    // Update DB with new OTP
    await pool.query(
      `UPDATE order_items
       SET otp = $1,
           otp_used_at = NULL
       WHERE id = $2`,
      [hashedOtp, item_id]
    );

    // Create in-app notification for buyer with new OTP
    if (buyerUserId) {
      await notifyUser({
        userId: buyerUserId,
        title: `🔑 Resent Delivery OTP: ${newOtp}`,
        message: `Your new Delivery OTP for "${productTitle}" (Order #${orderId.toString().slice(0, 8).toUpperCase()}) is ${newOtp}. Please share this code with your delivery person upon delivery.`,
        type: "order_otp",
        orderId,
        link: "/customer/orders"
      });
    }

    // Send email with new OTP
    try {
      await sendEmail({
        to: email,
        subject: "New Delivery OTP - TrackMart Order",
        text: `
Your new Delivery OTP has been generated!

Product: ${productTitle}
Order ID: #${orderId.toString().slice(0, 8).toUpperCase()}

New 6-Digit Delivery OTP: ${newOtp}

Please share this OTP with the delivery person to verify delivery.

- TrackMart
`
      });
    } catch (emailErr) {
      console.log("📧 Email resend failed:", emailErr.message);
    }

    res.json({ message: "New Delivery OTP has been sent to customer via email and dashboard notification!" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};