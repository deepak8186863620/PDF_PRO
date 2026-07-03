import "dotenv/config";
import nodemailer from "nodemailer";

/* 
  Usage: node scripts/broadcast.js
  
  This script allows you to send an email to a list of users.
  Make sure you have your SMTP credentials configured in your .env file:
  - SMTP_HOST
  - SMTP_PORT
  - SMTP_USER
  - SMTP_PASS
*/

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error("❌ Email configuration missing in .env file.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT || 587,
  secure: SMTP_PORT === "465",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ==========================================
// CONFIGURATION
// ==========================================

// Replace this with the array of user emails you want to send the update to
const BATCH_EMAILS = [
  "test1@example.com",
  "test2@example.com",
];

const SUBJECT = "Huge Updates to PageDocx! 🎉";

const HTML_BODY = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
    <h1 style="color: #000;">Hello from PageDocx!</h1>
    <p>We've just pushed a massive update to the platform that we think you're going to love.</p>
    
    <h3>What's New:</h3>
    <ul>
      <li><strong>Blazing Fast Performance:</strong> Processing PDFs is now 3x faster.</li>
      <li><strong>New AI Tools:</strong> Smarter document analysis.</li>
      <li><strong>Dark Mode Enhancements:</strong> A completely refined UI.</li>
    </ul>

    <p>We wanted to say a huge thank you for being an early supporter. Jump back in and let us know what you think!</p>
    
    <br/>
    <a href="https://yourwebsite.com" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Explore PageDocx</a>
    
    <br/><br/>
    <p>Best regards,</p>
    <p><strong>The PageDocx Team</strong></p>
  </div>
`;

// ==========================================

async function sendBroadcast() {
  console.log(`🚀 Starting broadcast to ${BATCH_EMAILS.length} users...`);
  
  let successCount = 0;
  let failCount = 0;

  for (const email of BATCH_EMAILS) {
    try {
      await transporter.sendMail({
        from: `"PageDocx Team" <${SMTP_USER}>`,
        to: email,
        subject: SUBJECT,
        html: HTML_BODY
      });
      console.log(`✅ Sent to ${email}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to send to ${email}:`, err.message);
      failCount++;
    }
    
    // Slight delay to prevent spam rate-limits
    await new Promise(res => setTimeout(res, 500));
  }

  console.log(`\n🎉 Broadcast Complete!`);
  console.log(`Successfully sent: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

sendBroadcast();
