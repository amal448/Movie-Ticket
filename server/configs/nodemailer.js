import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.SMTP_USER, // your email
    pass: process.env.SMTP_PASS  // your app password
  }
});
const sendMail = async ({to,subject,body}) => {
const response=  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to,
    subject,
    // text: "Your movie ticket is confirmed!",
    html: body,
  });
  return response
}
export default sendMail