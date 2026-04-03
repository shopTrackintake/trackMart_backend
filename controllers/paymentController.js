import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* CREATE ORDER */
export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
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
      razorpay_signature
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex"); // ⚠️ IMPORTANT

    if (expectedSignature === razorpay_signature) {
      return res.json({ success: true });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid signature"
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};