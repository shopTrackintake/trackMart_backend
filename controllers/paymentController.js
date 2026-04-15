import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* CREATE ORDER */
export const createOrder = async (req, res) => {
  try {
    const { amount, type } = req.body;

    const receipt = type === "vendor_due"
      ? `vendor_due_${req.user?.id}_${Date.now()}`
      : `order_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt
    });

    res.json({ success: true, order });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

/* VERIFY PAYMENT */
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type   // 🔥 add this
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature"
      });
    }

    // ================= 🔥 VENDOR DUES LOGIC =================
    if (type === "vendor_due") {

      const vendor = await pool.query(
        "SELECT id FROM vendors WHERE user_id=$1",
        [req.user.id]
      );

      if (!vendor.rows.length) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      const vendorId = vendor.rows[0].id;

      // 🔥 clear COD dues
      await pool.query(`
      UPDATE order_items
      SET payout_status='adjusted'
      WHERE vendor_id=$1
      AND payout_status='pending'
      AND commission_amount > 0
      `,[vendorId]);

    }

    return res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};
