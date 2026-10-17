import dotenv from "dotenv";
dotenv.config();
import { Resend } from "resend";
import nodemailer from "nodemailer";

let resendClient = null;
if (process.env.RESEND_API_KEY) {
  try {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  } catch (e) {
    console.error("Resend init error:", e.message);
  }
}

// Nodemailer transport if Gmail or SMTP credentials are configured
let transporter = null;
if (process.env.GMAIL_USER && (process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD)) {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD,
      },
    });
  } catch (err) {
    console.warn("Nodemailer Gmail init error:", err.message);
  }
} else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch (err) {
    console.warn("Nodemailer SMTP init error:", err.message);
  }
}

export const sendEmail = async ({ to, subject, text, html }) => {
  // 1. Try Nodemailer / Gmail if available
  if (transporter) {
    try {
      const fromAddr = process.env.EMAIL_FROM || process.env.GMAIL_USER || `"TrackMart Support" <shop.trackintake@gmail.com>`;
      const info = await transporter.sendMail({
        from: fromAddr,
        to,
        subject,
        text,
        html: html || text,
      });
      console.log("✅ Email sent via Nodemailer/Gmail:", info.messageId);
      return { success: true, info };
    } catch (err) {
      console.warn("⚠️ Nodemailer failed, attempting Resend fallback:", err.message);
    }
  }

  // 2. Try Resend
  if (resendClient) {
    try {
      const response = await resendClient.emails.send({
        from: process.env.RESEND_FROM || "onboarding@resend.dev",
        to,
        subject,
        text,
        html: html || text,
      });

      console.log("✅ Email sent via Resend:", response);
      return { success: true, response };
    } catch (err) {
      console.error("❌ Resend email error:", err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: "No email provider configured" };
};