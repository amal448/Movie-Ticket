import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  // Option A: use service
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER, // must be your Gmail address
    pass: process.env.SMTP_PASS, // 16-char App Password (no spaces)
  },
  // Option B (alternative): explicit host/port
  // host: process.env.SMTP_HOST,
  // port: Number(process.env.SMTP_PORT || 587),
  // secure: Number(process.env.SMTP_PORT || 587) === 465,
});

// verify connection (useful to see auth errors at startup)
transporter.verify()
  .then(() => console.log("✅ Mailer ready"))
  .catch(err => console.error("❌ Mailer verify failed:", err));

const sendMail = async ({ to, subject, body }) => {
  try {
    const fromAddress = process.env.SENDER_EMAIL || process.env.SMTP_USER;
    const response = await transporter.sendMail({
      from: `"Movie Ticket App" <${fromAddress}>`,
      to,
      subject,
      html: body,
    });
    console.log("Email sent:", response.messageId);
    return response;
  } catch (error) {
    console.error("sendMail error:", error);
    throw error; // rethrow so callers (Inngest) can see failure
  }
};

export default sendMail;
