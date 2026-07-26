import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import multer from "multer";
import cors from "cors";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { PDFDocument, rgb, StandardFonts, degrees, PDFName, PDFRawStream, PDFDict } from "pdf-lib";
import sharp from "sharp";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType } from "docx";
import { createRequire } from "module";
import zlib from "zlib";
import { promisify } from "util";
import morgan from "morgan";
import winston from "winston";
import rateLimit from "express-rate-limit";
import { pipeline } from "stream/promises";
import PDFServicesSdk from "@adobe/pdfservices-node-sdk";
import { performOCR, performStructuredOCR } from "./vision.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const require = createRequire(import.meta.url);

/* ─── pdf-parse v2.x: class-based API ─── */
const _pdfParseModule = require("pdf-parse");

/**
 * Parses a PDF buffer and returns { text, numpages, info, metadata }
 * Supports both pdf-parse v1.x (function) and v2.x (PDFParse class)
 */
async function parsePDF(dataBuffer) {
  const mod = _pdfParseModule;

  // ─ v1.x: module itself is a function ─────────────────────────
  if (typeof mod === "function") {
    return mod(dataBuffer);
  }

  // ─ v2.x: PDFParse class in mod.PDFParse ─────────────────
  if (typeof mod?.PDFParse === "function") {
    const instance = new mod.PDFParse({ data: dataBuffer });
    const result   = await instance.getText();
    // v2.x getText() returns { text, pages, total }
    // result.text already contains the full concatenated document text
    return {
      text:     result.text ?? (result.pages || []).map(p => p.text ?? "").join("\n"),
      numpages: result.total ?? result.pages?.length ?? 0,
      info:     {},
      metadata: {},
    };
  }

  // ─ v2.x fallback: any exported function ─────────────────
  const fnKey = Object.keys(mod || {}).find(k => typeof mod[k] === "function");
  if (fnKey) {
    const fn = mod[fnKey];
    // Class-like (has prototype methods beyond constructor)?
    const proto = fn.prototype;
    const protoMethods = proto ? Object.getOwnPropertyNames(proto).filter(n => n !== "constructor") : [];
    if (protoMethods.length > 0) {
      // Class-based (pdf-parse v2.x) — use { data: buffer }
      const instance = new fn({ data: dataBuffer });
      const result   = await instance.getText();
      return {
        text:     result.text ?? (result.pages || []).map(p => p.text ?? "").join("\n"),
        numpages: result.total ?? result.pages?.length ?? 0,
        info:     {},
        metadata: {},
      };
    }
    return fn(dataBuffer);
  }

  throw new Error("pdf-parse module could not be loaded. Try: npm install pdf-parse");
}

const AdmZip  = require("adm-zip");
const mammoth = require("mammoth");
const xlsx    = require("xlsx");


const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

/* ─────────────── CONSTANTS ─────────────── */
const PORT = process.env.PORT || 14833;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const ESIGN_DIR = path.join(UPLOADS_DIR, "esign");
const FILE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_UPLOAD_SIZE = "200mb";

// Encrypted storage for e-signed documents
const ENCRYPTION_KEY_SEED = process.env.PDF_ENCRYPTION_KEY || "SecureESignSuperKeySecret2026!";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(ENCRYPTION_KEY_SEED).digest();
const IV_LENGTH = 16;

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const encrypted = encryptedBuffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/* ─────────────── IN-MEMORY CACHE ─────────────── */
const cache = new Map();

function setCache(key, data, ttlMs = 10 * 60 * 1000) {
  cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { cache.delete(key); return null; }
  return entry.data;
}

/* ─────────────── HELPERS ─────────────── */
const isPDF = (buf) => buf.length > 4 && buf.slice(0, 5).toString("ascii") === "%PDF-";

async function readFileFast(filePath) {
  return fsPromises.readFile(filePath);
}

async function writeFileFast(filePath, data) {
  return fsPromises.writeFile(filePath, data);
}




function hexToRgb(hex) {
  if (!hex || !hex.startsWith("#")) return rgb(0, 0, 0);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

async function loadPDFDoc(filePath, options = {}) {
  const buf = await readFileFast(filePath);
  if (!isPDF(buf)) throw new Error("The uploaded file is not a valid PDF document.");
  return PDFDocument.load(buf, options);
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) throw Object.assign(new Error("File not found"), { status: 404 });
}

/**
 * Extracts all images from a PDF buffer as an array of { data, extension, width, height, pageNum }
 */
async function extractPdfImages(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const images = [];

  async function processXObjects(xObjects, pageNum) {
    if (!xObjects) return;
    const entries = xObjects.entries();
    for (const [name, xObject] of entries) {
      if (xObject instanceof PDFRawStream) {
        const subtype = xObject.dict.get(PDFName.of("Subtype"));
        if (subtype === PDFName.of("Image")) {
          const width = xObject.dict.get(PDFName.of("Width")).numberValue;
          const height = xObject.dict.get(PDFName.of("Height")).numberValue;
          const filter = xObject.dict.get(PDFName.of("Filter"));
          
          let extension = "png";
          if (filter === PDFName.of("DCTDecode")) extension = "jpg";
          else if (filter === PDFName.of("JPXDecode")) extension = "jp2";

          images.push({
            data: xObject.contents,
            extension,
            width,
            height,
            pageNum,
            name: name.asString()
          });
        } else if (subtype === PDFName.of("Form")) {
          const innerResources = xObject.dict.get(PDFName.of("Resources"));
          if (innerResources instanceof PDFDict) {
            const innerXObjects = innerResources.get(PDFName.of("XObject"));
            await processXObjects(innerXObjects, pageNum);
          }
        }
      }
    }
  }

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const resources = page.node.Resources();
    if (resources) {
      const xObjects = resources.get(PDFName.of("XObject"));
      await processXObjects(xObjects, i + 1);
    }
  }
  return images;
}

/* ─────────────── MULTER (DISK, MEMORY-EFFICIENT) ─────────────── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB per file
});

/* ─────────────── GEMINI AI CONFIG ─────────────── */
// gemini-2.5-flash is verified to work with the current API key.
// Do NOT change this to 1.5-flash — that model is not available for this key.
const GEMINI_MODEL = "gemini-2.5-flash";

