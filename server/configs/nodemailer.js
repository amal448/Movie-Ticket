import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
console.log("user,pass", process.env.SMTP_USER, process.env.SMTP_PASS);

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