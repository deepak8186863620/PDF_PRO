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

const SUBJECT = "Thank you for using PageDocX!";

const HTML_BODY = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
    <p>Dear User,</p>
    
    <p>Thank you for choosing <strong>PageDocX</strong>.</p>
    
    <p>Your support means a great deal to us. Every user who trusts PageDocX motivates us to continue building a faster, smarter, and more reliable AI-powered document platform.</p>
    
    <p>We truly appreciate you taking the time to use our application. Whether you've used it to chat with documents, summarize files, extract text, or manage your documents more efficiently, we're grateful to be a part of your workflow.</p>
    
    <p>We're continuously working to improve PageDocX by introducing new features, enhancing performance, and providing a secure and seamless experience. Your feedback and suggestions are always welcome and play an important role in shaping the future of our platform.</p>
    
    <p>Thank you once again for being part of our journey. We look forward to serving you with even better features in the future.</p>
    
    <br/>
    <p>Warm regards,</p>
    <p><strong>Deepak Prajapati</strong><br/>Founder, PageDocX</p>
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
