import pool from "../config/db.js";
import { getIO } from "../config/socket.js";

/**
 * Creates and sends a notification to a specific user via DB & WebSockets.
 * @param {Object} params
 * @param {number} params.userId - User ID receiving the notification
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.type='order'] - Notification type ('order', 'order_status', 'order_otp', etc.)
 * @param {number|null} [params.orderId=null] - Order ID associated with the notification
 * @param {string|null} [params.link=null] - Frontend route path to navigate on click
 */
export const notifyUser = async ({
  userId,
  title,
  message,
  type = "order",
  orderId = null,
  link = null
}) => {
  try {
    if (!userId) return null;

    const res = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, order_id, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, title, message, type, orderId, link]
    );

    const notification = res.rows[0];

    // Real-time WebSocket Push to user's dedicated socket room
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit("new_notification", notification);
      if (orderId) {
        io.to(`user_${userId}`).emit("order_updated", {
          orderId,
          notification
        });
      }
    }

    return notification;
  } catch (err) {
    console.error("❌ Failed to notify user:", err.message);
  }
};
