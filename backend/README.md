# PageDocx Backend API

Welcome to the backend of the PageDocx platform. This service is a comprehensive Express.js application designed to handle high-performance PDF manipulation, image processing, automated OCR, and AI-powered document interactions.

## 🌟 Key Features

1. **PDF Processing Engine**
   - Built on `pdf-lib` and `@adobe/pdfservices-node-sdk`.
   - Capabilities: Merge, Split, Compress, Rotate, Watermark, Page Numbering, E-Signature (encrypted), Lock/Unlock, and Metadata extraction.
2. **File Conversion**
   - Word to PDF & PDF to Word (via Adobe Services).
   - Excel/PPTX to PDF.
   - Images to PDF & PDF to JPG extraction.
3. **AI & Vision**
   - Powered by Google Gemini (`gemini-2.5-flash`) for streaming chat context and document summarization.
   - Built-in Google Cloud Vision for OCR and structured data extraction from scanned documents.
4. **Image Processing**
   - High-performance image manipulation using `sharp` (Resize, Crop, Filters, Format conversion).
5. **Security & Rate Limiting**
   - E-Signatures are encrypted at rest using AES-256-CBC.
   - Endpoints are protected by `express-rate-limit` to prevent abuse.
6. **Payment Integration**
   - Integrated Razorpay flows for subscription management.

## 🏗 Architecture & Code Structure

The backend operates via a unified `server.js` optimized for performance with in-memory caching and efficient streaming APIs.

### Current Modules:
- **Routing:** Centralized in `server.js` handling all `/api/*` endpoints.
- **Caching:** Built-in memory map with TTL for extraction and AI response caching.
- **Storage:** Disk-based Multer with auto-cleanup of files exceeding 30-minutes TTL.
- **Frontend Serving:** Acts as a proxy for the Vite SPA in development, and serves static `dist` files in production (with aggressive cache headers for assets).

### Recommended Future Improvements (The "Good Backend" Path)
To scale this monolith, we recommend adopting an MVC/Layered structure:
```
backend/
├── src/
│   ├── config/       # Environment & Secrets (Razorpay, Gemini, Adobe)
│   ├── controllers/  # Route handlers (PDF, AI, Auth, Payment)
│   ├── middlewares/  # Rate limiting, Error Handling, Multer config
│   ├── routes/       # Express routers for modularity
│   ├── services/     # Core business logic (Adobe SDK calls, Gemini calls)
│   └── utils/        # Helpers (Encryption, Caching, isPDF validation)
├── server.js         # Entry point & Express initialization
```

## 🚀 Setup & Installation

### Environment Variables
Ensure the following are set in your root `.env`:
```env
# AI & Vision
GEMINI_API_KEY=your_gemini_key
GOOGLE_APPLICATION_CREDENTIALS=backend/google-cloud-vision-credentials.json

# Adobe PDF Services
ADOBE_CLIENT_ID=your_adobe_id
ADOBE_CLIENT_SECRET=your_adobe_secret

# Security & Payments
PDF_ENCRYPTION_KEY=your_aes_seed
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Error Reporting (Optional)
SMTP_HOST=your_smtp
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
ADMIN_EMAIL=admin@example.com
```

### Running the Server
```bash
# Development (with Vite frontend proxy)
npm run dev

# Production
npm run build
npm run start
```

## 📡 Core API Endpoints

### PDF Operations (`/api/pdf/*`)
- `POST /extract-text` - Extracts text or uses OCR fallback.
- `POST /merge` - Combines multiple PDFs.
- `POST /split` - Extracts specific pages or all pages.
- `POST /compress` - Reduces file size via Adobe API.
- `POST /watermark` - Overlays dynamic text on pages.
- `POST /esign` - Embeds signatures and securely locks the PDF.

### AI Operations (`/api/ai/*`)
- `POST /chat` - Conversational context based on uploaded documents.
- `POST /summarize` - Contextual document summarization (supports streaming).
- `POST /ocr` - Raw optical character recognition.

### System (`/api/*`)
- `GET /health` - Service uptime, cache size, memory usage.
- `GET /download/:id` - Secure, decrypted file retrieval.

## 🧹 Maintenance
The server includes a 5-minute interval background worker that automatically deletes orphaned uploads and expired cache entries to maintain optimal memory usage.
