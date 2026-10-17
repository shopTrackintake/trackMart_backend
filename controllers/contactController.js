import pool from "../config/db.js";
import { notifyUser } from "../services/notificationService.js";
import { sendEmail } from "../utils/sendEmail.js";

/* ================= SEND MESSAGE ================= */
export const sendMessage = async (req, res) => {
  try {
    let { name, email, phone, subject, message } = req.body;
    let user_id = null;

    let userRole = "guest";
    // Logged-in user auto attach
    if (req.user) {
      user_id = req.user.id;
      userRole = req.user.role || "customer";
    }

    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Name, Email, and Message are required"
      });
    }

    const cleanSubject = subject?.trim() || "Customer Support Inquiry";
    const cleanPhone = phone?.trim() || null;

    const result = await pool.query(
      `
      INSERT INTO contact_messages 
      (user_id, name, email, phone, subject, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'unread')
      RETURNING *
      `,
      [user_id, name.trim(), email.trim().toLowerCase(), cleanPhone, cleanSubject, message.trim()]
    );

    const savedMessage = result.rows[0];

    // 🔔 Notify Admins in Database & Real-time WebSocket Bell
    try {
      const admins = await pool.query(
        "SELECT id, email, name FROM users WHERE role='admin'"
      );

      const notifTitle = userRole === "vendor" 
        ? "🏪 New Vendor Inquiry" 
        : userRole === "customer" 
        ? "🛒 New Customer Inquiry" 
        : "📬 New Contact Inquiry";

      const roleBadge = userRole === "vendor" ? "Vendor Merchant" : userRole === "customer" ? "Customer" : "Guest Visitor";

      for (const admin of admins.rows) {
        // In-app notification bell & WebSocket push
        await notifyUser({
          userId: admin.id,
          title: notifTitle,
          message: `${name} (${roleBadge}): "${message.substring(0, 75)}${message.length > 75 ? "..." : ""}"`,
          type: "contact",
          link: "/admin/support"
        });

        // 📧 Gmail / Email Notification to Admin
        const targetAdminEmail = admin.email || process.env.ADMIN_EMAIL || "shop.trackintake@gmail.com";
        const emailSubject = `[TrackMart ${roleBadge}] New Message from ${name}`;
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">TrackMart Customer & Vendor Care</h1>
              <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">New ${roleBadge} Submission Received</p>
            </div>
            
            <div style="padding: 28px 24px;">
              <p style="font-size: 15px; color: #1e293b; margin-top: 0;">
                Hello <strong>Admin</strong>, a <strong>${roleBadge}</strong> submitted a new message through the Support / Contact system.
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f97316; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600; width: 100px;">Name:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600;">Email:</td>
                    <td style="padding: 6px 0;"><a href="mailto:${email}" style="color: #ea580c; text-decoration: none;">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600;">Phone:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${cleanPhone || "Not provided"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: 600;">Subject:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${cleanSubject}</td>
                  </tr>
                </table>
                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
                  <strong style="display: block; margin-bottom: 6px; color: #0f172a; font-size: 14px;">Message:</strong>
                  <div style="white-space: pre-wrap; font-size: 14px; color: #334155; line-height: 1.6; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${message}</div>
                </div>
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/admin/support" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                  View & Manage in Admin Panel →
                </a>
              </div>
            </div>

            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              This is an automated notification from TrackMart Marketplace system.
            </div>
          </div>
        `;

        sendEmail({
          to: targetAdminEmail,
          subject: emailSubject,
          text: `TrackMart Contact Message\n\nFrom: ${name} (${email})\nPhone: ${cleanPhone || "N/A"}\nSubject: ${cleanSubject}\n\nMessage:\n${message}`,
          html: emailHtml
        }).catch(emailErr => {
          console.error("Failed to send admin contact email:", emailErr?.message);
        });
      }
    } catch (notifErr) {
      console.error("Error creating admin notification for contact message:", notifErr);
    }

    res.json({
      message: "Your message has been sent successfully! Our support team will get back to you shortly.",
      data: savedMessage
    });

  } catch (err) {
    console.error("Error in sendMessage:", err);
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
};


/* ================= ADMIN: GET ALL ================= */
export const getMessages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_messages ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching contact messages:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
};


/* ================= MARK AS READ ================= */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE contact_messages SET status='read' WHERE id=$1`,
      [id]
    );

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Error updating message" });
  }
};


/* ================= ADMIN: DELETE MESSAGE ================= */
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM contact_messages WHERE id=$1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Contact message not found" });
    }

    res.json({ message: "Contact message deleted successfully", id });
  } catch (err) {
    console.error("Error deleting contact message:", err);
    res.status(500).json({ message: "Error deleting message" });
  }
};