import pool from "../config/db.js";

/* ================= SEND MESSAGE ================= */
export const sendMessage = async (req, res) => {
  try {

    let { name, email, phone, message } = req.body;
    let user_id = null;

    // ✅ logged-in user auto attach
    if (req.user) {
      user_id = req.user.id;
    }

    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Name, Email, Message required"
      });
    }

    await pool.query(
      `
      INSERT INTO contact_messages 
      (user_id, name, email, phone, message)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [user_id, name, email, phone, message]
    );

    res.json({ message: "Message sent successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to send message" });
  }
};


/* ================= ADMIN: GET ALL ================= */
export const getMessages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_messages ORDER BY created_at DESC`
    );

    res.json(result.rows);

  } catch {
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

  } catch {
    res.status(500).json({ message: "Error updating" });
  }
};