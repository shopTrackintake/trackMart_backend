import pool from "../config/db.js";
import { notifyUser } from "../services/notificationService.js";
export const getAllVendors = async (req,res)=>{

try{

const vendors = await pool.query(`
SELECT 
v.id,
v.business_name,
v.kyc_status,
u.name,
u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE v.kyc_status = 'approved'
ORDER BY v.created_at DESC
`);

res.json(vendors.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
/* ================= DASHBOARD STATS ================= */

export const getAdminStats = async (req,res)=>{
try{

const vendors = await pool.query(
"SELECT COUNT(*) FROM vendors"
);

const pending = await pool.query(
"SELECT COUNT(*) FROM vendors WHERE kyc_status='pending'"
);

const revenue = await pool.query(
`
SELECT COALESCE(SUM(commission_amount),0) as total
FROM order_items
`
);

res.json({
vendors:Number(vendors.rows[0].count),
pending:Number(pending.rows[0].count),
revenue:Number(revenue.rows[0].total)
});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}
};


/* ================= GET PENDING VENDORS ================= */

export const getPendingVendors = async (req,res)=>{
try{

const vendors = await pool.query(
`
SELECT 
v.id,
v.business_name,
v.kyc_status,
u.name,
u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE v.kyc_status IN ('pending','hold')
ORDER BY v.created_at DESC
`
);

res.json(vendors.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}
};


/* ================= APPROVE VENDOR ================= */
export const approveVendor = async (req,res)=>{
try{

const { vendorId } = req.params;

/* GET USER ID */

const vendor = await pool.query(
"SELECT user_id,business_name FROM vendors WHERE id=$1",
[vendorId]
);

if(!vendor.rows.length){
return res.status(404).json({message:"Vendor not found"});
}

const userId = vendor.rows[0].user_id;
const businessName = vendor.rows[0].business_name;

/* APPROVE VENDOR */

await pool.query(
"UPDATE vendors SET kyc_status='approved' WHERE id=$1",
[vendorId]
);

/* SEND NOTIFICATION */

await pool.query(
`
INSERT INTO notifications
(user_id,title,message,type)
VALUES($1,$2,$3,$4)
`,
[
userId,
"Vendor Approved",
`🎉 Congratulations! Your vendor account "${businessName}" has been approved by admin.`,
"vendor"
]
);

res.json({message:"Vendor approved and notification sent"});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}
};


/* ================= HOLD VENDOR ================= */

export const holdVendor = async (req,res)=>{
try{

const { vendorId } = req.params;

await pool.query(
"UPDATE vendors SET kyc_status='hold' WHERE id=$1",
[vendorId]
);

res.json({message:"Vendor on hold"});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}
};


/* ================= DELETE VENDOR ================= */
export const deleteVendor = async (req, res) => {
try{

const { vendorId } = req.params;

/* get user id */

const vendor = await pool.query(
"SELECT user_id FROM vendors WHERE id=$1",
[vendorId]
);

if(!vendor.rows.length){
return res.status(404).json({message:"Vendor not found"});
}

const userId = vendor.rows[0].user_id;

/* delete products */

await pool.query(
"DELETE FROM products WHERE vendor_id=$1",
[vendorId]
);

/* delete vendor */

await pool.query(
"DELETE FROM vendors WHERE id=$1",
[vendorId]
);

/* delete user */

await pool.query(
"DELETE FROM users WHERE id=$1",
[userId]
);

res.json({ message: "Vendor deleted successfully" });

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}
};
export const getAdminProducts = async (req,res)=>{

try{

const products = await pool.query(
`
SELECT
p.*,
v.business_name
FROM products p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.status = 'active'
ORDER BY v.business_name, p.created_at DESC
`
);

res.json(products.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const deleteAdminProduct = async (req,res)=>{

try{

const { id } = req.params;
const { reason } = req.body;

/* GET PRODUCT + VENDOR USER */

const product = await pool.query(
`
SELECT 
p.title,
v.user_id
FROM products p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.id=$1
`,
[id]
);

if(!product.rows.length){
return res.status(404).json({message:"Product not found"});
}

const productTitle = product.rows[0].title;
const vendorUserId = product.rows[0].user_id;


/* DELETE PRODUCT */

await pool.query(
"UPDATE products SET status='inactive' WHERE id=$1",
[id]
);


/* SEND NOTIFICATION TO VENDOR */

await pool.query(
`
INSERT INTO notifications
(user_id,title,message,type)
VALUES ($1,$2,$3,$4)
`,
[
vendorUserId,
"Product Removed by Admin",
reason
? `Your product "${productTitle}" was removed. Reason: ${reason}`
: `Your product "${productTitle}" was removed by admin.`,
"product"
]
);

res.json({message:"Product deleted and vendor notified"});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const getAdminProductDetails = async (req,res)=>{

try{

const { id } = req.params;

const product = await pool.query(
`
SELECT 
p.id,
p.title,
p.description,
p.price,
p.stock,
p.size,
p.category_id,
p.image_url,
p.ingredients_image_url,
p.ingredients,
p.calories,
p.sugar,
p.fat,
p.protein,
p.how_to_use,
p.making_process,
p.status,
p.created_at,
c.name AS category_name,
c.benefits,
v.business_name
FROM products p
JOIN vendors v ON p.vendor_id = v.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.id = $1
`,
[id]
);

res.json(product.rows[0]);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const getAdminOrders = async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT
        o.id AS order_id,
        o.user_id AS buyer_user_id,
        u.name AS buyer_name,
        u.email AS buyer_email,
        o.payment_method,
        o.payment_status,
        COALESCE(o.refund_status, 'none') AS refund_status,
        COALESCE(o.refund_amount, 0) AS refund_amount,
        o.refund_note,
        o.cancellation_reason,
        o.created_at,
        oi.id AS item_id,
        oi.item_status AS order_status,
        COALESCE(oi.payout_status, 'pending') AS payout_status,
        oi.payout_reference,
        oi.quantity,
        oi.price_at_purchase,
        v.id AS vendor_id,
        v.business_name,
        p.title AS product_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN vendors v ON oi.vendor_id = v.id
      LEFT JOIN products p ON oi.product_id = p.id
      ORDER BY o.created_at DESC;
    `);

    res.json(orders.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= ADMIN UPDATE REFUND / PAYMENT / PAYOUT STATUS ================= */
export const updateOrderRefundOrPaymentStatus = async (req, res) => {
  try {
    const { order_id, refund_status, payment_status, refund_note, payout_status, payout_reference } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const orderCheck = await pool.query(
      `SELECT * FROM orders WHERE id=$1`,
      [order_id]
    );

    if (!orderCheck.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderCheck.rows[0];

    const newRefundStatus = refund_status || order.refund_status || "none";
    const newPaymentStatus = payment_status || order.payment_status || "pending";
    const note = refund_note || order.refund_note || "";

    await pool.query(
      `UPDATE orders
       SET refund_status = $1,
           payment_status = $2,
           refund_note = $3
       WHERE id = $4`,
      [newRefundStatus, newPaymentStatus, note, order_id]
    );

    await pool.query(
      `UPDATE order_items
       SET refund_status = $1
       WHERE order_id = $2`,
      [newRefundStatus, order_id]
    );

    // If Payout Status is specified for vendor
    if (payout_status) {
      const ref = payout_reference || `PAY-${Date.now()}`;
      await pool.query(
        `UPDATE order_items
         SET payout_status = $1,
             payout_reference = $2
         WHERE order_id = $3`,
        [payout_status, ref, order_id]
      );

      // Find vendors for this order and notify them
      const vendorsRes = await pool.query(
        `SELECT DISTINCT v.user_id, v.business_name
         FROM order_items oi
         JOIN vendors v ON oi.vendor_id = v.id
         WHERE oi.order_id = $1`,
        [order_id]
      );

      for (const v of vendorsRes.rows) {
        if (v.user_id) {
          await notifyUser({
            userId: v.user_id,
            title: `💰 Vendor Payout Status Updated: ${payout_status.toUpperCase()}`,
            message: `Payout status for Order #${order_id.toString().slice(0, 8).toUpperCase()} has been updated to "${payout_status.toUpperCase()}". Ref: ${ref}`,
            type: "payout",
            link: "/vendor/payments"
          });
        }
      }
    }

    // Notify buyer
    if (order.user_id) {
      await notifyUser({
        userId: order.user_id,
        title: `💳 Refund & Payment Update: ${newRefundStatus.toUpperCase()}`,
        message: `Your Order #${order_id.toString().slice(0, 8).toUpperCase()} refund status has been updated to "${newRefundStatus.toUpperCase()}". ${note}`,
        type: "order_refund_update",
        orderId: order_id,
        link: "/customer/orders"
      });
    }

    res.json({
      message: "Order payment, refund, and vendor payout status updated successfully",
      refund_status: newRefundStatus,
      payment_status: newPaymentStatus,
      payout_status: payout_status || "unchanged"
    });

  } catch (err) {
    console.error("Update admin payment error:", err);
    res.status(500).json({ message: err.message });
  }
};
export const getVendorWeeklyEarnings = async (req, res) => {
  try {
    const data = await pool.query(`
      SELECT
        v.id as vendor_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.upi_id,
        v.bank_account_number,
        v.bank_ifsc,
        COALESCE(SUM(
          CASE 
            WHEN oi.payout_status = 'pending' AND oi.item_status != 'cancelled'
            THEN oi.vendor_earning
            ELSE 0
          END
        ), 0) as total_earning,
        COALESCE(SUM(
          CASE 
            WHEN oi.payout_status = 'pending' AND oi.item_status != 'cancelled'
            THEN oi.commission_amount
            ELSE 0
          END
        ), 0) as cod_due
      FROM vendors v
      LEFT JOIN order_items oi ON oi.vendor_id = v.id
      LEFT JOIN orders o ON oi.order_id = o.id
      GROUP BY v.id, v.business_name, v.owner_name, v.phone, v.upi_id, v.bank_account_number, v.bank_ifsc
      ORDER BY total_earning DESC;
    `);

    res.json(data.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

export const clearVendorPayment = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { reference } = req.body;

    const vendorRes = await pool.query(
      `SELECT v.id, v.user_id, v.business_name FROM vendors v WHERE v.id=$1`,
      [vendorId]
    );

    if (!vendorRes.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendor = vendorRes.rows[0];
    const txnRef = reference || `PAY-${Date.now()}`;

    // Get total pending earning amount
    const pendingSum = await pool.query(
      `SELECT COALESCE(SUM(vendor_earning), 0) as total
       FROM order_items
       WHERE vendor_id=$1 AND payout_status='pending' AND item_status != 'cancelled'`,
      [vendorId]
    );

    const amount = Number(pendingSum.rows[0].total || 0);

    await pool.query("BEGIN");

    await pool.query(
      `UPDATE order_items
       SET payout_status='paid',
           payout_reference=$1
       WHERE vendor_id=$2 AND payout_status='pending' AND item_status != 'cancelled'`,
      [txnRef, vendorId]
    );

    await pool.query("COMMIT");

    // Real-time Notification to Vendor User
    if (vendor.user_id) {
      await notifyUser({
        userId: vendor.user_id,
        title: "💰 Payout Disbursed",
        message: `Payout settlement of ₹${amount} for "${vendor.business_name}" has been cleared & processed by Admin (Txn Ref: ${txnRef}).`,
        type: "payout",
        link: "/vendor/payments"
      });
    }

    res.json({
      message: `Payout of ₹${amount} cleared successfully`,
      reference: txnRef,
      amount
    });

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("PAYOUT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
export const getVendorDetails = async (req,res)=>{

try{

const { id } = req.params;

const vendor = await pool.query(
`
SELECT
v.id,
v.business_name,
v.phone,
v.shop_address,
v.upi_id,
v.kyc_status,
u.name,
u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE v.id=$1
`,
[id]
);

res.json(vendor.rows[0]);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});


}

};