import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, text }) => {
  try {
    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // testing sender
      to,
      subject,
      text,
    });

    console.log("✅ Email sent:", response);
  } catch (err) {
    console.log("❌ Email error:", err.message);
  }
};