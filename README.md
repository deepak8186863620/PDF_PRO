# PDF MASTER - Full-Stack Document & Image Processor

PDF MASTER is a comprehensive, modern, and AI-powered web application for processing PDF documents and images. Inspired by "I Love PDF," it offers a clean, dark-themed UI with a robust backend and real-time processing capabilities.

## 🚀 Tech Stack

- **Frontend:** React.js, Tailwind CSS, Framer Motion (Animations), Lucide React (Icons), Sonner (Toasts).
- **Backend:** Node.js, Express (Full-stack integration).
- **AI:** Google Gemini API (Summarization & OCR).
- **Database & Auth:** Firebase (Authentication & Firestore).
- **Processing Libraries:**
  - `pdf-lib`: PDF merging, splitting, and rotating.
  - `sharp`: High-performance image processing (conversion, compression).
  - `pdf-parse`: Text extraction from PDF for AI processing.
  - `multer`: Secure file upload handling.

---

## ✨ Core Features

### 1. PDF Tools
- **Merge PDF:** Combine multiple PDFs into a single file.
- **Split PDF:** Extract pages from a PDF into separate documents.
- **Rotate PDF:** Permanently rotate PDF pages by 90-degree increments.
- **Compress PDF:** Optimize PDF size for web sharing.

### 2. Image Tools
- **Convert Image:** Transform images between JPG, PNG, and WEBP formats.
- **Compress Image:** Reduce file size without significant quality loss.

### 3. Document Intelligence Tools
- **Summarize PDF:** Automatically summarize long PDF documents into concise bullet points.
- **Extract Text (OCR):** Extract text from scanned PDFs and images accurately using Gemini Vision.

### 4. User Dashboard & History
- **Google Authentication:** Secure login via Firebase Auth.
- **Activity History:** Automatically track and save all processing operations to Firestore.
- **Dashboard:** A personalized view for users to manage their history and re-download files.

---

## 🛠️ Implementation Steps

### Step 1: Project Initialization
- Configured `metadata.json` with app name and permissions.
- Updated `package.json` to support a full-stack architecture using `tsx` to run the server.

### Step 2: Backend Development (`server.ts`)
- Set up an Express server on port 3000.
- Integrated `multer` for secure file uploads to a local `uploads/` directory.
- Implemented core processing endpoints using `pdf-lib` and `sharp`.
- Added a maintenance task to auto-delete uploaded files after 30 minutes to ensure privacy and storage efficiency.

### Step 3: Document Intelligence Integration
- Integrated the `@google/genai` SDK.
- Created endpoints for PDF Summarization and OCR, leveraging the Gemini 3 Flash model for high-speed reasoning and vision capabilities.

### Step 4: Firebase Setup
- Provisioned a Firebase project with Auth and Firestore.
- Created `firestore.rules` with strict "Least Privilege" access controls.
- Implemented a `firebase-blueprint.json` to define the data structure for Users and History.

### Step 5: Frontend Development
- Built a modern, responsive UI with a dark-themed aesthetic.
- Created reusable components: `Navbar`, `Footer`, `ToolCard`, `FileUpload`, and `ProcessingOverlay`.
- Implemented `ToolView` to handle the logic for file selection, upload, processing, and download.
- Developed the `Dashboard` to fetch and display real-time history from Firestore.

---

## 🔌 Integrations & How They Run

### 1. File Processing Flow
1. User selects a tool and uploads files via `FileUpload.tsx`.
2. Files are sent to `/api/upload` on the Express server.
3. The server stores files temporarily and returns unique IDs.
4. The frontend calls a specific processing endpoint (e.g., `/api/pdf/merge`) with the file IDs.
5. The server processes the files using `pdf-lib` or `sharp` and returns a new file ID.
6. The user downloads the result via `/api/download/:id`.

### 2. Document Intelligence (Summarization & OCR)
- **Summarization:** The server extracts text from the PDF using `pdf-parse` and sends it to Gemini with a summarization prompt.
- **OCR:** The server converts the PDF/Image to a base64 string and sends it to Gemini Vision for text extraction.

### 3. Firebase Auth & Firestore
- **Auth:** Handled client-side using `signInWithPopup`.
- **History:** After a successful process, the frontend calls `addDoc` to save the operation metadata (file name, tool, timestamp) to the `history` collection in Firestore.

---

## 🚀 How to Run

1. **Environment Variables:**
   Ensure the following are set in your environment or `.env` file:
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `APP_URL`: The base URL of your application.

2. **Start Development Server:**
   ```bash
   npm run dev
   ```
   This starts the Express server which also serves the Vite frontend middleware.

3. **Build for Production:**
   ```bash
   npm run build
   npm start
   ```

---

## 🔮 Future Expansion & Adding Features

### 1. Adding New PDF Tools
- **Example: Add Watermark**
  - **Backend:** Update `server.ts` to include a new route `/api/pdf/watermark`. Use `pdf-lib` to draw text or images on each page of the document.
  - **Frontend:** Add a new tool definition in `constants.tsx` and update `ToolView.tsx` to handle the new tool ID.

### 2. Adding New Image Tools
- **Example: Resize Image**
  - **Backend:** Add a route `/api/image/resize`. Use `sharp(filePath).resize(width, height).toFile(...)`.
  - **Frontend:** Update the UI to allow users to input desired dimensions.

### 3. Premium Tier & Payments
- Integrate **Razorpay** or **Stripe** by adding a backend route to create orders and a frontend checkout component.
- Update Firestore rules to check for a `isPremium` flag on the user document before allowing large file uploads or advanced AI features.

### 4. Multi-Language Support
- Use `react-i18next` to manage translations.
- Store the user's preferred language in their Firestore profile.

### 5. Admin Panel
- Create a protected route `/admin` that only users with an `admin` role (defined in Firestore) can access.
- Use Firestore queries to monitor total uploads, active users, and system health.

---

**PDF MASTER** is designed to be modular. Each tool is isolated in its logic, making it easy to plug in new processing libraries or AI models as your application grows.
