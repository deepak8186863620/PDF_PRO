# 🗂️ PDF & Image Tools

> A powerful, all-in-one document and image processing suite built with React, Node.js, and AI — no subscriptions, no sign-ups required.

![Tech Stack](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Google-Gemini%202.5%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)
![Adobe PDF](https://img.shields.io/badge/Adobe-PDF%20Services-FF0000?style=flat-square&logo=adobe&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## What is this?

Honestly, I built this because I was tired of paying for iLovePDF or SmallPDF every month just to merge a few files or compress a PDF. So I made my own — and it ended up being way more capable than I expected.

This is a **full-stack web application** that lets you do everything you'd normally need a paid tool for: merge, split, compress, rotate, watermark, lock/unlock PDFs, extract text with OCR, convert documents between formats, and even **chat with your PDF** using Gemini AI. All file processing happens on your own server, so your documents never leave your control. It features an optional user authentication system and can be installed as a Progressive Web App (PWA) for a native-like experience.

---

## ✨ Features

### 📄 PDF Tools
| Tool | What it does |
|---|---|
| **Merge PDF** | Combine multiple PDFs into one, in any order |
| **Split PDF** | Extract specific pages or split into individual files |
| **Compress PDF** | Shrink file size with adjustable compression levels (Low, Medium, High) |
| **Rotate PDF** | Rotate all or specific pages by any degree |
| **Watermark PDF** | Add custom text watermarks with adjustable opacity, color, and angle |
| **Page Numbers** | Auto-number pages at any position (top/bottom, left/center/right) |
| **Remove Pages** | Delete individual or multiple pages from a document |
| **Add Pages** | Insert blank or existing pages into a PDF |
| **Edit PDF** | Overlay text annotations on any page |
| **Lock PDF** | Password-protect a PDF with custom permissions |
| **Unlock PDF** | Remove password from a PDF (requires the password) |
| **Repair PDF** | Recover and re-save corrupted or malformed PDFs |
| **PDF Metadata** | View title, author, page count, encryption status, and more |
| **Scan to PDF** | Use your camera to photograph documents and convert to PDF |

### 🔄 Conversion Tools
| Tool | What it does |
|---|---|
| **PDF to Word** | Convert PDFs to editable `.docx` files with layout preservation |
| **Word to PDF** | Convert `.docx` files to PDF |
| **PDF to JPG** | Export each PDF page as a high-quality JPG image |
| **JPG to PDF** | Bundle one or more images into a PDF |
| **Excel to PDF** | Convert `.xlsx` spreadsheets to PDF |
| **PowerPoint to PDF** | Convert `.pptx` presentations to PDF |

### 🤖 AI-Powered Tools
| Tool | What it does |
|---|---|
| **Chat with PDF** | Ask questions about your document and get instant, context-aware answers |
| **Summarize PDF** | Auto-generate professional **PDF summaries** with key insights (Headings & Bullets only) using **Gemini 2.5 Flash** |
| **Extract Text (OCR)** | Pull text from scanned PDFs or images using **Google Cloud Vision** with professional PDF output |

### 🖼️ Image Tools
| Tool | What it does |
|---|---|
| **Compress Image** | Reduce image file size without noticeable quality loss |
| **Convert Image** | Convert between JPG, PNG, and WebP formats |
| **Remove Background** | (Coming Soon) AI-powered background removal |

---

## 📱 Mobile-First Experience

This app isn't just a desktop tool. We've optimized the entire experience for modern smartphones:
- **Installable PWA**: Install the application directly to your home screen for a native app-like experience.
- **Side-by-Side Tools**: Two-column layout on mobile for faster navigation.
- **Back-Gesture Support**: Full History API integration means your phone's back-swipe gesture cleanly exits tools without reloading the site.
- **Responsive Typography**: Dynamic font scaling ensures readability on everything from an iPhone SE to a 4K monitor.
- **Full-Width Interactions**: Buttons and inputs are sized for comfortable thumb-tap interactions.

---

## 🏗️ Tech Stack

**Frontend**
- React 19 + Vite 6
- Tailwind CSS v4
- Framer Motion (animations)
- React Dropzone (drag-and-drop uploads)
- Lucide React (icons)
- Firebase (auth + analytics)

**Backend**
- Node.js + Express
- `pdf-lib` — PDF creation and manipulation
- `pdf-parse` — text extraction
- `pdfjs-dist` — page rendering
- `@napi-rs/canvas` — server-side canvas for image export
- `sharp` — high-performance image processing
- `docx` — Word document generation
- `mammoth` — Word document reading
- `xlsx` — Excel reading
- `@adobe/pdfservices-node-sdk` — Adobe PDF Services for high-fidelity DOCX/JPG conversion
- `@google-cloud/vision` — Google Cloud Vision OCR for document intelligence
- `@google/genai` — **Gemini 2.5 Flash** (ultra-fast chat and summarization)
- `pdf-lib` — PDF creation, merging, and professional PDF report generation
- `multer` — file uploads (up to 200 MB)
- `socket.io` — real-time progress updates
- `express-rate-limit` — rate limiting
- `winston` + `morgan` — logging

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- A [Gemini API key](https://aistudio.google.com/app/apikey) (for AI features)
- Optionally: Google Cloud Vision credentials (for OCR on scanned PDFs)
- Optionally: Adobe PDF Services credentials (for advanced conversions)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pdf-image-tools.git
cd pdf-image-tools

# Install dependencies
npm install
```

### Configuration

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

```env
# Required for AI features (Chat with PDF, Summarize)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Google Analytics tracking
VITE_GA_ID=G-XXXXXXXXXX

# Optional: Adobe PDF Services (for advanced document conversion)
PDF_SERVICES_CLIENT_ID=your_adobe_client_id
PDF_SERVICES_CLIENT_SECRET=your_adobe_client_secret

# Optional: Google Cloud Vision (for OCR on scanned documents)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### Run the app

```bash
npm run dev
```

That's it. The server starts on `http://localhost:3000` and serves both the API and the React frontend through Vite's dev server.

---

## 📁 Project Structure

```
├── backend/
│   ├── server.js        # Main Express server with all API endpoints
│   └── vision.js        # Google Cloud Vision OCR integration
├── src/
│   ├── App.jsx          # Main React app + routing
│   ├── components/      # UI components (tools, layout, modals)
│   ├── constants.jsx    # Tool definitions and metadata
│   ├── firebase.js      # Firebase config and initialization
│   └── index.css        # Global styles
├── public/              # Static assets
├── uploads/             # Temporary file storage (auto-cleaned after 30 min)
├── .env.example         # Environment variable template
├── vite.config.js       # Vite + Tailwind config
└── render.yaml          # Render.com deployment config
```

---

## 🔌 API Reference

All endpoints accept and return JSON. Files are uploaded first via `/api/upload`, which returns a `fileId` used in subsequent tool calls.

### Upload Files
```
POST /api/upload
Content-Type: multipart/form-data

files: <file(s)>
→ { files: [{ id, name, size, path }] }
```

### PDF Operations (examples)
```
POST /api/pdf/merge       { fileIds: ["id1", "id2"] }
POST /api/pdf/split       { fileId, pagesToProcess: "1,3,5" }
POST /api/pdf/compress    { fileId }
POST /api/pdf/rotate      { fileId, degrees: 90, pagesToProcess: "1,2" }
POST /api/pdf/watermark   { fileId, text, opacity, fontSize, color, angle }
POST /api/pdf/lock        { fileId, password }
POST /api/pdf/unlock      { fileId, password }
POST /api/pdf/metadata    { fileId }
POST /api/pdf/edit        { fileId, edits: [...] }
POST /api/pdf/repair      { fileId }
```

### Conversion
```
POST /api/pdf/to-word     { fileId }
POST /api/pdf/to-jpg      { fileId }
POST /api/pdf/to-images   { fileId }
POST /api/image/to-pdf    { fileIds: [...] }
```

### AI Features
```
POST /api/ai/chat         { fileId, message, history: [...] }
POST /api/ai/summarize    { fileId, pagesToProcess }
POST /api/ai/ocr          { fileId }
```

### Download
```
GET /api/download/:fileId
```

---

## 🔒 Security Notes

- Files are stored temporarily in `/uploads` and automatically deleted after **30 minutes**
- Rate limiting is enforced: 60 uploads/min, 30 AI requests/min per IP
- CORS is open by default in dev — restrict `origin` in `server.js` before deploying to production
- Never commit your `.env` file — it's in `.gitignore` already

---

## ☁️ Deployment

The project includes a `render.yaml` for one-click deployment on [Render.com](https://render.com).

For other platforms:

```bash
# Build the frontend
npm run build

# Start the production server (serves built frontend + API)
npm start
```

The Express server serves the Vite-built `dist/` folder in production mode automatically.

---

## 🧠 How the AI features work

**Chat with PDF** — The PDF text is extracted and sent to Gemini along with your question and the conversation history. Responses are streamed back in real time via socket.io, so you don't wait for a full reply before seeing anything.

**Summarize PDF** — Text is extracted (with optional page selection), then sent to Gemini with a structured prompt asking for bullet-point key insights.

**OCR** — Uses Google Cloud Vision's `documentTextDetection` feature, which is significantly better than basic OCR for scanned documents, handwriting, and complex layouts. Falls back gracefully if Vision credentials aren't configured.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push and open a PR

---

## 📄 License

MIT — use it however you like.

---

## 👤 Author

**Deepak Prajapati**

Built as a personal project to replace overpriced document tools with something open, fast, and actually useful.

---

*If this project saved you a few dollars on a PDF subscription, consider giving it a ⭐ — it helps more than you'd think.*
