import "dotenv/config";
import nodemailer from "nodemailer";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

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

// Initialize Firebase Admin
const serviceAccountPath = path.resolve("firebase-admin-key.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Firebase Admin key not found!");
  console.error("Please download the service account key from your Firebase Console.");
  console.error("Save it in the root directory of your project as 'firebase-admin-key.json'.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

initializeApp({
  credential: cert(serviceAccount)
});

// We will fetch emails dynamically using Firebase Admin SDK instead of a hardcoded array
// const BATCH_EMAILS = [...];

const SUBJECT = "⚡ Huge Update: 10x Performance, PNG Tool, and Workspace Simulator!";

const HTML_BODY = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #050505; color: #ffffff; border-radius: 24px; border: 1px solid #1a1a1a; text-align: left;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: inline-block; padding: 12px; background-color: #ffffff; border-radius: 16px; margin-bottom: 16px;">
        <span style="font-size: 20px; font-weight: 800; color: #000000; letter-spacing: -0.5px;">PageDocx</span>
      </div>
      <div style="font-size: 10px; font-weight: 800; color: #a1a1aa; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">SYSTEM UPDATE v2.1</div>
      <h1 style="font-size: 28px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.5px; line-height: 1.2;">Unleashing 10x Performance & New Tools</h1>
    </div>

    <!-- Body -->
    <div style="font-size: 15px; color: #d4d4d8; line-height: 1.6; margin-bottom: 40px;">
      <p>Hi there,</p>
      <p>We're thrilled to introduce a major update to <strong>PageDocx</strong>, focused on making your document workflows faster, lighter, and more capable than ever before.</p>
      
      <p>Here’s a breakdown of the new upgrades live on the platform right now:</p>

      <!-- Feature 1 -->
      <div style="background-color: #0c0e14; border: 1px solid #1f2937; padding: 20px; border-radius: 16px; margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 800; color: #60a5fa; margin-bottom: 6px;">⚡ 10x Faster Image Conversions</div>
        <p style="margin: 0; font-size: 14px; color: #a1a1aa;">We optimized our server-side conversion pipeline. Uploaded JPG/PNG files are resized intelligently on-the-fly, giving you up to <strong>10x faster PDF generation</strong> and smaller download sizes without losing quality.</p>
      </div>

      <!-- Feature 2 -->
      <div style="background-color: #0c0e14; border: 1px solid #1f2937; padding: 20px; border-radius: 16px; margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 800; color: #a78bfa; margin-bottom: 6px;">🖼️ Lossless PNG to PDF Tool</div>
        <p style="margin: 0; font-size: 14px; color: #a1a1aa;">Convert PNG images into clean, formatted PDFs. Perfect for transparent artwork, screenshots, and graphics, with auto-rotation handling and direct embedding.</p>
      </div>

      <!-- Feature 3 -->
      <div style="background-color: #0c0e14; border: 1px solid #1f2937; padding: 20px; border-radius: 16px; margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 800; color: #34d399; margin-bottom: 6px;">🎯 Zero-Lag PDF Visual Editor</div>
        <p style="margin: 0; font-size: 14px; color: #a1a1aa;">No more UI freezing when editing large files! Pages are now rendered on-demand using advanced lazy-loading, ensuring smooth scrolling and instant zooming inside the workspace.</p>
      </div>

      <!-- Feature 4 -->
      <div style="background-color: #0c0e14; border: 1px solid #1f2937; padding: 20px; border-radius: 16px; margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 800; color: #f472b6; margin-bottom: 6px;">✨ Redesigned Interactive Entrance</div>
        <p style="margin: 0; font-size: 14px; color: #a1a1aa;">Check out our new login experience, featuring interactive workspace simulation screens and live statistics showing over 1.4 million documents handled.</p>
      </div>

      <p style="margin-top: 30px;">Thank you for trusting PageDocx with your daily documents. Go ahead, log back in, and try the improvements today!</p>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-bottom: 40px;">
      <a href="https://pdf-pro-dx2i.onrender.com" style="display: inline-block; background-color: #ffffff; color: #000000; font-weight: 800; font-size: 14px; text-decoration: none; padding: 16px 32px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 0.5px;">Explore New Updates</a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #1a1a1a; padding-top: 24px; font-size: 12px; color: #71717a;">
      <p style="margin: 0 0 4px 0;">Warm regards,</p>
      <p style="margin: 0 0 16px 0; font-weight: 700; color: #ffffff;">Deepak Prajapati & the PageDocx Team</p>
      <p style="margin: 0; font-size: 11px;">You are receiving this email because you registered on PageDocx.</p>
    </div>
  </div>
`;

// ==========================================

async function sendBroadcast() {
  console.log("Fetching users from Firebase Authentication...");
  let BATCH_EMAILS = [];
  try {
    let nextPageToken;
    // Loop through all pages of users
    do {
      const listUsersResult = await getAuth().listUsers(1000, nextPageToken);
      listUsersResult.users.forEach((userRecord) => {
        if (userRecord.email) {
          BATCH_EMAILS.push(userRecord.email);
        }
      });
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    process.exit(1);
  }

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
