import pool from "../config/db.js";
import { notifyUser } from "../services/notificationService.js";

export const createOrder = async (req, res) => {
  try {

    const { payment_method, address_id } = req.body;
    const userId = req.user.id;

    if (payment_method === "COD") {
      return res.status(400).json({ message: "Cash on Delivery is disabled. Orders must be paid online via Razorpay." });
    }

    const cart = await pool.query(
      `SELECT c.*, p.price, p.vendor_id, p.title
       FROM carts c
       JOIN products p ON p.id=c.product_id
       WHERE c.user_id=$1`,
      [userId]
    );

    if (!cart.rows.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let total = 0;

    for (let item of cart.rows) {
      const productTotal =
        Number(item.price) * Number(item.quantity);

     

      total += productTotal ;
    }

    const order = await pool.query(
`INSERT INTO orders
(user_id,total_amount,payment_method,payment_status,order_status,address_id)
VALUES($1,$2,$3,$4,$5,$6)
RETURNING *`,
[
userId,
total,
payment_method,
"pending",
"placed",
address_id
]
);

    const orderId = order.rows[0].id;

    for (let item of cart.rows) {

      const productTotal =
        Number(item.price) * Number(item.quantity);

      // 0% Platform Commission on all orders (COD & Online)
      const commission = 0;
      const earning = productTotal;

      await pool.query(
        `INSERT INTO order_items
        (order_id,product_id,vendor_id,price_at_purchase,quantity,
         commission_amount,vendor_earning,payout_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          orderId,
          item.product_id,
          item.vendor_id,
          item.price,
          item.quantity,
          commission,
          earning,
          payment_method === "COD" ? "paid" : "pending"
        ]
      );

      /* ================= NOTIFICATION FOR VENDOR ================= */

      const vendorUser = await pool.query(
        `
        SELECT u.id
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        WHERE v.id = $1
        `,
        [item.vendor_id]
      );

      if (vendorUser.rows.length) {
        const vendorUserId = vendorUser.rows[0].id;

        await notifyUser({
          userId: vendorUserId,
          title: "📦 New Order Received",
          message: `You received a new order for product "${item.title}" (Order #${orderId.toString().slice(0, 8).toUpperCase()}).`,
          type: "order",
          orderId,
          link: `/vendor/orders/${orderId}`
        });
      }

    }

    /* ================= NOTIFICATION FOR BUYER ================= */
    await notifyUser({
      userId,
      title: "🎉 Order Placed Successfully",
      message: `Your order #${orderId.toString().slice(0, 8).toUpperCase()} (Total: ₹${total}) has been placed successfully!`,
      type: "order",
      orderId,
      link: "/customer/orders"
    });

    await pool.query(
      "DELETE FROM carts WHERE user_id=$1",
      [userId]
    );

  res.json({ message: "Order placed successfully", order_id: orderId });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {

    const { order_id, payment_id } = req.body;

    console.log("UPDATE PAYMENT:", order_id, payment_id);

    const result = await pool.query(
      `UPDATE orders 
       SET payment_status = 'paid',
           payment_id = $1
       WHERE id = $2
       RETURNING *`,
      [payment_id, order_id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "Order not found"
      });
    }

    const updatedOrder = result.rows[0];

    /* ================= NOTIFY BUYER OF CONFIRMED PAYMENT ================= */
    await notifyUser({
      userId: updatedOrder.user_id,
      title: "💳 Payment Confirmed",
      message: `Payment of ₹${updatedOrder.total_amount} for Order #${order_id.toString().slice(0, 8).toUpperCase()} was successful!`,
      type: "order_payment",
      orderId: order_id,
      link: "/customer/orders"
    });

    console.log("UPDATED ORDER:", updatedOrder);

    res.json({
      message: "Payment updated",
      order: updatedOrder
    });

  } catch (err) {
    console.log("PAYMENT UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
export const getUserOrders = async (req, res) => {
  try {

    const userId = req.user.id;

    const orders = await pool.query(
      `SELECT *
       FROM orders
       WHERE user_id=$1
       ORDER BY created_at DESC`,
      [userId]
    );

    const result = [];

    for (const order of orders.rows) {
      const items = await pool.query(
        `SELECT 
          oi.id,
          oi.quantity,
          oi.item_status,
          oi.delivery_date,
          oi.price_at_purchase,
          oi.refund_status,
          oi.refund_amount,
          oi.cancellation_reason,
          p.title AS product_title,
          p.health_rating
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1`,
        [order.id]
      );

      result.push({
        ...order,
        items: items.rows
      });
    }

    res.json(result);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= CANCEL ORDER (BUYER) ================= */
export const cancelOrder = async (req, res) => {
  try {
    const { order_id, reason } = req.body;
    const userId = req.user.id;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // Verify order exists and belongs to this user
    const orderRes = await pool.query(
      `SELECT * FROM orders WHERE id=$1 AND user_id=$2`,
      [order_id, userId]
    );

    if (!orderRes.rows.length) {
      return res.status(404).json({ message: "Order not found or unauthorized" });
    }

    const order = orderRes.rows[0];

    if (order.order_status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    // Check item statuses - buyer can only cancel BEFORE vendor sets in_transit/delivered
    const itemsRes = await pool.query(
      `SELECT oi.*, p.title as product_title, p.vendor_id
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id=$1`,
      [order_id]
    );

    const hasShippedOrDelivered = itemsRes.rows.some((item) =>
      ["in_transit", "delivered"].includes(String(item.item_status || "").toLowerCase())
    );

    if (hasShippedOrDelivered) {
      return res.status(400).json({
        message: "Order cannot be cancelled because it has already been dispatched or delivered by the vendor."
      });
    }

    const cancelReason = reason || "Cancelled by buyer";
    const refundNote = "Refund initiated automatically. Amount will be credited to your original payment method in 3-5 business days.";

    // Update order status to cancelled
    await pool.query(
      `UPDATE orders
       SET order_status = 'cancelled',
           payment_status = 'refunded',
           refund_status = 'processing',
           refund_amount = total_amount,
           refund_note = $1,
           cancellation_reason = $2,
           cancelled_at = NOW()
       WHERE id = $3`,
      [refundNote, cancelReason, order_id]
    );

    // Update order items status to cancelled & restore stock
    for (const item of itemsRes.rows) {
      await pool.query(
        `UPDATE order_items
         SET item_status = 'cancelled',
             refund_status = 'processing',
             refund_amount = (price_at_purchase * quantity),
             cancellation_reason = $1
         WHERE id = $2`,
        [cancelReason, item.id]
      );

      // Restore product stock
      await pool.query(
        `UPDATE products
         SET stock = stock + $1
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      // Notify Vendor
      const vendorUser = await pool.query(
        `SELECT u.id FROM vendors v JOIN users u ON v.user_id = u.id WHERE v.id = $1`,
        [item.vendor_id]
      );

      if (vendorUser.rows.length) {
        await notifyUser({
          userId: vendorUser.rows[0].id,
          title: "🚫 Order Cancelled by Buyer",
          message: `Order #${order_id.toString().slice(0, 8).toUpperCase()} for product "${item.product_title}" was cancelled by the buyer.`,
          type: "order_cancelled",
          orderId: order_id,
          link: `/vendor/orders/${order_id}`
        });
      }
    }

    // Notify Buyer
    await notifyUser({
      userId,
      title: "🚫 Order Cancelled & Refund Initiated",
      message: `Your order #${order_id.toString().slice(0, 8).toUpperCase()} has been cancelled. ${refundNote}`,
      type: "order_cancelled",
      orderId: order_id,
      link: "/customer/orders"
    });

    res.json({
      message: "Order cancelled successfully. Refund of full amount has been initiated and will reflect in 3-5 business days.",
      refund_status: "processing",
      refund_note: refundNote
    });

  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(500).json({ message: err.message });
  }
};