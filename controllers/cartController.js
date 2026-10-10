import pool from "../config/db.js";

/* ADD TO CART / INCREMENT OR DECREMENT */
export const addToCart = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const userId = req.user.id;

    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const qty = Number(quantity) || 1;

    // Check existing item
    const existing = await pool.query(
      "SELECT quantity FROM carts WHERE user_id=$1 AND product_id=$2",
      [userId, product_id]
    );

    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity + qty;

      if (newQty <= 0) {
        await pool.query(
          "DELETE FROM carts WHERE user_id=$1 AND product_id=$2",
          [userId, product_id]
        );
        return res.json({ message: "Item removed from cart" });
      }

      await pool.query(
        "UPDATE carts SET quantity=$1 WHERE user_id=$2 AND product_id=$3",
        [newQty, userId, product_id]
      );
    } else {
      if (qty > 0) {
        await pool.query(
          "INSERT INTO carts(user_id, product_id, quantity) VALUES($1, $2, $3)",
          [userId, product_id, qty]
        );
      }
    }

    res.json({ message: "Cart updated successfully" });
  } catch (err) {
    console.error("Error in addToCart:", err);
    res.status(500).json({ message: "Failed to update cart" });
  }
};

/* GET CART WITH PRODUCT & VENDOR INFO */
export const getCart = async (req, res) => {
  try {
    const cart = await pool.query(
      `SELECT 
        p.*, 
        c.quantity,
        v.business_name
       FROM carts c
       JOIN products p ON p.id = c.product_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       WHERE c.user_id = $1
       ORDER BY c.id DESC`,
      [req.user.id]
    );

    res.json(cart.rows);
  } catch (err) {
    console.error("Error in getCart:", err);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};

/* MERGE GUEST CART ON LOGIN */
export const mergeCart = async (req, res) => {
  try {
    const { items } = req.body;
    const userId = req.user.id;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const productId = item.product_id || item.id;
        const qty = Math.max(1, Number(item.quantity) || 1);

        if (!productId) continue;

        // Check if item already exists in user's cart
        const existing = await pool.query(
          "SELECT quantity FROM carts WHERE user_id=$1 AND product_id=$2",
          [userId, productId]
        );

        if (existing.rows.length > 0) {
          // Increment or set
          await pool.query(
            "UPDATE carts SET quantity = quantity + $1 WHERE user_id=$2 AND product_id=$3",
            [qty, userId, productId]
          );
        } else {
          await pool.query(
            "INSERT INTO carts (user_id, product_id, quantity) VALUES ($1, $2, $3)",
            [userId, productId, qty]
          );
        }
      }
    }

    // Return the updated cart
    const updated = await pool.query(
      `SELECT 
        p.*, 
        c.quantity,
        v.business_name
       FROM carts c
       JOIN products p ON p.id = c.product_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       WHERE c.user_id = $1
       ORDER BY c.id DESC`,
      [userId]
    );

    res.json({ message: "Cart merged successfully", cart: updated.rows });
  } catch (err) {
    console.error("Error in mergeCart:", err);
    res.status(500).json({ message: "Failed to merge cart" });
  }
};

/* REMOVE SPECIFIC PRODUCT FROM CART */
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    await pool.query(
      "DELETE FROM carts WHERE user_id=$1 AND product_id=$2",
      [userId, productId]
    );

    res.json({ message: "Item removed from cart" });
  } catch (err) {
    console.error("Error in removeFromCart:", err);
    res.status(500).json({ message: "Failed to remove item" });
  }
};

/* CLEAR ENTIRE CART */
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query("DELETE FROM carts WHERE user_id=$1", [userId]);
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("Error in clearCart:", err);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};