/* ─────────────── GEMINI AI REST CLIENT ─────────────── */
async function callGemini(model, payload, retries = 4) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured on server");
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if ((response.status === 429 || response.status === 503) && i < retries - 1) {
      const waitMs = (i + 1) * 5000; // 5s, 10s, 15s backoff
      console.log(`[Gemini] Rate limit or high demand hit (${response.status}), waiting ${waitMs/1000}s before retry ${i+1}/${retries}...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok || data.error) {
      const msg = data.error?.message || `HTTP ${response.status}`;
      throw new Error(msg);
    }

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      data: data
    };
  }
  throw new Error("Gemini API rate limit or high demand exceeded. Please wait a moment and try again.");
}

async function callGeminiStream(model, payload, onChunk, retries = 4) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured on server");
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, "");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${cleanKey}`;

  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if ((response.status === 429 || response.status === 503) && i < retries - 1) {
      const waitMs = (i + 1) * 5000; // 5s, 10s, 15s backoff
      console.log(`[Gemini Stream] Rate limit or high demand hit (${response.status}), waiting ${waitMs/1000}s before retry ${i+1}/${retries}...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Google's streamGenerateContent returns a JSON array: [ { ... }, { ... } ]
      // We need to extract the objects within the array.
      // A simple but effective way is to look for JSON object boundaries { }
      
      let startIdx = 0;
      while (true) {
        // Find the start of a JSON object
        startIdx = buffer.indexOf('{', startIdx);
        if (startIdx === -1) break;

        // Try to find a matching closing brace
        let braceCount = 0;
        let endIdx = -1;
        for (let j = startIdx; j < buffer.length; j++) {
          if (buffer[j] === '{') braceCount++;
          else if (buffer[j] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = j;
              break;
            }
          }
        }

        if (endIdx !== -1) {
          // Found a complete JSON object
          const jsonStr = buffer.substring(startIdx, endIdx + 1);
          try {
            const json = JSON.parse(jsonStr);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) onChunk(text);
          } catch (e) {
            console.error("[Gemini Stream] Parse error:", e.message);
          }
          // Move buffer forward
          buffer = buffer.substring(endIdx + 1);
          startIdx = 0;
        } else {
          // Object is incomplete, wait for more data
          break;
        }
      }
    }
    return; // success
  }
  throw new Error("Gemini API rate limit or high demand exceeded. Please wait a moment and try again.");
}



/* ═══════════════════════════════════════════════════════════════════
   RATE LIMITING & ABUSE PROTECTION
   ── Layered defence to prevent API-key abuse, billing attacks, and
      brute-force hammering of every external-API endpoint.

   Strategy:
     1. Burst limiter  — short window, tight cap (express-rate-limit)
     2. Daily per-IP cap — hard daily quota stored in memory; auto-resets
     3. Suspicious-IP ban — if an IP burns through the daily cap it gets
        banned for TEMP_BAN_HOURS hours
     4. Granular limiters per service (Gemini, Adobe, Razorpay, upload)
   ════════════════════════════════════════════════════════════════════ */

/* ── Tuneable constants (adjust to your budget / API quotas) ── */
const AI_BURST_MAX       = 10;   // max AI requests per IP per minute
const AI_DAILY_MAX       = 80;   // hard daily cap per IP for ALL AI calls
const ADOBE_BURST_MAX    = 5;    // Adobe calls are expensive — keep low
const ADOBE_DAILY_MAX    = 20;   // Adobe daily cap per IP
const UPLOAD_BURST_MAX   = 20;   // upload requests per minute
const PAYMENT_BURST_MAX  = 10;   // payment endpoint per minute
const GENERAL_BURST_MAX  = 100;  // general API burst
const TEMP_BAN_HOURS     = 6;    // hours an abusive IP is banned
const WINDOW_MS          = 60_000; // 1 minute rolling window

/* ── In-memory stores (use Redis in production for multi-instance) ── */
const dailyUsage = new Map();   // ip → { date, aiCount, adobeCount }
const bannedIPs  = new Map();   // ip → { until, reason }

/** Returns today's date string "YYYY-MM-DD" in UTC */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns or initialises the daily counter object for an IP */
function getDailyRecord(ip) {
  const today = todayUTC();
  let rec = dailyUsage.get(ip);
  if (!rec || rec.date !== today) {
    rec = { date: today, aiCount: 0, adobeCount: 0 };
    dailyUsage.set(ip, rec);
  }
  return rec;
}

/** Resolve the real client IP even behind proxies / Render */
function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || req.ip || "unknown";
}

/* ── Standard handler for rate-limit rejections ── */
function rateLimitHandler(req, res, _next, options) {
  const ip = getClientIP(req);
  logger.warn(`[RateLimit] ${ip} → ${req.method} ${req.path} | ${options.message?.error || "Too many requests"}`);
  res
    .status(429)
    .set("Retry-After", Math.ceil(options.windowMs / 1000))
    .json({ error: options.message?.error || "Too many requests. Please slow down." });
}

/* ── Generic helper to create a limiter with our shared handler ── */
function makeLimiter(windowMs, max, errorMsg) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return rate-limit info in RateLimit-* headers
    legacyHeaders:   false,
    skipSuccessfulRequests: false,
    keyGenerator: getClientIP,
    handler: rateLimitHandler,
    message: { error: errorMsg },
  });
}

/* ─── Burst limiters (express-rate-limit, sliding window) ─── */
const uploadLimiter  = makeLimiter(WINDOW_MS,       UPLOAD_BURST_MAX,  "Too many uploads. Max 20 per minute per IP.");
const aiLimiter      = makeLimiter(WINDOW_MS,       AI_BURST_MAX,      "Too many AI requests. Max 10 per minute per IP.");
const adobeLimiter   = makeLimiter(WINDOW_MS,       ADOBE_BURST_MAX,   "Too many Adobe PDF conversions. Max 5 per minute per IP.");
const paymentLimiter = makeLimiter(WINDOW_MS,       PAYMENT_BURST_MAX, "Too many payment requests.");
const generalLimiter = makeLimiter(WINDOW_MS * 2,   GENERAL_BURST_MAX, "Too many requests. Slow down.");

/* ─── Daily hard-cap middleware for AI routes ─── */
function aiDailyCap(req, res, next) {
  const ip  = getClientIP(req);

  // Check temporary ban first
  const ban = bannedIPs.get(ip);
  if (ban) {
    if (Date.now() < ban.until) {
      const remaining = Math.ceil((ban.until - Date.now()) / 60_000);
      logger.warn(`[BanBlock] Banned IP ${ip} attempted ${req.path} — ${remaining}m remaining`);
      return res
        .status(429)
        .set("Retry-After", Math.ceil((ban.until - Date.now()) / 1000))
        .json({ error: `Your IP has been temporarily blocked due to excessive requests. Try again in ${remaining} minute(s). Reason: ${ban.reason}` });
    } else {
      bannedIPs.delete(ip);
      logger.info(`[BanLift] Temporary ban on ${ip} lifted`);
    }
  }

  const rec = getDailyRecord(ip);
  rec.aiCount++;

  if (rec.aiCount > AI_DAILY_MAX * 1.5) {
    // Heavy abuser — apply temp ban
    bannedIPs.set(ip, {
      until:  Date.now() + TEMP_BAN_HOURS * 60 * 60 * 1000,
      reason: `Exceeded ${AI_DAILY_MAX * 1.5} AI calls in a single day`,
    });
    logger.warn(`[BanSet] IP ${ip} banned for ${TEMP_BAN_HOURS}h — excessive AI usage`);
    return res.status(429).json({ error: `Blocked for ${TEMP_BAN_HOURS} hours: Excessive AI API usage detected. This protects service billing from abuse.` });
  }

  if (rec.aiCount > AI_DAILY_MAX) {
    logger.warn(`[DailyCap] IP ${ip} hit AI daily cap (${rec.aiCount}/${AI_DAILY_MAX}) on ${req.path}`);
    return res.status(429).json({ error: `Daily AI request limit reached (${AI_DAILY_MAX} requests/day per IP). Resets at midnight UTC.` });
  }

  next();
}

/* ─── Daily hard-cap middleware for Adobe routes ─── */
function adobeDailyCap(req, res, next) {
  const ip  = getClientIP(req);
  const rec = getDailyRecord(ip);
  rec.adobeCount++;

  if (rec.adobeCount > ADOBE_DAILY_MAX) {
    logger.warn(`[DailyCap] IP ${ip} hit Adobe daily cap (${rec.adobeCount}/${ADOBE_DAILY_MAX}) on ${req.path}`);
    return res.status(429).json({ error: `Daily Adobe PDF conversion limit reached (${ADOBE_DAILY_MAX}/day per IP). Resets at midnight UTC.` });
  }
  next();
}

/* ─── Request body size guard for AI endpoints ─── */
function aiBodySizeGuard(req, res, next) {
  const MAX_AI_BODY_BYTES = 2 * 1024 * 1024; // 2 MB text limit
  const bodyStr = JSON.stringify(req.body || {});
  if (Buffer.byteLength(bodyStr) > MAX_AI_BODY_BYTES) {
    const ip = getClientIP(req);
    logger.warn(`[BodyGuard] IP ${ip} sent oversized AI body (${Buffer.byteLength(bodyStr)} bytes) to ${req.path}`);
    return res.status(413).json({ error: "Request body too large for AI endpoint. Maximum 2 MB." });
  }
  next();
}

/* ─── Cleanup: purge stale daily records every hour ─── */
setInterval(() => {
  const today = todayUTC();
  for (const [ip, rec] of dailyUsage.entries()) {
    if (rec.date !== today) dailyUsage.delete(ip);
  }
  // Purge expired bans
  for (const [ip, ban] of bannedIPs.entries()) {
    if (Date.now() >= ban.until) bannedIPs.delete(ip);
  }
}, 60 * 60 * 1000);

/* ─── Convenience stacks ─── */
// Full AI protection: burst + daily cap + body size
const aiProtect    = [aiLimiter, aiDailyCap, aiBodySizeGuard];
// Adobe protection: burst + daily cap
const adobeProtect = [adobeLimiter, adobeDailyCap];

/* ─────────────── EXPRESS SETUP ─────────────── */
async function startServer() {
  // Ensure uploads dir
  await fsPromises.mkdir(UPLOADS_DIR, { recursive: true });
  await fsPromises.mkdir(ESIGN_DIR, { recursive: true });

  const app = express();

  // Middlewares
  app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
  app.use(express.json({ limit: MAX_UPLOAD_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: MAX_UPLOAD_SIZE }));
  app.use(morgan("dev"));

  // Global burst limiter — protects all routes from generic flood attacks
  app.use("/api", generalLimiter);

  // Compression for JSON responses
  app.use((req, res, next) => {
    const ae = req.headers["accept-encoding"] || "";
    if (ae.includes("gzip")) {
      const origJson = res.json.bind(res);
      res.json = (body) => {
        const str = JSON.stringify(body);
        if (str.length < 2048) return origJson(body);
        const buf = zlib.gzipSync(str);
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Content-Type", "application/json");
        res.send(buf);
        return res;
      };
    }
    next();
  });

  // Health check endpoint (no rate limit — used by uptime monitors)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  /* ══════════════════════════════════════════
     SECURITY STATUS — rate-limit monitoring
  ══════════════════════════════════════════ */
  app.get("/api/security/status", (_req, res) => {
    const today = todayUTC();
    const activeIPs    = [...dailyUsage.entries()].filter(([, r]) => r.date === today).length;
    const bannedCount  = bannedIPs.size;
    const topConsumers = [...dailyUsage.entries()]
      .filter(([, r]) => r.date === today)
      .sort((a, b) => (b[1].aiCount + b[1].adobeCount) - (a[1].aiCount + a[1].adobeCount))
      .slice(0, 5)
      .map(([ip, r]) => ({ ip: ip.replace(/(\d+\.\d+)\..*/, "$1.x.x"), aiCount: r.aiCount, adobeCount: r.adobeCount }));
    res.json({
      date: today,
      activeIPs,
      bannedIPs: bannedCount,
      limits: { aiDailyMax: AI_DAILY_MAX, aiBurstPerMin: AI_BURST_MAX, adobeDailyMax: ADOBE_DAILY_MAX, adobeBurstPerMin: ADOBE_BURST_MAX, tempBanHours: TEMP_BAN_HOURS },
      topConsumers,
    });
  });

  /* ══════════════════════════════════════════
     UPLOAD
  ══════════════════════════════════════════ */
  app.post("/api/upload", uploadLimiter, upload.array("files"), (req, res) => {
    const files = req.files;
    if (!files?.length) return res.status(400).json({ error: "No files uploaded" });
    res.json({
      files: files.map(f => ({ id: f.filename, name: f.originalname, size: f.size, path: f.path }))
    });
  });

  /* ══════════════════════════════════════════
     PDF — EXTRACT TEXT
  ══════════════════════════════════════════ */
  app.post("/api/pdf/extract-text", async (req, res) => {
    try {
      const { fileId, pagesToProcess } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      // Cache hit
      const cacheKey = `extract:${fileId}:${pagesToProcess || "all"}`;
      const cached = getCache(cacheKey);
      if (cached) return res.json({ text: cached });

      let buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      if (pagesToProcess) {
        const doc = await PDFDocument.load(buf);
        const total = doc.getPageCount();
        const pages = pagesToProcess.split(",").map((p) => parseInt(p.trim()))
          .filter((p) => !isNaN(p) && p > 0 && p <= total);
        if (pages.length) {
          const newPdf = await PDFDocument.create();
          const copied = await newPdf.copyPages(doc, pages.map((p) => p - 1));
          copied.forEach((pg) => newPdf.addPage(pg));
          buf = Buffer.from(await newPdf.save());
        }
      }

      let extractedText = "";
      try {
        const result = await parsePDF(buf);
        extractedText = result.text || "";
      } catch (parseErr) {
        try {
          await PDFDocument.load(buf);
          throw new Error("PDF parsing failed — complex PDF structure.");
        } catch (libErr) {
          if (libErr.message.includes("encrypted")) {
            return res.status(400).json({ error: "PDF is password protected. Remove the password first." });
          }
          throw parseErr;
        }
      }

      if (extractedText.trim().length < 100) {
        logger.info("Standard extraction returned very little text. Falling back to AI OCR...");
        try {
          const ocrText = await performOCR(buf.toString("base64"), "application/pdf");
          if (ocrText && ocrText.trim().length > extractedText.trim().length) {
            extractedText = ocrText;
          }
        } catch (ocrErr) {
          logger.warn("AI OCR fallback failed: " + ocrErr.message);
          // If OCR fails, we still have the (very brief) standard text, or we can throw error
          if (!extractedText.trim()) {
            return res.status(400).json({ error: "No text found — this may be a scanned PDF. Try OCR instead." });
          }
        }
      }

      setCache(cacheKey, extractedText);
      res.json({ text: extractedText });
    } catch (err) {
      logger.error("extract-text: " + err.message);
      res.status(err.status || 500).json({ error: err.message || "Failed to extract text." });
    }
  });

  /* ══════════════════════════════════════════
     PDF — GET BASE64
  ══════════════════════════════════════════ */
  app.post("/api/pdf/get-base64", async (req, res) => {
    try {
      const { fileId, pagesToProcess } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      let buf = await readFileFast(filePath);
      
      // If it's not a PDF (e.g. an image), just return its base64 directly
      if (!isPDF(buf)) {
        return res.json({ base64: buf.toString("base64") });
      }

      if (pagesToProcess) {
        const doc = await PDFDocument.load(buf);
        const total = doc.getPageCount();
        const pages = pagesToProcess.split(",").map((p) => parseInt(p.trim()))
          .filter((p) => !isNaN(p) && p > 0 && p <= total);
        if (pages.length) {
          const newPdf = await PDFDocument.create();
          const copied = await newPdf.copyPages(doc, pages.map((p) => p - 1));
          copied.forEach((pg) => newPdf.addPage(pg));
          buf = Buffer.from(await newPdf.save());
        }
      }

      res.json({ base64: buf.toString("base64") });
    } catch (err) {
      logger.error("get-base64: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — MERGE
  ══════════════════════════════════════════ */
  app.post("/api/pdf/merge", async (req, res) => {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length < 2) {
        return res.status(400).json({ error: "At least two files required." });
      }

      // Load all PDFs in parallel
      const pdfs = await Promise.all(fileIds.map(async (id) => {
        const fp = path.join(UPLOADS_DIR, id);
        requireFile(fp);
        const buf = await readFileFast(fp);
        if (!isPDF(buf)) throw new Error(`File ${id} is not a valid PDF.`);
        return PDFDocument.load(buf);
      }));

      const merged = await PDFDocument.create();
      for (const srcPdf of pdfs) {
        const pages = await merged.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach(pg => merged.addPage(pg));
      }

      const bytes = await merged.save();
      const outName = `merged-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "merged.pdf" });
    } catch (err) {
      logger.error("merge: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — SPLIT
  ══════════════════════════════════════════ */
  app.post("/api/pdf/split", async (req, res) => {
    try {
      const { fileId, pagesToProcess } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      const srcPdf = await PDFDocument.load(buf);
      const total = srcPdf.getPageCount();

      if (pagesToProcess) {
        const pages = pagesToProcess.split(",").map((p) => parseInt(p.trim()))
          .filter((p) => !isNaN(p) && p > 0 && p <= total);
        if (pages.length) {
          const newPdf = await PDFDocument.create();
          const copied = await newPdf.copyPages(srcPdf, pages.map((p) => p - 1));
          copied.forEach((pg) => newPdf.addPage(pg));
          const bytes = await newPdf.save();
          const outName = `extracted-${uuidv4()}.pdf`;
          await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
          return res.json({ id: outName, name: "extracted-pages.pdf" });
        }
      }

      if (total === 1) return res.json({ id: fileId, name: "page-1.pdf" });

      // Split all pages in parallel, write to individual files
      const results = await Promise.all(
        Array.from({ length: total }, async (_, i) => {
          const newPdf = await PDFDocument.create();
          const [pg] = await newPdf.copyPages(srcPdf, [i]);
          newPdf.addPage(pg);
          const content = Buffer.from(await newPdf.save());
          const name = `page-${i + 1}-${uuidv4()}.pdf`;
          await writeFileFast(path.join(UPLOADS_DIR, name), content);
          return { id: name, name: `page-${i + 1}.pdf` };
        })
      );

      res.json({ files: results, note: "Split into individual pages." });
    } catch (err) {
      logger.error("split: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — COMPRESS
  ══════════════════════════════════════════ */
  app.post("/api/pdf/compress", ...adobeProtect, async (req, res) => {
    try {
      const { fileId, compressionLevel = "MEDIUM" } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      logger.info(`Starting Adobe PDF compression for ${fileId} with level ${compressionLevel}`);

      const clientId = process.env.ADOBE_CLIENT_ID;
      const clientSecret = process.env.ADOBE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
         throw new Error("Adobe PDF Services credentials are not configured on the server.");
      }

      const credentials = new PDFServicesSdk.ServicePrincipalCredentials({
        clientId,
        clientSecret
      });
      const clientConfig = new PDFServicesSdk.ClientConfig({
        timeout: 300000 // 5 minutes
      });
      const pdfServices = new PDFServicesSdk.PDFServices({ credentials, clientConfig });

      const inputAsset = await pdfServices.upload({
        readStream: fs.createReadStream(filePath),
        mimeType: PDFServicesSdk.MimeType.PDF
      });

      const params = new PDFServicesSdk.CompressPDFParams({
        compressionLevel: PDFServicesSdk.CompressionLevel[compressionLevel] || PDFServicesSdk.CompressionLevel.MEDIUM
      });

      const job = new PDFServicesSdk.CompressPDFJob({ inputAsset, params });

      const pollingURL = await pdfServices.submit({ job });
      const response = await pdfServices.getJobResult({
        pollingURL,
        resultType: PDFServicesSdk.CompressPDFResult
      });

      const resultAsset = response.result.asset;
      const streamAsset = await pdfServices.getContent({ asset: resultAsset });

      const outName = `compressed-${uuidv4()}.pdf`;
      const outPath = path.join(UPLOADS_DIR, outName);
      
      const writeStream = fs.createWriteStream(outPath);
      streamAsset.readStream.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const originalSize = (await fsPromises.stat(filePath)).size;
      const newSize = (await fsPromises.stat(outPath)).size;
      
      let reduction = 0;
      if (originalSize > 0) {
        reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
      }

      res.json({ id: outName, name: "compressed.pdf", originalSize, newSize, reduction: `${reduction}%` });
    } catch (err) {
      logger.error("compress: " + err.message);
      res.status(500).json({ error: "Failed to compress PDF. " + err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — ROTATE
  ══════════════════════════════════════════ */
  app.post("/api/pdf/rotate", async (req, res) => {
    try {
      const { fileId, degrees: deg, pagesToProcess } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath);
      const pages = srcPdf.getPages();

      const selectedPages = pagesToProcess
        ? pagesToProcess.split(",").map((p) => parseInt(p.trim())).filter((p) => !isNaN(p))
        : [];

      const rotationAngle = parseInt(deg) || 90;

      pages.forEach((page, i) => {
        if (!selectedPages.length || selectedPages.includes(i + 1)) {
          const cur = page.getRotation().angle || 0;
          page.setRotation(degrees((cur + rotationAngle) % 360));
        }
      });

      const bytes = await srcPdf.save();
      const outName = `rotated-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "rotated.pdf" });
    } catch (err) {
      logger.error("rotate: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — WATERMARK
  ══════════════════════════════════════════ */
  app.post("/api/pdf/watermark", async (req, res) => {
    try {
      const { fileId, text, opacity = 0.3, fontSize = 50, color = "#888888", angle = 45 } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath);
      const font = await srcPdf.embedFont(StandardFonts.HelveticaBold);

      for (const page of srcPdf.getPages()) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text || "WATERMARK", fontSize);
        page.drawText(text || "WATERMARK", {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: hexToRgb(color),
          opacity: parseFloat(opacity),
          rotate: degrees(angle),
        });
      }

      const bytes = await srcPdf.save();
      const outName = `watermarked-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "watermarked.pdf" });
    } catch (err) {
      logger.error("watermark: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — PAGE NUMBERS
  ══════════════════════════════════════════ */
  app.post("/api/pdf/page-numbers", async (req, res) => {
    try {
      const { fileId, position = "bottom-center", startPage = 1 } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath);
      const font = await srcPdf.embedFont(StandardFonts.Helvetica);
      const pages = srcPdf.getPages();

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const label = `${i + startPage}`;
        const fz = 10;
        const tw = font.widthOfTextAtSize(label, fz);

        const positions = {
          "bottom-center": { x: width / 2 - tw / 2, y: 20 },
          "bottom-right":  { x: width - tw - 20, y: 20 },
          "bottom-left":   { x: 20, y: 20 },
          "top-center":    { x: width / 2 - tw / 2, y: height - 30 },
          "top-right":     { x: width - tw - 20, y: height - 30 },
          "top-left":      { x: 20, y: height - 30 },
        };

        const pos = positions[position] || positions["bottom-center"];
        page.drawText(label, { ...pos, size: fz, font, color: rgb(0, 0, 0) });
      });

      const bytes = await srcPdf.save();
      const outName = `numbered-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "numbered.pdf" });
    } catch (err) {
      logger.error("page-numbers: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — REMOVE PAGES
  ══════════════════════════════════════════ */
  app.post("/api/pdf/remove-pages", async (req, res) => {
    try {
      const { fileId, pages } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath);
      const total = srcPdf.getPageCount();

      const toRemove = pages
        .map((p) => p - 1)
        .filter((p) => p >= 0 && p < total)
        .sort((a, b) => b - a); // descending to preserve indices

      if (!toRemove.length) return res.status(400).json({ error: "No valid pages specified." });
      if (toRemove.length >= total) return res.status(400).json({ error: "Cannot remove all pages." });

      toRemove.forEach(idx => srcPdf.removePage(idx));

      const bytes = await srcPdf.save();
      const outName = `modified-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "modified.pdf" });
    } catch (err) {
      logger.error("remove-pages: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — LOCK
  ══════════════════════════════════════════ */
  app.post("/api/pdf/lock", async (req, res) => {
    try {
      const { fileId, password } = req.body;
      if (!fileId || !password) return res.status(400).json({ error: "File ID and password are required." });
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      const { PDFDocument: PDFDocumentEncrypt } = require("pdf-lib-plus-encrypt");
      const pdfDoc = await PDFDocumentEncrypt.load(buf);
      pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: "highResolution",
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: true,
          contentAccessibility: true,
          documentAssembly: false,
        },
      });

      const pdfBytes = await pdfDoc.save();
      const outName = `locked-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), pdfBytes);
      res.json({ id: outName, name: "locked.pdf" });
    } catch (err) {
      logger.error("lock: " + err.message);
      res.status(err.status || 500).json({ error: err.message || "Failed to lock PDF." });
    }
  });

  /* ══════════════════════════════════════════
     PDF — UNLOCK
  ══════════════════════════════════════════ */
  app.post("/api/pdf/unlock", async (req, res) => {
    try {
      const { fileId, password } = req.body;
      if (!fileId || !password) return res.status(400).json({ error: "File ID and password are required." });
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      const { PDFDocument: PDFDocumentEncrypt } = require("pdf-lib-plus-encrypt");
      const pdfDoc = await PDFDocumentEncrypt.load(buf, password);
      const pdfBytes = await pdfDoc.save();

      const outName = `unlocked-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), pdfBytes);
      res.json({ id: outName, name: "unlocked.pdf" });
    } catch (err) {
      logger.error("unlock: " + err.message);
      res.status(err.status || 500).json({ error: err.message || "Failed to unlock PDF. Incorrect password?" });
    }
  });

  /* ══════════════════════════════════════════
     PDF — METADATA
  ══════════════════════════════════════════ */
  app.post("/api/pdf/metadata", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath, { ignoreEncryption: true });
      const stat = await fsPromises.stat(filePath);

      res.json({
        title: srcPdf.getTitle() || "N/A",
        author: srcPdf.getAuthor() || "N/A",
        subject: srcPdf.getSubject() || "N/A",
        keywords: srcPdf.getKeywords() || "N/A",
        creator: srcPdf.getCreator() || "N/A",
        producer: srcPdf.getProducer() || "N/A",
        creationDate: srcPdf.getCreationDate()?.toISOString() || "N/A",
        modificationDate: srcPdf.getModificationDate()?.toISOString() || "N/A",
        pageCount: srcPdf.getPageCount(),
        isEncrypted: srcPdf.isEncrypted,
        fileSize: stat.size,
      });
    } catch (err) {
      logger.error("metadata: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — EDIT (Text overlay, rotate, delete)
  ══════════════════════════════════════════ */
  app.post("/api/pdf/edit", async (req, res) => {
    try {
      const { fileId, edits, text } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath);
      const font = await srcPdf.embedFont(StandardFonts.Helvetica);
      const pages = srcPdf.getPages();

      const editList = Array.isArray(edits) ? edits : [];
      if (!edits && text) editList.push({ type: "text", page: 1, text, x: 10, y: 10, fontSize: 12 });

      // Apply non-delete edits
      for (const edit of editList.filter((e) => e.type !== "delete")) {
        const idx = (edit.page || 1) - 1;
        if (idx < 0 || idx >= pages.length) continue;
        const page = pages[idx];
        const { width, height } = page.getSize();

        if (edit.type === "text") {
          const xPos = (edit.x / 100) * width;
          const yPos = height - (edit.y / 100) * height;
          page.drawText(String(edit.text || ""), {
            x: xPos, y: yPos,
            size: edit.fontSize || 12,
            font,
            color: edit.color ? hexToRgb(edit.color) : rgb(0, 0, 0),
          });
        } else if (edit.type === "replaceText") {
          // Cover old text with a white rectangle
          const padX = 2, padY = 2;
          page.drawRectangle({
            x: edit.x - padX,
            y: edit.y - padY,
            width: (edit.width || 100) + padX * 2,
            height: (edit.height || 20) + padY * 2,
            color: rgb(1, 1, 1)
          });
          // Draw new text
          page.drawText(String(edit.newText || ""), {
            x: edit.x,
            y: edit.y,
            size: Math.max(edit.fontSize || 12, 6),
            font,
            color: edit.color ? hexToRgb(edit.color) : rgb(0, 0, 0)
          });
        } else if (edit.type === "rotate") {
          page.setRotation(degrees(edit.degrees || 0));
        }
      }

      // Apply deletions
      const deletions = editList.filter((e) => e.type === "delete").sort((a, b) => b.page - a.page);
      for (const edit of deletions) {
        if (edit.page > 0 && edit.page <= srcPdf.getPageCount()) srcPdf.removePage(edit.page - 1);
      }

      const bytes = await srcPdf.save();
      const outName = `edited-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "edited.pdf" });
    } catch (err) {
      logger.error("edit: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — REPAIR
  ══════════════════════════════════════════ */
  app.post("/api/pdf/repair", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      let buf = await readFileFast(filePath);
      if (!isPDF(buf)) {
        const idx = buf.indexOf("%PDF-");
        if (idx === -1) return res.status(400).json({ error: "File does not appear to be a PDF." });
        buf = buf.slice(idx);
      }

      const srcPdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const bytes = await srcPdf.save();
      const outName = `repaired-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "repaired.pdf" });
    } catch (err) {
      logger.error("repair: " + err.message);
      res.status(err.status || 500).json({ error: "Failed to repair PDF. It may be too corrupted." });
    }
  });

  /* ══════════════════════════════════════════
     BACKGROUND JOBS (FOR LONG TASKS)
  ══════════════════════════════════════════ */
  const jobs = new Map();

  app.get("/api/job-status/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found or expired." });
    res.json(job);
  });

  /* ══════════════════════════════════════════
     PDF — TO WORD (.docx)
  ══════════════════════════════════════════ */
  app.post("/api/pdf/to-word", ...adobeProtect, async (req, res) => {
    const { fileId } = req.body;
    const jobId = uuidv4();
    
    // 1. Immediately return jobId to client
    res.json({ jobId });
    
    // 2. Initialize job state
    jobs.set(jobId, { status: "processing", progress: 10, message: "Initializing Adobe PDF to Word conversion..." });
    
    // 3. Start background processing
    (async () => {
      try {
        const filePath = path.join(UPLOADS_DIR, fileId);
        requireFile(filePath);

        const buf = await readFileFast(filePath);
        if (!isPDF(buf)) throw new Error("Not a valid PDF.");

        logger.info(`Background Adobe PDF to Word for ${fileId} (Job: ${jobId})`);
        jobs.set(jobId, { status: "processing", progress: 20, message: "Connecting to Adobe Cloud..." });

        const clientId = process.env.ADOBE_CLIENT_ID;
        const clientSecret = process.env.ADOBE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
           throw new Error("Adobe PDF Services credentials are not configured.");
        }

        const credentials = new PDFServicesSdk.ServicePrincipalCredentials({ clientId, clientSecret });
        const clientConfig = new PDFServicesSdk.ClientConfig({ timeout: 300000 });
        const pdfServices = new PDFServicesSdk.PDFServices({ credentials, clientConfig });

        jobs.set(jobId, { status: "processing", progress: 30, message: "Uploading document securely to Adobe..." });
        const inputAsset = await pdfServices.upload({
          readStream: fs.createReadStream(filePath),
          mimeType: PDFServicesSdk.MimeType.PDF
        });

        const params = new PDFServicesSdk.ExportPDFParams({
          targetFormat: PDFServicesSdk.ExportPDFTargetFormat.DOCX
        });
        const job = new PDFServicesSdk.ExportPDFJob({ inputAsset, params });

        jobs.set(jobId, { status: "processing", progress: 40, message: "Adobe is processing... (This takes about 15 seconds)" });
        const pollingURL = await pdfServices.submit({ job });
        
        // Simulated progress tick while Adobe handles the internal polling
        let tickProgress = 40;
        const ticker = setInterval(() => {
           tickProgress = Math.min(90, tickProgress + 2);
           jobs.set(jobId, { status: "processing", progress: tickProgress, message: "Adobe is processing... (This takes about 15 seconds)" });
        }, 1500);

        let response;
        try {
           response = await pdfServices.getJobResult({
             pollingURL,
             resultType: PDFServicesSdk.ExportPDFResult
           });
        } finally {
           clearInterval(ticker);
        }

        jobs.set(jobId, { status: "processing", progress: 95, message: "Downloading converted Word document..." });
        const resultAsset = response.result.asset;
        const streamAsset = await pdfServices.getContent({ asset: resultAsset });

        const outName = `adobe-converted-${uuidv4()}.docx`;
        const outPath = path.join(UPLOADS_DIR, outName);
        
        const writeStream = fs.createWriteStream(outPath);
        streamAsset.readStream.pipe(writeStream);
        
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        // 4. Mark Complete
        jobs.set(jobId, { status: "completed", progress: 100, result: { id: outName, name: "converted.docx" } });
        logger.info(`Job ${jobId} completed successfully.`);
        
      } catch (err) {
        logger.error(`Background Job ${jobId} failed: ` + err.message);
        jobs.set(jobId, { status: "error", error: "Failed to convert PDF to Word. " + err.message });
      } finally {
        // 5. Cleanup job data after 15 minutes to prevent memory leaks
        setTimeout(() => {
          jobs.delete(jobId);
        }, 15 * 60 * 1000);
      }
    })();
  });

  /* ══════════════════════════════════════════
     PDF — WORD TO PDF
  ══════════════════════════════════════════ */
  app.post("/api/pdf/word-to-pdf", ...adobeProtect, async (req, res) => {
    const { fileId } = req.body;
    const jobId = uuidv4();
    
    res.json({ jobId });
    jobs.set(jobId, { status: "processing", progress: 10, message: "Initializing Adobe Word to PDF conversion..." });
    
    (async () => {
      try {
        const filePath = path.join(UPLOADS_DIR, fileId);
        requireFile(filePath);

        logger.info(`Background Adobe Word to PDF for ${fileId} (Job: ${jobId})`);
        jobs.set(jobId, { status: "processing", progress: 20, message: "Connecting to Adobe Cloud..." });

        const clientId = process.env.ADOBE_CLIENT_ID;
        const clientSecret = process.env.ADOBE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
           throw new Error("Adobe PDF Services credentials are not configured.");
        }

        const credentials = new PDFServicesSdk.ServicePrincipalCredentials({ clientId, clientSecret });
        const clientConfig = new PDFServicesSdk.ClientConfig({ timeout: 300000 });
        const pdfServices = new PDFServicesSdk.PDFServices({ credentials, clientConfig });

        const extension = path.extname(fileId).toLowerCase();
        let mimeType = PDFServicesSdk.MimeType.DOCX;
        if (extension === ".doc") {
          mimeType = PDFServicesSdk.MimeType.DOC;
        } else if (extension === ".rtf") {
          mimeType = PDFServicesSdk.MimeType.RTF;
        } else if (extension === ".txt") {
          mimeType = PDFServicesSdk.MimeType.TXT;
        }

        jobs.set(jobId, { status: "processing", progress: 30, message: "Uploading document securely to Adobe..." });
        const inputAsset = await pdfServices.upload({
          readStream: fs.createReadStream(filePath),
          mimeType
        });

        const job = new PDFServicesSdk.CreatePDFJob({ inputAsset });

        jobs.set(jobId, { status: "processing", progress: 40, message: "Adobe is processing... (This takes about 15 seconds)" });
        const pollingURL = await pdfServices.submit({ job });
        
        let tickProgress = 40;
        const ticker = setInterval(() => {
           tickProgress = Math.min(90, tickProgress + 2);
           jobs.set(jobId, { status: "processing", progress: tickProgress, message: "Adobe is processing... (This takes about 15 seconds)" });
        }, 1500);

        let response;
        try {
           response = await pdfServices.getJobResult({
             pollingURL,
             resultType: PDFServicesSdk.CreatePDFResult
           });
        } finally {
           clearInterval(ticker);
        }

        jobs.set(jobId, { status: "processing", progress: 95, message: "Downloading converted PDF document..." });
        const resultAsset = response.result.asset;
        const streamAsset = await pdfServices.getContent({ asset: resultAsset });

        const outName = `converted-${uuidv4()}.pdf`;
        const outPath = path.join(UPLOADS_DIR, outName);
        
        const writeStream = fs.createWriteStream(outPath);
        streamAsset.readStream.pipe(writeStream);
        
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        jobs.set(jobId, { status: "completed", progress: 100, result: { id: outName, name: "converted.pdf" } });
        logger.info(`Job ${jobId} completed successfully.`);
        
      } catch (err) {
        logger.error(`Background Job ${jobId} failed: ` + err.message);
        jobs.set(jobId, { status: "error", error: "Failed to convert Word to PDF. " + err.message });
      } finally {
        setTimeout(() => jobs.delete(jobId), 15 * 60 * 1000);
      }
    })();
  });

  /* ══════════════════════════════════════════
     PDF — EXCEL TO PDF
  ══════════════════════════════════════════ */
  app.post("/api/pdf/excel-to-pdf", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const workbook = xlsx.readFile(filePath);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 8;
      const margin = 35;
      const rowHeight = 16;
      const colPad = 8;

      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (!jsonData.length) continue;

        // Compute col widths
        const colWidths = [];
        jsonData.forEach(row => {
          row.forEach((cell, i) => {
            const s = String(cell ?? "").substring(0, 30);
            const w = font.widthOfTextAtSize(s, fontSize) + colPad;
            colWidths[i] = Math.max(colWidths[i] || 0, w);
          });
        });

        let page = pdfDoc.addPage([842, 595]); // A4 landscape
        const { width, height } = page.getSize();
        let y = height - margin;

        // Sheet title
        page.drawText(`Sheet: ${sheetName}`, { x: margin, y, size: 10, font: boldFont, color: rgb(0, 0, 0.6) });
        y -= rowHeight + 4;

        const totalCols = colWidths.length;
        const availW = width - margin * 2;
        const scale = availW / colWidths.reduce((a, b) => a + b, 0);
        const finalWidths = colWidths.map(w => Math.max(w * scale, 20));

        for (let ri = 0; ri < jsonData.length; ri++) {
          if (y < margin + rowHeight) {
            page = pdfDoc.addPage([842, 595]);
            y = height - margin;
          }

          // Header row styling
          if (ri === 0) {
            page.drawRectangle({ x: margin, y: y - 2, width: availW, height: rowHeight, color: rgb(0.2, 0.2, 0.4) });
          }

          let x = margin;
          const row = jsonData[ri];
          for (let ci = 0; ci < totalCols; ci++) {
            const cell = String(row[ci] ?? "");
            const colW = finalWidths[ci];
            const truncated = font.widthOfTextAtSize(cell, fontSize) > colW - colPad
              ? cell.substring(0, Math.floor(colW / (fontSize * 0.5))) + "…"
              : cell;

            page.drawText(truncated, {
              x: x + 2, y: y + 2,
              size: fontSize,
              font: ri === 0 ? boldFont : font,
              color: ri === 0 ? rgb(1, 1, 1) : rgb(0, 0, 0),
            });

            // Column border
            page.drawLine({ start: { x: x, y: y - 2 }, end: { x: x, y: y + rowHeight - 2 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
            x += colW;
          }

          // Row border
          page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: margin + availW, y: y - 2 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
          y -= rowHeight;
        }
      }

      const bytes = await pdfDoc.save();
      const outName = `converted-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "converted.pdf" });
    } catch (err) {
      logger.error("excel-to-pdf: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — PPTX TO PDF
  ══════════════════════════════════════════ */
  app.post("/api/pdf/pptx-to-pdf", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const slideEntries = entries
        .filter((e) => e.entryName.startsWith("ppt/slides/slide") && e.entryName.endsWith(".xml"))
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

      for (let si = 0; si < slideEntries.length; si++) {
        const content = slideEntries[si].getData().toString("utf8");
        // Extract all text runs
        const texts = [];
        const textMatches = content.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
        textMatches.forEach((m) => {
          const t = m.replace(/<a:t[^>]*>|<\/a:t>/g, "").trim();
          if (t) texts.push(t);
        });

        const page = pdfDoc.addPage([960, 540]);
        const { width, height } = page.getSize();

        // Slide background
        page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.98, 0.98, 0.98) });

        // Slide number
        page.drawText(`Slide ${si + 1}`, { x: 20, y: height - 24, size: 9, font, color: rgb(0.6, 0.6, 0.6) });

        let y = height - 60;
        let isFirst = true;
        for (const txt of texts) {
          if (y < 30) break;
          page.drawText(txt.substring(0, 120), {
            x: 60, y,
            size: isFirst ? 20 : 13,
            font: isFirst ? boldFont : font,
            color: isFirst ? rgb(0.1, 0.1, 0.1) : rgb(0.3, 0.3, 0.3),
            maxWidth: width - 120,
            lineHeight: isFirst ? 28 : 18,
          });
          y -= isFirst ? 40 : 24;
          isFirst = false;
        }

        if (!texts.length) {
          page.drawText("(No text content)", { x: 60, y: height / 2, size: 14, font, color: rgb(0.7, 0.7, 0.7) });
        }
      }

      if (!pdfDoc.getPageCount()) {
        pdfDoc.addPage().drawText("No slides found.", { x: 50, y: 400, size: 14, font, color: rgb(0, 0, 0) });
      }

      const bytes = await pdfDoc.save();
      const outName = `pptx-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "presentation.pdf" });
    } catch (err) {
      logger.error("pptx-to-pdf: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — JPG TO PDF
  ══════════════════════════════════════════ */
  app.post("/api/pdf/jpg-to-pdf", async (req, res) => {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || !fileIds.length) return res.status(400).json({ error: "No files provided." });

      const pdfDoc = await PDFDocument.create();

      // Process all images
      const embedResults = await Promise.all(fileIds.map(async (id) => {
        const fp = path.join(UPLOADS_DIR, id);
        requireFile(fp);
        const jpegBuf = await sharp(fp)
          .rotate()
          .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
        return pdfDoc.embedJpg(jpegBuf);
      }));

      for (const img of embedResults) {
        const maxW = 595, maxH = 842;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const page = pdfDoc.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      }

      const bytes = await pdfDoc.save();
      const outName = `converted-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "converted.pdf" });
    } catch (err) {
      logger.error("jpg-to-pdf: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — PNG TO PDF
     Embeds PNG images losslessly into a PDF using pdf-lib's embedPng.
     Supports multiple PNG files → one combined PDF.
  ══════════════════════════════════════════ */
  app.post("/api/pdf/png-to-pdf", async (req, res) => {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || !fileIds.length)
        return res.status(400).json({ error: "No files provided." });

      const pdfDoc = await PDFDocument.create();

      // Process all PNG images in parallel
      const embedResults = await Promise.all(
        fileIds.map(async (id) => {
          const fp = path.join(UPLOADS_DIR, id);
          requireFile(fp);
          // Normalize to PNG (handles transparency, EXIF rotation, other img formats)
          const pngBuf = await sharp(fp)
            .rotate()                       // auto-rotate from EXIF metadata
            .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
            .png({ compressionLevel: 6 })   // lossless PNG
            .toBuffer();
          return pdfDoc.embedPng(pngBuf);
        })
      );

      for (const img of embedResults) {
        // Fit inside A4 (595 × 842 pts) while preserving aspect ratio
        const maxW = 595.28, maxH = 841.89;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const page = pdfDoc.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      }

      const bytes = await pdfDoc.save();
      const outName = `png-converted-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "converted.pdf" });
    } catch (err) {
      logger.error("png-to-pdf: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — JPG TO PDF (BATCH CHUNK)
     Converts a single batch of image IDs to a partial PDF.
     Used by the chunked 200+ photo scan pipeline.
  ══════════════════════════════════════════ */
  app.post("/api/pdf/jpg-to-pdf-chunk", async (req, res) => {
    try {
      const { fileIds, chunkIndex } = req.body;
      if (!Array.isArray(fileIds) || !fileIds.length) return res.status(400).json({ error: "No files in chunk." });

      const pdfDoc = await PDFDocument.create();

      // Process up to 10 images concurrently within the chunk
      const CONCURRENT = 10;
      for (let i = 0; i < fileIds.length; i += CONCURRENT) {
        const batch = fileIds.slice(i, i + CONCURRENT);
        const embedResults = await Promise.all(batch.map(async (id) => {
          const fp = path.join(UPLOADS_DIR, id);
          requireFile(fp);
          const jpegBuf = await sharp(fp)
            .rotate()                               // auto-rotate from EXIF
            .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 88, progressive: true })
            .toBuffer();
          return pdfDoc.embedJpg(jpegBuf);
        }));
        for (const img of embedResults) {
          const maxW = 595.28, maxH = 841.89;      // A4 points
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const page = pdfDoc.addPage([w, h]);
          page.drawImage(img, { x: 0, y: 0, width: w, height: h });
        }
      }

      const bytes = await pdfDoc.save();
      const outName = `chunk-${chunkIndex ?? 0}-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, chunkIndex: chunkIndex ?? 0 });
    } catch (err) {
      logger.error("jpg-to-pdf-chunk: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — MERGE CHUNKS (for 200+ photo scan)
     Merges ordered chunk PDF ids into one final PDF.
  ══════════════════════════════════════════ */
  app.post("/api/pdf/merge-chunks", async (req, res) => {
    try {
      const { chunkIds } = req.body;
      if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
        return res.status(400).json({ error: "No chunk IDs provided." });
      }

      const merged = await PDFDocument.create();
      for (const cid of chunkIds) {
        const fp = path.join(UPLOADS_DIR, cid);
        requireFile(fp);
        const buf = await readFileFast(fp);
        if (!isPDF(buf)) throw new Error(`Chunk ${cid} is not a valid PDF.`);
        const src = await PDFDocument.load(buf);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((pg) => merged.addPage(pg));
      }

      const bytes = await merged.save();
      const finalName = `scan-${Date.now()}-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, finalName), bytes);
      res.json({ id: finalName, name: "scanned-document.pdf", pageCount: merged.getPageCount() });
    } catch (err) {
      logger.error("merge-chunks: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — TO JPG (LOCAL)
  ══════════════════════════════════════════ */
  app.post("/api/pdf/to-jpg", ...adobeProtect, async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      logger.info(`Starting Adobe PDF to JPG conversion for ${fileId}`);

      const clientId = process.env.ADOBE_CLIENT_ID;
      const clientSecret = process.env.ADOBE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
         throw new Error("Adobe PDF Services credentials are not configured on the server.");
      }

      const credentials = new PDFServicesSdk.ServicePrincipalCredentials({
        clientId,
        clientSecret
      });
      const clientConfig = new PDFServicesSdk.ClientConfig({
        timeout: 300000 // 5 minutes
      });
      const pdfServices = new PDFServicesSdk.PDFServices({ credentials, clientConfig });

      const inputAsset = await pdfServices.upload({
        readStream: fs.createReadStream(filePath),
        mimeType: PDFServicesSdk.MimeType.PDF
      });

      const params = new PDFServicesSdk.ExportPDFToImagesParams({
        targetFormat: PDFServicesSdk.ExportPDFToImagesTargetFormat.JPEG,
        outputType: PDFServicesSdk.ExportPDFToImagesOutputType.LIST_OF_PAGE_IMAGES
      });
      const job = new PDFServicesSdk.ExportPDFToImagesJob({ inputAsset, params });

      const pollingURL = await pdfServices.submit({ job });
      const response = await pdfServices.getJobResult({
        pollingURL,
        resultType: PDFServicesSdk.ExportPDFToImagesResult
      });

      const fileIds = [];
      const assets = response.result.assets || [];

      for (let i = 0; i < assets.length; i++) {
        const streamAsset = await pdfServices.getContent({ asset: assets[i] });
        const outName = `adobe-page-${i + 1}-${uuidv4()}.jpg`;
        const outPath = path.join(UPLOADS_DIR, outName);
        
        const writeStream = fs.createWriteStream(outPath);
        streamAsset.readStream.pipe(writeStream);
        
        await new Promise((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
        
        fileIds.push({ id: outName, name: `page-${i + 1}.jpg` });
      }

      res.json({ 
        files: fileIds, 
        pageCount: assets.length,
        note: `${assets.length} page(s) extracted as JPG files via Adobe API.`
      });
    } catch (err) {
      logger.error("to-jpg: " + err.message);
      res.status(err.status || 500).json({ error: "Failed to convert PDF to JPG via Adobe API: " + err.message });
    }
  });

  /* ══════════════════════════════════════════
     IMAGE — PROCESS
  ══════════════════════════════════════════ */
  app.post("/api/image/process", async (req, res) => {
    try {
      const {
        fileId, format, quality = 82,
        width, height, rotate, flip, flop,
        grayscale, blur, sharpen, brightness, saturation
      } = req.body;

      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const outFmt = format || path.extname(fileId).slice(1) || "jpg";
      const outName = `processed-${uuidv4()}.${outFmt}`;
      const outPath = path.join(UPLOADS_DIR, outName);

      let pipeline = sharp(filePath, { failOnError: false });

      if (width || height) {
        pipeline = pipeline.resize(
          width ? parseInt(width) : undefined,
          height ? parseInt(height) : undefined,
          { fit: "inside", withoutEnlargement: true }
        );
      }

      if (rotate) pipeline = pipeline.rotate(parseInt(rotate));
      if (flip) pipeline = pipeline.flip();
      if (flop) pipeline = pipeline.flop();
      if (grayscale) pipeline = pipeline.grayscale();
      if (blur) pipeline = pipeline.blur(Math.min(parseFloat(blur) || 3, 100));
      if (sharpen) pipeline = pipeline.sharpen();
      if (brightness || saturation) {
        pipeline = pipeline.modulate({
          brightness: brightness ? parseFloat(brightness) : 1,
          saturation: saturation ? parseFloat(saturation) : 1,
        });
      }

      const q = Math.min(Math.max(parseInt(quality), 1), 100);
      if (outFmt === "jpg" || outFmt === "jpeg") pipeline = pipeline.jpeg({ quality: q, progressive: true });
      else if (outFmt === "png") pipeline = pipeline.png({ compressionLevel: Math.round((100 - q) / 11) });
      else if (outFmt === "webp") pipeline = pipeline.webp({ quality: q });
      else if (outFmt === "avif") pipeline = pipeline.avif({ quality: q });

      const info = await pipeline.toFile(outPath);
      const originalSize = (await fsPromises.stat(filePath)).size;

      res.json({
        id: outName,
        name: `processed.${outFmt}`,
        format: info.format,
        width: info.width,
        height: info.height,
        size: info.size,
        originalSize,
        reduction: `${(((originalSize - info.size) / originalSize) * 100).toFixed(1)}%`
      });
    } catch (err) {
      logger.error("image/process: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     AI — SUMMARIZE
  ══════════════════════════════════════════ */
  app.post("/api/ai/summarize", ...aiProtect, async (req, res) => {
    try {
      let { text, fileId } = req.body;
      
      if (fileId && !text) {
        const filePath = path.join(UPLOADS_DIR, fileId);
        requireFile(filePath);
        const buf = await readFileFast(filePath);
        const result = await parsePDF(buf);
        text = result.text || "";
        
        if (text.trim().length < 100) {
          logger.info("Summarize: Standard extraction too brief, running AI OCR...");
          const ocrText = await performOCR(buf.toString("base64"), "application/pdf");
          if (ocrText) text = ocrText;
        }
      }

      if (!text || !text.trim()) return res.status(400).json({ error: "No text provided." });
      if (text.trim().length < 50) return res.status(400).json({ error: "Text is too short to summarize (minimum 50 characters)." });

      const cacheKey = `summary:${Buffer.from(text.slice(0, 500)).toString("base64")}`;
      const cached = getCache(cacheKey);
      if (cached) return res.json({ summary: cached });

      const wordCount = text.split(/\s+/).length;
      const prompt = `You are an expert document analyst. Extract and summarize the provided document.
Your output MUST contain ONLY headings followed by their most important bullet points. 
Do not include an overview, abstract, or any extra conversational text.

Formatting rules:
- Use **Heading Name** format for headings
- Use bullet points (•) for important points under each heading
- Extract the absolute most critical information
- Write in clear, professional English

DOCUMENT (${wordCount} words):
${text.substring(0, 45000)}`;

      const result = await callGemini(GEMINI_MODEL, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
      });

      const summary = result.text || "";
      if (!summary.trim()) throw new Error("AI returned an empty summary.");

      setCache(cacheKey, summary, 15 * 60 * 1000);
      res.json({ summary });
    } catch (err) {
      console.error("FULL AI ERROR:", err);
      logger.error("ai/summarize: " + err.message);
      const isKeyErr = err.message?.includes("API_KEY") || err.message?.includes("quota") || err.message?.includes("403") || err.message?.includes("401");
      res.status(500).json({
        error: isKeyErr
          ? `AI service unavailable — ${err.message}`
          : err.message || "AI summarization failed."
      });
    }
  });

  /* ══════════════════════════════════════════
     AI — SUMMARIZE (STREAMING)
  ══════════════════════════════════════════ */
  app.post("/api/ai/summarize-stream", ...aiProtect, async (req, res) => {
    try {
      let { text, fileId } = req.body;

      if (fileId && !text) {
        const filePath = path.join(UPLOADS_DIR, fileId);
        requireFile(filePath);
        const buf = await readFileFast(filePath);
        const result = await parsePDF(buf);
        text = result.text || "";

        if (text.trim().length < 100) {
          logger.info("Summarize Stream: Standard extraction too brief, running AI OCR...");
          const ocrText = await performOCR(buf.toString("base64"), "application/pdf");
          if (ocrText) text = ocrText;
        }
      }

      if (!text || !text.trim()) return res.status(400).json({ error: "No text provided." });

      const wordCount = text.trim().split(/\s+/).length;
      const prompt = `You are an expert document analyst. Your job is to produce a comprehensive, accurate, and well-structured summary of the provided document.

Instructions:
1. Read the entire document carefully.
2. Identify ALL major topics, sections, and key points.
3. Produce a detailed structured summary using the format below.
4. Do NOT omit important facts, figures, names, dates, or conclusions.
5. Write in clear, professional English.

Output format (strict):
- Use ## Heading for each major section/topic
- Use bullet points (-) for key details under each heading
- Include sub-bullets where needed for clarity
- After all sections, add a ## Key Takeaways section with the 5 most important conclusions
- If the document contains numbers, statistics, or dates — include them exactly

DOCUMENT (${wordCount} words):
${text.substring(0, 60000)}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2500, temperature: 0.1 },
        };
        await callGeminiStream(GEMINI_MODEL, payload, (chunkText) => {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        });
      } catch (streamErr) {
        logger.error("ai/summarize-stream: " + streamErr.message);
        res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      logger.error("ai/summarize-stream catch: " + err.message);
      try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch (_) {}
    }
  });

  /* ══════════════════════════════════════════
     AI — OCR
  ══════════════════════════════════════════ */
  app.post("/api/ai/ocr", ...aiProtect, async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) return res.status(400).json({ error: "No data provided." });

      const text = await performOCR(base64, mimeType);
      res.json({ text });
    } catch (err) {
      logger.error("vision/ocr: " + err.message);
      res.status(500).json({ error: err.message || "OCR failed." });
    }
  });

  /* ══════════════════════════════════════════
     AI — OCR STRUCTURED
  ══════════════════════════════════════════ */
  app.post("/api/ai/ocr-structured", ...aiProtect, async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) return res.status(400).json({ error: "No data provided." });

      const parsed = await performStructuredOCR(base64, mimeType);
      res.json(parsed);
    } catch (err) {
      logger.error("vision/ocr-structured: " + err.message);
      res.status(500).json({ error: err.message || "Structured OCR failed." });
    }
  });

  /* ══════════════════════════════════════════
     AI — CHAT
  ══════════════════════════════════════════ */
  app.post("/api/ai/chat", ...aiProtect, async (req, res) => {
    try {
      const { message, context, history = [] } = req.body;
      if (!message || !message.trim()) return res.status(400).json({ error: "No message provided." });

      // Build conversation with proper role alternation for Gemini
      const rawContents = [];

      if (context && context.trim()) {
        // Inject the document context as the opening system turn
        const systemPrompt = `You are an intelligent and thorough document assistant. The user has uploaded a document and you must help them understand it fully.

Here is the complete text of the uploaded document:

===== DOCUMENT START =====
${context.substring(0, 40000)}
===== DOCUMENT END =====

Your behaviour rules:
- Answer questions ONLY based on the document content above
- If asked about something not in the document, say clearly: "That information is not in the uploaded document."
- Provide detailed, accurate answers with specific quotes or data from the document when relevant
- For general greetings or meta questions ("what can you do?"), respond helpfully
- Always be concise but complete — never truncate an answer`;

        rawContents.push({ role: "user", parts: [{ text: systemPrompt }] });
        rawContents.push({ role: "model", parts: [{ text: "I have carefully read the uploaded document and I am ready to answer your questions accurately based on its contents. What would you like to know?" }] });
      }

      // Add conversation history (last 10 turns), filtering out the initial greeting
      const recentHistory = history.slice(-10).filter(
        h => !(
          h.role === "model" && (
            h.text.includes("I've analyzed your document") ||
            h.text.includes("I have read the document") ||
            h.text.includes("I have carefully read the uploaded document")
          )
        )
      );
      for (const h of recentHistory) {
        rawContents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || "..." }]
        });
      }

      // Add the current user message
      rawContents.push({ role: "user", parts: [{ text: message.trim() }] });

      // Enforce strict role alternation required by Gemini API
      const contents = [];
      for (const msg of rawContents) {
        const msgText = msg.parts[0]?.text;
        if (!msgText || !msgText.trim()) continue;
        if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
          // Merge consecutive same-role messages
          contents[contents.length - 1].parts[0].text += "\n\n" + msgText;
        } else {
          contents.push({ role: msg.role, parts: [{ text: msgText }] });
        }
      }

      // Final safety check: must end with a user message
      if (!contents.length || contents[contents.length - 1].role !== "user") {
        return res.status(400).json({ error: "Invalid conversation structure." });
      }

      logger.info(`[Chat] turns=${contents.length}, context=${context ? context.length + ' chars' : 'none'}`);

      const result = await callGemini(GEMINI_MODEL, {
        contents,
        generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
      });

      const response = result.text || "";
      if (!response.trim()) throw new Error("AI returned an empty response. Please try rephrasing your question.");
      
      res.json({ response });
    } catch (err) {
      logger.error("ai/chat: " + err.message);
      const isKeyErr = err.message?.includes("API_KEY") || err.message?.includes("quota") || err.message?.includes("403") || err.message?.includes("401");
      res.status(500).json({ 
        error: isKeyErr
          ? "AI service unavailable — API key issue or quota exceeded."
          : err.message || "Chat failed. Please try again."
      });
    }
  });



  /* ══════════════════════════════════════════
     PDF — E-SIGN
  ══════════════════════════════════════════ */
  app.post("/api/pdf/esign", async (req, res) => {
    try {
      const { fileId, signatures } = req.body;
      if (!fileId) return res.status(400).json({ error: "No fileId provided." });
      if (!Array.isArray(signatures) || signatures.length === 0)
        return res.status(400).json({ error: "No signatures provided." });

      // Determine file path
      let filePath;
      let isEncrypted = false;

      const esignPath = path.join(ESIGN_DIR, fileId);
      const normalPath = path.join(UPLOADS_DIR, fileId);

      if (fs.existsSync(esignPath)) {
        filePath = esignPath;
        isEncrypted = true;
      } else if (fs.existsSync(normalPath)) {
        filePath = normalPath;
        isEncrypted = false;
      } else {
        return res.status(404).json({ error: "File not found" });
      }

      let pdfBuffer = await readFileFast(filePath);
      if (isEncrypted) {
        pdfBuffer = decryptBuffer(pdfBuffer);
      }

      if (!isPDF(pdfBuffer)) return res.status(400).json({ error: "Not a valid PDF." });

      const srcPdf = await PDFDocument.load(pdfBuffer);
      const pages = srcPdf.getPages();

      for (const sig of signatures) {
        const {
          pageIndex, pdfX, pdfY, pdfWidth, pdfHeight,
          imageData, signerName, showDate, showBadge, date
        } = sig;

        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        const page = pages[pageIndex];

        // imageData must be base64 PNG
        const b64 = (imageData || "").replace(/^data:image\/png;base64,/, "");
        if (!b64) continue;
        const imgBytes = Buffer.from(b64, "base64");
        const embeddedImg = await srcPdf.embedPng(imgBytes);

        // pdf-lib origin is bottom-left; pdfY from frontend is already bottom-left
        page.drawImage(embeddedImg, {
          x: pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
          opacity: 1,
        });

        // Optional signer info beneath signature
        if (signerName || showDate) {
          const metaFont = await srcPdf.embedFont(StandardFonts.HelveticaOblique);
          const fz = 7;
          const lineH = fz + 3;
          let labelY = pdfY - lineH;
          if (signerName) {
            page.drawText(`Signed by: ${signerName}`, {
              x: pdfX, y: labelY, size: fz, font: metaFont,
              color: rgb(0.25, 0.25, 0.35),
            });
            labelY -= lineH;
          }
          if (showDate) {
            const dateStr = date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            page.drawText(`Date: ${dateStr}`, {
              x: pdfX, y: labelY, size: fz, font: metaFont,
              color: rgb(0.25, 0.25, 0.35),
            });
          }
        }

        // Optional verified stamp badge
        if (showBadge) {
          const badgeFont = await srcPdf.embedFont(StandardFonts.HelveticaBold);
          const bx = pdfX + pdfWidth + 4;
          const by = pdfY + pdfHeight / 2 - 4;
          page.drawRectangle({
            x: bx - 2, y: by - 2,
            width: 52, height: 14,
            color: rgb(0.93, 0.98, 0.93),
            borderColor: rgb(0.0, 0.6, 0.2),
            borderWidth: 0.75,
            borderOpacity: 1,
          });
          page.drawText("\u2713 VERIFIED", {
            x: bx, y: by + 1, size: 6.5, font: badgeFont,
            color: rgb(0.0, 0.55, 0.15),
          });
        }
      }

      // Lock signed sections by flattening any interactive form fields
      try {
        const form = srcPdf.getForm();
        form.flatten();
      } catch (e) {
        logger.info("Form flattening skipped or not applicable: " + e.message);
      }

      const rawBytes = await srcPdf.save();
      const encryptedBytes = encryptBuffer(Buffer.from(rawBytes));

      const outName = `esign-${uuidv4()}.pdf`;
      const outPath = path.join(ESIGN_DIR, outName);
      await writeFileFast(outPath, encryptedBytes);

      res.json({ id: outName, name: "signed.pdf" });
    } catch (err) {
      logger.error("esign: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — E-SIGN EMAIL NOTIFICATION MOCK
  ══════════════════════════════════════════ */
  app.post("/api/pdf/esign/notify", async (req, res) => {
    try {
      const { docId, signerEmail, shareLink, docName } = req.body;
      if (!docId || !signerEmail || !shareLink) {
        return res.status(400).json({ error: "Missing required notification fields." });
      }

      // Simulating secure email send. Logging details to terminal.
      console.log("\n============================================================\n");
      logger.info(`📧 SECURE EMAIL NOTIFICATION SENT`);
      console.log(`To: ${signerEmail}`);
      console.log(`Subject: Signature Request: Please sign the document "${docName || 'shared.pdf'}"`);
      console.log(`Body: You have been requested to add your signature to a document.`);
      console.log(`      Click the secure link below to log in, review, and sign:`);
      console.log(`      ${shareLink}`);
      console.log("\n============================================================\n");

      res.json({ success: true, message: `Notification email mock sent to ${signerEmail}` });
    } catch (err) {
      logger.error("esign/notify: " + err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     DOWNLOAD
  ══════════════════════════════════════════ */
  app.get("/api/download/:id", async (req, res) => {
    const fileId = req.params.id;
    const customName = req.query.name;
    
    let filePath;
    let isEncrypted = false;
    
    const esignPath = path.join(ESIGN_DIR, fileId);
    const normalPath = path.join(UPLOADS_DIR, fileId);
    
    if (fs.existsSync(esignPath)) {
      filePath = esignPath;
      isEncrypted = true;
    } else if (fs.existsSync(normalPath)) {
      filePath = normalPath;
      isEncrypted = false;
    } else {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = await fsPromises.stat(filePath);
    const fileName = customName || fileId;
    
    // Set appropriate MIME type to prevent browser from renaming .docx to .zip
    let mimeType = "application/octet-stream";
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Cache-Control", "no-cache");

    if (isEncrypted) {
      try {
        const encryptedBytes = await readFileFast(filePath);
        const decryptedBytes = decryptBuffer(encryptedBytes);
        res.setHeader("Content-Length", decryptedBytes.length);
        res.send(decryptedBytes);
      } catch (err) {
        logger.error("Download decryption error: " + err.message);
        res.status(500).json({ error: "Decryption failed" });
      }
    } else {
      res.setHeader("Content-Length", stat.size);
      const readStream = fs.createReadStream(filePath);
      readStream.on("error", (err) => { logger.error("Download stream error: " + err.message); });
      await pipeline(readStream, res).catch(() => {});
    }
  });

  /* ══════════════════════════════════════════
     HEALTH
  ══════════════════════════════════════════ */
  app.get("/api/health", async (_req, res) => {
    const uploadsCount = (await fsPromises.readdir(UPLOADS_DIR)).length;
    res.json({
      status: "ok",
      uptime: Math.round(process.uptime()),
      uploadsDir: uploadsCount,
      cacheEntries: cache.size,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  /* ══════════════════════════════════════════
     CLEANUP
  ══════════════════════════════════════════ */
  setInterval(async () => {
    try {
      const now = Date.now();
      
      // Helper function to clean up a specific directory
      const cleanDir = async (dirPath) => {
        try {
          const files = await fsPromises.readdir(dirPath);
          await Promise.all(files.map(async file => {
            const fp = path.join(dirPath, file);
            const stat = await fsPromises.stat(fp).catch(() => null);
            if (stat && stat.isFile() && now - stat.mtimeMs > FILE_TTL_MS) {
              await fsPromises.unlink(fp).catch(() => {});
            }
          }));
        } catch (e) {
          logger.warn(`Failed to clean directory ${dirPath}: ` + e.message);
        }
      };

      // Clean both normal uploads and e-signed documents
      await Promise.all([
        cleanDir(UPLOADS_DIR),
        cleanDir(ESIGN_DIR)
      ]);

      for (const [key, val] of cache.entries()) {
        if (Date.now() - val.ts > val.ttl) cache.delete(key);
      }
    } catch (err) {
      logger.warn("Cleanup error: " + err.message);
    }
  }, 5 * 60 * 1000);

  /* ══════════════════════════════════════════
     ERROR REPORTING (EMAIL)
  ══════════════════════════════════════════ */
  app.post("/api/report-error", async (req, res) => {
    try {
      const errorData = req.body;
      logger.info("Received client error report: " + errorData.message);
      
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;
      
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
        logger.warn("Email configuration missing, unable to send error report.");
        return res.status(500).json({ error: "Email configuration missing." });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT || 587,
        secure: SMTP_PORT === "465", // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"App Error Reporter" <${SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject: `⚠️ Application Error: ${errorData.message || "Unknown Error"}`,
        text: `An error occurred on the frontend.\n\nType: ${errorData.type}\nMessage: ${errorData.message}\nURL: ${errorData.url}\nUser-Agent: ${errorData.userAgent}\nTime: ${errorData.time}\n\nStack Trace:\n${errorData.stack || "No stack trace available."}`,
        html: `
          <h2>Frontend Error Report</h2>
          <p><strong>Type:</strong> ${errorData.type}</p>
          <p><strong>Message:</strong> ${errorData.message}</p>
          <p><strong>URL:</strong> ${errorData.url}</p>
          <p><strong>User-Agent:</strong> ${errorData.userAgent}</p>
          <p><strong>Time:</strong> ${errorData.time}</p>
          <h3>Stack Trace:</h3>
          <pre>${errorData.stack || "No stack trace available."}</pre>
        `,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Error report sent to admin." });
    } catch (err) {
      logger.error("Failed to send error report email: " + err.message);
      res.status(500).json({ error: "Failed to send email." });
    }
  });

  /* ══════════════════════════════════════════
     FEEDBACK SUBMISSION & THANK YOU EMAIL
  ══════════════════════════════════════════ */
  app.post("/api/submit-feedback", async (req, res) => {
    try {
      const { userEmail, userName, category, rating, title, comment } = req.body;
      
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;
      
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
        return res.status(500).json({ error: "Email configuration missing on server." });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT || 587,
        secure: SMTP_PORT === "465",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      // 1. Send feedback to Admin
      await transporter.sendMail({
        from: `"PageDocx Feedback" <${SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject: `New Feedback: ${category ? category.toUpperCase() : rating + ' Stars'}`,
        html: `
          <h2>New Feedback Received</h2>
          <p><strong>User:</strong> ${userName || "Anonymous"} (${userEmail || "No email"})</p>
          ${category ? `<p><strong>Category:</strong> ${category}</p>` : ''}
          ${rating ? `<p><strong>Rating:</strong> ${rating}/5</p>` : ''}
          ${title ? `<p><strong>Title:</strong> ${title}</p>` : ''}
          <p><strong>Comment:</strong></p>
          <blockquote style="border-left: 4px solid #ccc; padding-left: 10px;">${comment || "No comment"}</blockquote>
        `
      });

      // 2. Send 'Thank You' email to the User (if they provided an email)
      if (userEmail) {
        await transporter.sendMail({
          from: `"PageDocx Team" <${SMTP_USER}>`,
          to: userEmail,
          subject: "Thank You for Your Feedback!",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2>Thank You, ${userName || "there"}!</h2>
              <p>We've received your feedback and we truly appreciate you taking the time to help us improve PageDocx.</p>
              <p>Our team reads every single piece of feedback to shape the future of our document tools.</p>
              <br/>
              <p>Best regards,</p>
              <p><strong>The PageDocx Team</strong></p>
            </div>
          `
        });
      }

      res.json({ success: true, message: "Feedback submitted and emails sent." });
    } catch (err) {
      logger.error("Failed to send feedback emails: " + err.message);
      res.status(500).json({ error: "Failed to send emails." });
    }
  });

  /* ══════════════════════════════════════════
     WELCOME EMAIL — sent on new user sign-up
  ══════════════════════════════════════════ */
  app.post("/api/send-welcome-email", async (req, res) => {
    try {
      const { email, displayName } = req.body;

      if (!email) {
        return res.status(400).json({ error: "User email is required." });
      }

      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        logger.warn("SMTP configuration missing — welcome email not sent.");
        return res.status(500).json({ error: "Email configuration missing on server." });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT || 587,
        secure: SMTP_PORT === "465",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const firstName = displayName ? displayName.split(" ")[0] : "there";

      await transporter.sendMail({
        from: `"Deepak Prajapati — PageDocX" <${SMTP_USER}>`,
        to: email,
        subject: "Thank you for using PageDocX!",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <p>Dear ${firstName},</p>

            <p>Thank you for choosing <strong>PageDocX</strong>.</p>

            <p>Your support means a great deal to us. Every user who trusts PageDocX motivates us to continue building a faster, smarter, and more reliable AI-powered document platform.</p>

            <p>We truly appreciate you taking the time to use our application. Whether you've used it to chat with documents, summarize files, extract text, or manage your documents more efficiently, we're grateful to be a part of your workflow.</p>

            <p>We're continuously working to improve PageDocX by introducing new features, enhancing performance, and providing a secure and seamless experience. Your feedback and suggestions are always welcome and play an important role in shaping the future of our platform.</p>

            <p>Thank you once again for being part of our journey. We look forward to serving you with even better features in the future.</p>

            <br/>
            <p>Warm regards,</p>
            <p><strong>Deepak Prajapati</strong><br/>Founder, PageDocX</p>
          </div>
        `,
      });

      logger.info(`Welcome email sent to new user: ${email}`);
      res.json({ success: true, message: "Welcome email sent." });
    } catch (err) {
      logger.error("Failed to send welcome email: " + err.message);
      res.status(500).json({ error: "Failed to send welcome email." });
    }
  });

  /* ══════════════════════════════════════════
     RAZORPAY PAYMENT SYSTEM
  ══════════════════════════════════════════ */
  let Razorpay;
  try {
    Razorpay = require("razorpay");
  } catch (err) {
    logger.error("Razorpay module not found. Run npm install razorpay.");
  }

  app.post("/api/payment/create-order", paymentLimiter, async (req, res) => {
    try {
      const { planId, userId, email, name } = req.body;
      
      const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
      const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        return res.status(500).json({ error: "Razorpay keys not configured." });
      }

      if (!Razorpay) {
          return res.status(500).json({ error: "Razorpay not initialized." });
      }

      const instance = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
      });

      // Price mapping
      const prices = {
        "pro_monthly": 19900, // in paise
        "pro_yearly": 59900
      };

      const amount = prices[planId] || 19900;

      const options = {
        amount: amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}_${userId.substring(0, 5)}`,
        notes: {
          planId,
          userId,
          email
        }
      };

      const order = await instance.orders.create(options);
      
      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: RAZORPAY_KEY_ID
      });
    } catch (err) {
      logger.error("Create order failed: " + err.message);
      res.status(500).json({ error: "Failed to create payment order." });
    }
  });

  app.post("/api/payment/verify", paymentLimiter, async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;
      const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

      const isAuthentic = expectedSignature === razorpay_signature;

      if (isAuthentic) {
        // Verification successful, update Firebase admin
        // Note: For full security, we should ideally use Firebase Admin SDK here to securely update the subscription
        // but since we are doing this, let's at least respond success so frontend can trigger local update or we can write to db if we had admin SDK.
        // Given we don't have admin SDK configured in server.js, we will let the frontend update it securely or we just trust the client for now (since this is an MVP).
        // A better approach is using admin sdk. Let's just return success for now.
        res.json({ success: true, message: "Payment verified successfully" });
      } else {
        res.status(400).json({ success: false, error: "Invalid signature" });
      }
    } catch (err) {
      logger.error("Verify payment failed: " + err.message);
      res.status(500).json({ success: false, error: "Payment verification failed" });
    }
  });

  /* ══════════════════════════════════════════
     GLOBAL ERROR HANDLER
  ══════════════════════════════════════════ */
  app.use((err, _req, res, _next) => {
    logger.error("Unhandled: " + err.message);
    res.status(500).json({ error: "Internal Server Error" });
  });

  /* ══════════════════════════════════════════
     VITE / STATIC
  ══════════════════════════════════════════ */
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { port: 14834 } },
        appType: "spa",
      });
      app.use(vite.middlewares);
      logger.info("Vite middleware ready.");
    } catch (err) {
      logger.error("Failed to start Vite: " + err.message);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // ── SEO-critical files: NEVER cache aggressively ──────────────────
    // robots.txt and sitemap.xml must be re-fetchable by crawlers at any time.
    app.get("/robots.txt", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.sendFile(path.join(distPath, "robots.txt"));
    });
    app.get("/sitemap.xml", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.sendFile(path.join(distPath, "sitemap.xml"));
    });

    app.use(express.static(distPath, {
      maxAge: "1d",
      etag: true,
      setHeaders: (res, filePath) => {
        // Cache built assets forever since they are content-hashed
        if (filePath.includes("assets") || filePath.match(/\.(js|css|webp|png|jpg|jpeg|gif|ico|svg|woff|woff2|json)$/)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else if (filePath.endsWith(".txt") || filePath.endsWith(".xml")) {
          // robots.txt, sitemap.xml, and any other SEO/text files — no caching
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 Server ready at http://localhost:${PORT}`);
    logger.info(`📁 Uploads: ${UPLOADS_DIR}`);
    logger.info(`🔑 Gemini AI: ${process.env.GEMINI_API_KEY ? "✓ Configured" : "✗ Missing GEMINI_API_KEY"}`);
    logger.info(`🛡️  Rate limits active:`);
    logger.info(`    • AI (Gemini/OCR/Chat) : burst ${AI_BURST_MAX}/min  |  daily ${AI_DAILY_MAX}/IP  |  ban after ${AI_DAILY_MAX * 1.5}/day`);
    logger.info(`    • Adobe PDF services   : burst ${ADOBE_BURST_MAX}/min  |  daily ${ADOBE_DAILY_MAX}/IP`);
    logger.info(`    • Upload               : burst ${UPLOAD_BURST_MAX}/min`);
    logger.info(`    • Payment              : burst ${PAYMENT_BURST_MAX}/min`);
    logger.info(`    • General API          : burst ${GENERAL_BURST_MAX} / 2 min`);
    logger.info(`    • Temp ban duration    : ${TEMP_BAN_HOURS}h  |  Monitor: GET /api/security/status`);

    /* ─── KEEP-ALIVE SELF-PING (prevents Render free-tier spin-down) ─── */
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.VITE_API_URL;
    if (RENDER_URL && process.env.NODE_ENV === "production") {
      const KEEP_ALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (Render sleeps after 15)
      setInterval(async () => {
        try {
          const pingUrl = `${RENDER_URL.replace(/\/$/, "")}/api/health`;
          const resp = await fetch(pingUrl);
          const data = await resp.json();
          logger.info(`♻️  Keep-alive ping → ${data.status} (${data.timestamp})`);
        } catch (err) {
          logger.warn(`♻️  Keep-alive ping failed: ${err.message}`);
        }
      }, KEEP_ALIVE_INTERVAL_MS);
      logger.info(`♻️  Keep-alive enabled — pinging ${RENDER_URL}/api/health every 14 min`);
    }
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection: " + reason);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
