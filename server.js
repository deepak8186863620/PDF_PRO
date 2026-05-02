import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import multer from "multer";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import sharp from "sharp";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { createRequire } from "module";
import zlib from "zlib";
import { promisify } from "util";
import morgan from "morgan";
import winston from "winston";
import rateLimit from "express-rate-limit";
import { pipeline } from "stream/promises";

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
const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const FILE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_UPLOAD_SIZE = "200mb";

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

/* ─────────────── MULTER (DISK, MEMORY-EFFICIENT) ─────────────── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB per file
});

/* ─────────────── GEMINI AI CLIENT ─────────────── */
let _ai = null;
function getAI() {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured on server");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

/* ─────────────── RATE LIMITERS ─────────────── */
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 60, message: { error: "Too many uploads, slow down." } });
const aiLimiter    = rateLimit({ windowMs: 60_000, max: 30, message: { error: "Too many AI requests." } });

/* ─────────────── EXPRESS SETUP ─────────────── */
async function startServer() {
  // Ensure uploads dir
  await fsPromises.mkdir(UPLOADS_DIR, { recursive: true });

  const app = express();

  // Middlewares
  app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
  app.use(express.json({ limit: MAX_UPLOAD_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: MAX_UPLOAD_SIZE }));
  app.use(morgan("dev"));

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

      if (!extractedText.trim()) {
        return res.status(400).json({ error: "No text found — this may be a scanned PDF. Try OCR instead." });
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

      // Split all pages in parallel, write to zip
      const results = await Promise.all(
        Array.from({ length: total }, async (_, i) => {
          const newPdf = await PDFDocument.create();
          const [pg] = await newPdf.copyPages(srcPdf, [i]);
          newPdf.addPage(pg);
          return { name: `page-${i + 1}.pdf`, content: Buffer.from(await newPdf.save()) };
        })
      );

      const zip = new AdmZip();
      results.forEach(r => zip.addFile(r.name, r.content));
      const zipName = `split-${uuidv4()}.zip`;
      zip.writeZip(path.join(UPLOADS_DIR, zipName));
      res.json({ id: zipName, name: "split-pages.zip" });
    } catch (err) {
      logger.error("split: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ══════════════════════════════════════════
     PDF — COMPRESS
  ══════════════════════════════════════════ */
  app.post("/api/pdf/compress", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const srcPdf = await loadPDFDoc(filePath);
      const bytes = await srcPdf.save({ useObjectStreams: true, addDefaultPage: false });
      const outName = `compressed-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);

      const originalSize = (await fsPromises.stat(filePath)).size;
      const newSize = bytes.length;
      const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

      res.json({ id: outName, name: "compressed.pdf", originalSize, newSize, reduction: `${reduction}%` });
    } catch (err) {
      logger.error("compress: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
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

      pages.forEach((page, i) => {
        if (!selectedPages.length || selectedPages.includes(i + 1)) {
          const cur = page.getRotation().angle;
          page.setRotation({ angle: (cur + (deg || 90)) % 360 });
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
     PDF — TO WORD (.docx)
  ══════════════════════════════════════════ */
  app.post("/api/pdf/to-word", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      const pdfData = await parsePDF(buf);
      const rawText = pdfData.text || "";

      // ── Smart paragraph & heading detection ──────────────────────
      const rawLines = rawText.split("\n");
      const children = [];

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
          // Blank line = paragraph break
          children.push(new Paragraph({ children: [] }));
          continue;
        }

        // Heuristics for headings: ALL-CAPS, short, isolated from blank lines, not ending with period
        const isLikelyHeading =
          trimmed.length >= 2 &&
          trimmed.length <= 120 &&
          (trimmed === trimmed.toUpperCase() || /^(Chapter|Section|Part|\d+\.\s)/.test(trimmed)) &&
          !trimmed.endsWith(".") &&
          !trimmed.endsWith(",");

        // List items: starting with bullet-like chars or numbers
        const listMatch = trimmed.match(/^(?:[-•·\u2022\u2023\u25E6\u2043\u2219*]|\d+[.)\s])\s*(.+)/);

        if (isLikelyHeading) {
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 240, after: 120 },
              children: [
                new TextRun({ text: trimmed, bold: true, size: 28, color: "1a1a2e" }),
              ],
            })
          );
        } else if (listMatch) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: listMatch[1].trim(), size: 22 })],
            })
          );
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: trimmed, size: 22 })],
              spacing: { after: 60 },
            })
          );
        }
      }

      // Add title from PDF metadata if available
      const titleText = pdfData.info?.Title || "";
      const finalChildren = titleText
        ? [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({ text: titleText, bold: true, size: 36, color: "000080" }),
              ],
              spacing: { after: 240 },
            }),
            ...children,
          ]
        : children;

      const doc = new Document({
        creator: "PDF Master",
        description: "Converted from PDF using PDF Master",
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch margins
            },
          },
          children: finalChildren.length ? finalChildren : [new Paragraph({ children: [new TextRun({ text: "No extractable text found.", italics: true })] })],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const outName = `converted-${uuidv4()}.docx`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), buffer);
      res.json({ id: outName, name: "converted.docx" });
    } catch (err) {
      logger.error("to-word: " + err.message);
      // If text extraction fails, try AI OCR as fallback
      res.status(err.status || 500).json({ 
        error: err.message.includes("encrypted")
          ? "PDF is password protected. Please unlock it first."
          : err.message.includes("No text found") || err.message.includes("text") 
            ? "Could not extract text from this PDF. It may be a scanned document — try OCR first."
            : err.message
      });
    }
  });

  /* ══════════════════════════════════════════
     PDF — WORD TO PDF
  ══════════════════════════════════════════ */
  app.post("/api/pdf/word-to-pdf", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      const result = await mammoth.extractRawText({ buffer: buf });
      const text = result.value || "";

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      const margin = 50;
      const lineHeight = fontSize * 1.4;

      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      let y = height - margin;

      const wrapLine = (line) => {
        const words = line.split(" ");
        const wrapped = [];
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(test, fontSize) > width - margin * 2) {
            if (current) wrapped.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) wrapped.push(current);
        return wrapped;
      };

      for (const rawLine of text.split("\n")) {
        const wrappedLines = rawLine.trim() ? wrapLine(rawLine) : [""];
        for (const wl of wrappedLines) {
          if (y < margin + lineHeight) {
            page = pdfDoc.addPage();
            y = height - margin;
          }
          if (wl) page.drawText(wl, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
      }

      const bytes = await pdfDoc.save();
      const outName = `converted-${uuidv4()}.pdf`;
      await writeFileFast(path.join(UPLOADS_DIR, outName), bytes);
      res.json({ id: outName, name: "converted.pdf" });
    } catch (err) {
      logger.error("word-to-pdf: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
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
        const jpegBuf = await sharp(fp).jpeg({ quality: 90 }).toBuffer();
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
     PDF — TO JPG
  ══════════════════════════════════════════ */
  app.post("/api/pdf/to-jpg", async (req, res) => {
    try {
      const { fileId } = req.body;
      const filePath = path.join(UPLOADS_DIR, fileId);
      requireFile(filePath);

      const buf = await readFileFast(filePath);
      if (!isPDF(buf)) return res.status(400).json({ error: "Not a valid PDF." });

      const srcPdf = await PDFDocument.load(buf);
      const pageCount = srcPdf.getPageCount();

      const zip = new AdmZip();
      const pageResults = await Promise.all(
        Array.from({ length: pageCount }, async (_, i) => {
          const singlePdf = await PDFDocument.create();
          const [pg] = await singlePdf.copyPages(srcPdf, [i]);
          singlePdf.addPage(pg);
          const pdfBytes = await singlePdf.save();
          return { name: `page-${i + 1}.pdf`, content: Buffer.from(pdfBytes) };
        })
      );

      pageResults.forEach(r => zip.addFile(r.name, r.content));
      const zipName = `pdf-pages-${uuidv4()}.zip`;
      zip.writeZip(path.join(UPLOADS_DIR, zipName));

      res.json({ 
        id: zipName, 
        name: "pdf-pages.zip", 
        pageCount,
        note: `${pageCount} page(s) extracted as individual PDF files.`
      });
    } catch (err) {
      logger.error("to-jpg: " + err.message);
      res.status(err.status || 500).json({ error: err.message });
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
  app.post("/api/ai/summarize", aiLimiter, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) return res.status(400).json({ error: "No text provided." });
      if (text.trim().length < 50) return res.status(400).json({ error: "Text is too short to summarize (minimum 50 characters)." });

      const cacheKey = `summary:${Buffer.from(text.slice(0, 500)).toString("base64")}`;
      const cached = getCache(cacheKey);
      if (cached) return res.json({ summary: cached });

      const ai = getAI();
      const wordCount = text.split(/\s+/).length;
      const prompt = `You are an expert document analyst and summarizer. Analyze the following document and provide a comprehensive yet concise summary.

Your summary MUST include:
1. **Overview** — A 2-3 sentence abstract of the entire document
2. **Key Points** — 4-8 bullet points covering the most important information
3. **Main Topics** — List the primary subjects/themes covered
4. **Notable Details** — Any important numbers, dates, names, or facts

Formatting rules:
- Use **bold** for headings and important terms
- Use bullet points (•) for lists
- Keep total response under 400 words
- Write in clear, professional English

DOCUMENT (${wordCount} words):
${text.substring(0, 45000)}`;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 800, temperature: 0.2 },
      });

      const summary = result.text || "";
      if (!summary.trim()) throw new Error("AI returned an empty summary.");
      
      setCache(cacheKey, summary, 15 * 60 * 1000);
      res.json({ summary });
    } catch (err) {
      logger.error("ai/summarize: " + err.message);
      const isKeyErr = err.message?.includes("API_KEY") || err.message?.includes("quota");
      res.status(500).json({ 
        error: isKeyErr 
          ? "AI service unavailable — API key issue. Contact support."
          : err.message || "AI summarization failed."
      });
    }
  });

  /* ══════════════════════════════════════════
     AI — SUMMARIZE (STREAMING)
  ══════════════════════════════════════════ */
  app.post("/api/ai/summarize-stream", aiLimiter, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) return res.status(400).json({ error: "No text provided." });

      const ai = getAI();
      const prompt = `You are an expert document summarizer. Provide a comprehensive summary with:
1. **Overview** — 2-3 sentence abstract
2. **Key Points** — bullet list of main takeaways
3. **Important Details** — key facts, numbers, dates

DOCUMENT:
${text.substring(0, 45000)}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 800, temperature: 0.2 },
      });

      for await (const chunk of stream) {
        const chunkText = chunk.text || "";
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      logger.error("ai/summarize-stream: " + err.message);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  /* ══════════════════════════════════════════
     AI — OCR
  ══════════════════════════════════════════ */
  app.post("/api/ai/ocr", aiLimiter, async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) return res.status(400).json({ error: "No data provided." });

      const ai = getAI();
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: base64, mimeType: mimeType || "application/pdf" } },
            { text: "Extract ALL text from this document accurately." },
          ],
        }],
        config: { maxOutputTokens: 8192 },
      });

      const text = result.text || "";
      res.json({ text });
    } catch (err) {
      logger.error("ai/ocr: " + err.message);
      res.status(500).json({ error: err.message || "OCR failed." });
    }
  });

  /* ══════════════════════════════════════════
     AI — OCR STRUCTURED
  ══════════════════════════════════════════ */
  app.post("/api/ai/ocr-structured", aiLimiter, async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) return res.status(400).json({ error: "No data provided." });

      const ai = getAI();
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: 'Perform OCR. Return JSON: { "text", "x", "y", "width", "height" }' },
            { inlineData: { data: base64, mimeType: mimeType || "image/jpeg" } },
          ],
        }],
        config: { responseMimeType: "application/json", maxOutputTokens: 4096 },
      });

      const responseText = result.text || "[]";
      let parsed;
      try { parsed = JSON.parse(responseText); } catch { parsed = []; }
      res.json(parsed);
    } catch (err) {
      logger.error("ai/ocr-structured: " + err.message);
      res.status(500).json({ error: err.message || "Structured OCR failed." });
    }
  });

  /* ══════════════════════════════════════════
     AI — CHAT
  ══════════════════════════════════════════ */
  app.post("/api/ai/chat", aiLimiter, async (req, res) => {
    try {
      const { message, context, history = [] } = req.body;
      if (!message || !message.trim()) return res.status(400).json({ error: "No message provided." });

      const ai = getAI();
      
      // Build a focused system context
      const systemPart = context
        ? `You are an intelligent document assistant. Your job is to answer questions ONLY based on the document content provided below. 
- Be specific, accurate, and cite relevant parts of the document.
- If the answer is not in the document, say "This information is not in the document."
- Keep answers concise and well-formatted using markdown.
- For lists, use bullet points. For numbers/stats, be exact.

DOCUMENT CONTENT (${context.length} characters):
---
${context.substring(0, 28000)}
---`
        : "You are a helpful document assistant. Help the user with their document-related questions.";

      // Build conversation with proper role alternation for Gemini
      const contents = [];
      
      // Add system context as first user message if we have it
      if (context) {
        contents.push({
          role: "user",
          parts: [{ text: systemPart }]
        });
        contents.push({
          role: "model",
          parts: [{ text: "I've read the document and I'm ready to answer your questions about it. What would you like to know?" }]
        });
      }
      
      // Add conversation history (last 8 turns)
      const recentHistory = history.slice(-8);
      for (const h of recentHistory) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }]
        });
      }
      
      // Add current question
      contents.push({
        role: "user",
        parts: [{ text: message.trim() }]
      });

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents,
        config: { maxOutputTokens: 1500, temperature: 0.15 },
      });

      const response = result.text || "";
      if (!response.trim()) throw new Error("AI returned empty response");
      
      res.json({ response });
    } catch (err) {
      logger.error("ai/chat: " + err.message);
      const isKeyErr = err.message?.includes("API_KEY") || err.message?.includes("quota");
      res.status(500).json({ 
        error: isKeyErr
          ? "AI service unavailable — check your API key configuration."
          : err.message || "Chat failed. Please try again."
      });
    }
  });

  /* ══════════════════════════════════════════
     AI — OCR STRUCTURED (for PDF Editor)
  ══════════════════════════════════════════ */
  app.post("/api/ai/ocr-structured", aiLimiter, async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) return res.status(400).json({ error: "Missing image data." });

      const ai = getAI();
      
      const prompt = `Perform OCR on this image. Return ONLY a valid JSON array of objects representing each block of text found. 
Each object must have exactly these keys:
- text: The extracted text string
- x: The X coordinate of the top-left corner (relative to image width, 0-1000 scale)
- y: The Y coordinate of the top-left corner (relative to image height, 0-1000 scale)
- width: The width of the text block (relative to image width, 0-1000 scale)
- height: The height of the text block (relative to image height, 0-1000 scale)

Example output:
[{"text": "Hello World", "x": 100, "y": 150, "width": 300, "height": 40}]

Return only the raw JSON array. No markdown formatting, no \`\`\`json block.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: mimeType || "image/jpeg", data: base64 } },
              { text: prompt }
            ]
          }
        ],
        config: { temperature: 0.1 }
      });

      let responseText = result.text || "[]";
      responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      
      let parsed = [];
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Failed to parse OCR structured data from AI.");
      }

      res.json(parsed);
    } catch (err) {
      logger.error("ai/ocr-structured: " + err.message);
      res.status(500).json({ error: err.message || "Structured OCR failed." });
    }
  });

  /* ══════════════════════════════════════════
     DOWNLOAD
  ══════════════════════════════════════════ */
  app.get("/api/download/:id", async (req, res) => {
    const fileId = req.params.id;
    const customName = req.query.name;
    const filePath = path.join(UPLOADS_DIR, fileId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = await fsPromises.stat(filePath);
    const fileName = customName || fileId;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "no-cache");

    const readStream = fs.createReadStream(filePath);
    readStream.on("error", (err) => { logger.error("Download stream error: " + err.message); });
    await pipeline(readStream, res).catch(() => {});
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
      const files = await fsPromises.readdir(UPLOADS_DIR);
      await Promise.all(files.map(async file => {
        const fp = path.join(UPLOADS_DIR, file);
        const stat = await fsPromises.stat(fp).catch(() => null);
        if (stat && now - stat.mtimeMs > FILE_TTL_MS) {
          await fsPromises.unlink(fp).catch(() => {});
        }
      }));

      for (const [key, val] of cache.entries()) {
        if (Date.now() - val.ts > val.ttl) cache.delete(key);
      }
    } catch (err) {
      logger.warn("Cleanup error: " + err.message);
    }
  }, 5 * 60 * 1000);

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
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { port: 3001 } },
        appType: "spa",
      });
      app.use(vite.middlewares);
      logger.info("Vite middleware ready.");
    } catch (err) {
      logger.error("Failed to start Vite: " + err.message);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { maxAge: "7d", etag: true }));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 Server ready at http://localhost:${PORT}`);
    logger.info(`📁 Uploads: ${UPLOADS_DIR}`);
    logger.info(`🔑 Gemini AI: ${process.env.GEMINI_API_KEY ? "✓ Configured" : "✗ Missing GEMINI_API_KEY"}`);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection: " + reason);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
