import pool from "../config/db.js";
import { notifyUser } from "../services/notificationService.js";
export const getAllVendors = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT 
        v.id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.shop_address,
        v.pincode,
        v.kyc_status,
        v.commission_percent,
        v.created_at,
        u.name as user_name,
        u.email,
        (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id AND (p.status != 'deleted' OR p.status IS NULL)) as product_count
      FROM vendors v
      JOIN users u ON v.user_id = u.id
    `;
    const params = [];
    if (status && status !== "all") {
      query += ` WHERE v.kyc_status = $1`;
      params.push(status);
    }
    query += ` ORDER BY v.created_at DESC`;

    const vendors = await pool.query(query, params);
    res.json(vendors.rows);
  } catch (err) {
    console.error("Error in getAllVendors:", err);
    res.status(500).json({ message: err.message });
  }
};
/* ================= DASHBOARD STATS ================= */

export const getAdminStats = async (req, res) => {
  try {
    const [
      vendorsRes,
      approvedVendorsRes,
      pendingVendorsRes,
      revenueRes,
      grossSalesRes,
      ordersRes,
      pendingItemsRes,
      inTransitItemsRes,
      deliveredItemsRes,
      productsRes,
      ticketsRes,
      recentOrdersRes,
      recentVendorsRes
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM vendors"),
      pool.query("SELECT COUNT(*) FROM vendors WHERE kyc_status='approved'"),
      pool.query("SELECT COUNT(*) FROM vendors WHERE kyc_status='pending'"),
      pool.query("SELECT COALESCE(SUM(commission_amount),0) as total FROM order_items"),
      pool.query("SELECT COALESCE(SUM(total_amount),0) as total FROM orders"),
      pool.query("SELECT COUNT(*) FROM orders"),
      pool.query("SELECT COUNT(*) FROM order_items WHERE item_status='pending_vendor'"),
      pool.query("SELECT COUNT(*) FROM order_items WHERE item_status='in_transit'"),
      pool.query("SELECT COUNT(*) FROM order_items WHERE item_status='delivered'"),
      pool.query("SELECT COUNT(*) FROM products WHERE status != 'deleted' OR status IS NULL"),
      pool.query("SELECT COUNT(*) FROM support_tickets WHERE status='open'"),
      pool.query(`
        SELECT o.id, o.total_amount, o.payment_status, o.created_at, u.name as customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT v.id, v.business_name, v.kyc_status, v.created_at, u.name, u.email
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
        LIMIT 5
      `)
    ]);

    res.json({
      vendors: Number(vendorsRes.rows[0].count),
      approvedVendors: Number(approvedVendorsRes.rows[0].count),
      pending: Number(pendingVendorsRes.rows[0].count),
      revenue: Number(revenueRes.rows[0].total),
      grossVolume: Number(grossSalesRes.rows[0].total),
      totalOrders: Number(ordersRes.rows[0].count),
      pendingOrders: Number(pendingItemsRes.rows[0].count),
      inTransitOrders: Number(inTransitItemsRes.rows[0].count),
      deliveredOrders: Number(deliveredItemsRes.rows[0].count),
      totalProducts: Number(productsRes.rows[0].count),
      openTickets: Number(ticketsRes.rows[0].count),
      recentOrders: recentOrdersRes.rows,
      recentVendors: recentVendorsRes.rows
    });
  } catch (err) {
    console.error("Error in getAdminStats:", err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= GET PENDING VENDORS ================= */

export const getPendingVendors = async (req, res) => {
  try {
    const vendors = await pool.query(`
      SELECT 
        v.id,
        v.user_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.shop_address,
        v.pincode,
        v.kyc_status,
        v.commission_percent,
        v.created_at,
        v.gst_number,
        v.pan_number,
        v.fssai_number,
        v.upi_id,
        v.bank_holder_name,
        v.bank_account_number,
        v.bank_ifsc,
        u.name,
        u.email,
        u.phone as user_phone
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.kyc_status IN ('pending', 'hold')
      ORDER BY v.created_at DESC
    `);

    res.json(vendors.rows);
  } catch (err) {
    console.error("Error in getPendingVendors:", err);
    res.status(500).json({ message: err.message });
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
export const getAdminProducts = async (req, res) => {
  try {
    const products = await pool.query(
      `
      SELECT
        p.*,
        v.id AS vendor_id,
        v.business_name,
        v.owner_name,
        c.name AS category_name
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.status != 'deleted' OR p.status IS NULL)
      ORDER BY p.created_at DESC
      `
    );

    res.json(products.rows);
  } catch (err) {
    console.error("Error in getAdminProducts:", err);
    res.status(500).json({ message: err.message });
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
v.id AS vendor_id,
v.business_name,
v.owner_name,
v.phone AS vendor_phone
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
        u.phone AS buyer_phone,
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
        oi.vendor_earning,
        oi.commission_amount,
        oi.delivery_date,
        oi.otp_used_at AS delivered_at,
        v.id AS vendor_id,
        v.business_name,
        v.owner_name AS vendor_owner,
        v.phone AS vendor_phone,
        p.id AS product_id,
        p.title AS product_name,
        p.image_url AS product_image,
        p.size AS product_size,
        a.full_name AS shipping_name,
        a.phone AS shipping_phone,
        a.house_no,
        a.street,
        a.locality,
        a.landmark,
        a.city,
        a.state,
        a.pincode
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN vendors v ON oi.vendor_id = v.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN addresses a ON o.address_id = a.id
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
    const { order_id, item_id, order_status, refund_status, payment_status, refund_note, payout_status, payout_reference } = req.body;

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

    // If order_status / item_status is updated
    if (order_status) {
      if (item_id) {
        await pool.query(
          "UPDATE order_items SET item_status=$1 WHERE id=$2",
          [order_status, item_id]
        );
      } else {
        await pool.query(
          "UPDATE order_items SET item_status=$1 WHERE order_id=$2",
          [order_status, order_id]
        );
      }
    }

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
        v.user_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.shop_address,
        v.pincode,
        v.upi_id,
        v.bank_holder_name,
        v.bank_account_number,
        v.bank_ifsc,
        v.pan_number,
        v.gst_number,
        v.fssai_number,
        v.commission_percent,
        COALESCE(SUM(
          CASE 
            WHEN oi.payout_status = 'pending' AND oi.item_status != 'cancelled'
            THEN oi.vendor_earning
            ELSE 0
          END
        ), 0) as total_earning,
        COALESCE(SUM(
          CASE 
            WHEN oi.payout_status = 'paid'
            THEN oi.vendor_earning
            ELSE 0
          END
        ), 0) as total_settled,
        COALESCE(SUM(
          CASE 
            WHEN oi.payout_status = 'pending' AND oi.item_status != 'cancelled'
            THEN oi.commission_amount
            ELSE 0
          END
        ), 0) as cod_due,
        COUNT(
          CASE 
            WHEN oi.payout_status = 'pending' AND oi.item_status != 'cancelled'
            THEN oi.id
          END
        ) as pending_orders_count,
        COUNT(oi.id) as total_orders_count
      FROM vendors v
      LEFT JOIN order_items oi ON oi.vendor_id = v.id
      GROUP BY 
        v.id, v.user_id, v.business_name, v.owner_name, v.phone, 
        v.shop_address, v.pincode, v.upi_id, v.bank_holder_name, 
        v.bank_account_number, v.bank_ifsc, v.pan_number, v.gst_number, 
        v.fssai_number, v.commission_percent
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
    const { reference, amount: customAmount } = req.body;

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

    const calculatedTotal = Number(pendingSum.rows[0].total || 0);
    const amount = (customAmount !== undefined && customAmount !== null && customAmount !== "")
      ? Number(customAmount)
      : calculatedTotal;

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

/* ================= VENDOR PAYOUT ITEMS BREAKDOWN ================= */
export const getVendorPayoutItems = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const items = await pool.query(
      `
      SELECT
        oi.id AS item_id,
        oi.order_id,
        oi.product_id,
        oi.price_at_purchase,
        oi.quantity,
        oi.vendor_earning,
        oi.commission_amount,
        oi.payout_status,
        oi.payout_reference,
        oi.item_status,
        oi.created_at,
        p.title AS product_name,
        p.image_url AS product_image,
        p.size AS product_size,
        o.payment_method,
        o.payment_status,
        u.name AS buyer_name,
        u.email AS buyer_email
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE oi.vendor_id = $1
      ORDER BY oi.created_at DESC
      LIMIT 100
      `,
      [vendorId]
    );

    res.json(items.rows);
  } catch (err) {
    console.error("Error fetching vendor payout items:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= BUYER REFUNDS LIST ================= */
export const getBuyerRefunds = async (req, res) => {
  try {
    const refunds = await pool.query(`
      SELECT
        o.id AS order_id,
        o.user_id,
        u.name AS buyer_name,
        u.email AS buyer_email,
        u.phone AS buyer_phone,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        COALESCE(o.refund_status, 'none') AS refund_status,
        COALESCE(o.refund_amount, o.total_amount) AS refund_amount,
        o.refund_note,
        o.cancellation_reason,
        o.cancelled_at,
        o.created_at,
        a.full_name AS shipping_name,
        a.phone AS shipping_phone,
        a.house_no,
        a.street,
        a.locality,
        a.city,
        a.state,
        a.pincode,
        (
          SELECT json_agg(json_build_object(
            'item_id', oi.id,
            'product_id', oi.product_id,
            'product_name', p.title,
            'product_image', p.image_url,
            'quantity', oi.quantity,
            'price', oi.price_at_purchase,
            'vendor_name', v.business_name,
            'vendor_id', v.id
          ))
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          LEFT JOIN vendors v ON oi.vendor_id = v.id
          WHERE oi.order_id = o.id
        ) AS items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.order_status = 'cancelled' OR (o.refund_status IS NOT NULL AND o.refund_status != 'none')
      ORDER BY COALESCE(o.cancelled_at, o.created_at) DESC;
    `);

    res.json(refunds.rows);
  } catch (err) {
    console.error("Error fetching buyer refunds:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= PROCESS BUYER REFUND ================= */
export const processBuyerRefund = async (req, res) => {
  try {
    const { order_id, reference, note, amount: customAmount } = req.body;
    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const orderRes = await pool.query(`SELECT * FROM orders WHERE id=$1`, [order_id]);
    if (!orderRes.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderRes.rows[0];
    const refundRef = reference || `REF-${Date.now()}`;
    const refundNote = note || `Refund processed successfully via Ref #${refundRef}`;

    const finalRefundAmount = (customAmount !== undefined && customAmount !== null && customAmount !== "")
      ? Number(customAmount)
      : Number(order.refund_amount || order.total_amount || 0);

    await pool.query(
      `UPDATE orders
       SET refund_status = 'refunded',
           payment_status = 'refunded',
           refund_amount = $1,
           refund_note = $2
       WHERE id = $3`,
      [finalRefundAmount, refundNote, order_id]
    );

    await pool.query(
      `UPDATE order_items
       SET refund_status = 'refunded',
           refund_amount = $1
       WHERE order_id = $2`,
      [finalRefundAmount, order_id]
    );

    if (order.user_id) {
      await notifyUser({
        userId: order.user_id,
        title: "💳 Refund Disbursed Successfully",
        message: `Your refund of ₹${finalRefundAmount} for Order #${order_id.slice(0, 8).toUpperCase()} has been settled. Reference: ${refundRef}`,
        type: "order_refund_update",
        orderId: order_id,
        link: "/customer/orders"
      });
    }

    res.json({
      message: "Buyer refund processed successfully",
      reference: refundRef,
      refund_amount: finalRefundAmount
    });
  } catch (err) {
    console.error("Error processing buyer refund:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getVendorDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const vendorRes = await pool.query(
      `
      SELECT
        v.id,
        v.user_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.shop_address,
        v.pincode,
        v.upi_id,
        v.bank_holder_name,
        v.bank_account_number,
        v.bank_ifsc,
        v.pan_number,
        v.gst_number,
        v.fssai_number,
        v.commission_percent,
        v.kyc_status,
        v.created_at,
        u.name as user_name,
        u.email,
        u.phone as user_phone,
        u.created_at as user_created_at
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.id = $1
      `,
      [id]
    );

    if (!vendorRes.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendor = vendorRes.rows[0];

    // Fetch vendor products
    const productsRes = await pool.query(
      `
      SELECT 
        p.id,
        p.title,
        p.price,
        p.size,
        p.images,
        p.image_url,
        p.status,
        p.stock,
        p.created_at,
        p.delivery_charge,
        p.health_rating,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.vendor_id = $1 AND (p.status != 'deleted' OR p.status IS NULL)
      ORDER BY p.created_at DESC
      `,
      [id]
    );

    // Fetch orders count & earnings stats for this vendor
    const ordersStatsRes = await pool.query(
      `
      SELECT 
        COUNT(DISTINCT order_id) as total_orders,
        COALESCE(SUM(quantity), 0) as total_units_sold,
        COALESCE(SUM(CASE WHEN payout_status = 'settled' THEN vendor_earning ELSE 0 END), 0) as settled_earnings,
        COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN vendor_earning ELSE 0 END), 0) as pending_settlement
      FROM order_items
      WHERE vendor_id = $1
      `,
      [id]
    );

    res.json({
      vendor,
      products: productsRes.rows,
      stats: {
        totalProducts: productsRes.rows.length,
        totalOrders: Number(ordersStatsRes.rows[0]?.total_orders || 0),
        totalUnitsSold: Number(ordersStatsRes.rows[0]?.total_units_sold || 0),
        settledEarnings: Number(ordersStatsRes.rows[0]?.settled_earnings || 0),
        pendingSettlement: Number(ordersStatsRes.rows[0]?.pending_settlement || 0)
      }
    });
  } catch (err) {
    console.error("Error in getVendorDetails:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= UPDATE VENDOR STATUS (DISABLE / ENABLE / HOLD / APPROVE) ================= */
export const updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // e.g. 'approved', 'hold', 'disabled', 'rejected'

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const vendorRes = await pool.query(
      "SELECT id, user_id, business_name, kyc_status FROM vendors WHERE id=$1",
      [id]
    );

    if (!vendorRes.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendor = vendorRes.rows[0];
    const newStatus = status;

    await pool.query("UPDATE vendors SET kyc_status=$1 WHERE id=$2", [newStatus, id]);

    // If disabled, deactivate products
    if (newStatus === "disabled" || newStatus === "hold" || newStatus === "rejected") {
      await pool.query("UPDATE products SET status='inactive' WHERE vendor_id=$1 AND status='active'", [id]);
    } else if (newStatus === "approved") {
      await pool.query("UPDATE products SET status='active' WHERE vendor_id=$1 AND status='inactive'", [id]);
    }

    // Attempt to notify user
    try {
      await notifyUser(
        vendor.user_id,
        "vendor",
        `Your store account status has been updated to "${newStatus}". ${reason ? `Reason: ${reason}` : ""}`
      );
    } catch (notifErr) {
      console.warn("Notification error:", notifErr.message);
    }

    res.json({ 
      message: `Vendor status successfully updated to ${newStatus}`,
      status: newStatus 
    });
  } catch (err) {
    console.error("Error in updateVendorStatus:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= PLATFORM SETTINGS ================= */
export const getPlatformSettings = async (req, res) => {
  try {
    const settingsRes = await pool.query("SELECT key, value, description, updated_at FROM platform_settings");
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.key] = r.value;
    });

    // Also get vendors summary with commission
    const vendorsRes = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.commission_percent,
        (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) as product_count
      FROM vendors v
      WHERE v.kyc_status = 'approved'
      ORDER BY v.business_name ASC
    `);

    res.json({
      settings,
      vendors: vendorsRes.rows
    });
  } catch (err) {
    console.error("Error in getPlatformSettings:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updatePlatformSettings = async (req, res) => {
  try {
    const { platform_commission_percent, apply_to_all_vendors } = req.body;

    if (platform_commission_percent !== undefined) {
      const commVal = parseFloat(platform_commission_percent);
      if (isNaN(commVal) || commVal < 0 || commVal > 100) {
        return res.status(400).json({ message: "Commission percentage must be between 0 and 100" });
      }

      await pool.query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('platform_commission_percent', $1, 'Global Platform Commission Percentage applied to marketplace orders', NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
        [commVal.toString()]
      );

      // If admin opted to bulk update all vendors
      if (apply_to_all_vendors) {
        await pool.query(
          "UPDATE vendors SET commission_percent = $1",
          [commVal]
        );
      }
    }

    res.json({
      message: "Platform settings updated successfully",
      platform_commission_percent
    });
  } catch (err) {
    console.error("Error in updatePlatformSettings:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateVendorCommission = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { commission_percent } = req.body;

    const commVal = parseFloat(commission_percent);
    if (isNaN(commVal) || commVal < 0 || commVal > 100) {
      return res.status(400).json({ message: "Commission percentage must be between 0 and 100" });
    }

    await pool.query(
      "UPDATE vendors SET commission_percent = $1 WHERE id = $2",
      [commVal, vendorId]
    );

    res.json({
      message: `Commission for vendor #${vendorId} set to ${commVal}%`,
      vendor_id: vendorId,
      commission_percent: commVal
    });
  } catch (err) {
    console.error("Error in updateVendorCommission:", err);
    res.status(500).json({ message: err.message });
  }
};