import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download, FileCheck, Sparkles, FileText, Camera, Edit3, Send, User, MessageSquare, Plus, X, Hash } from "lucide-react";
import FileUpload from "./FileUpload";
import CameraScanner from "./CameraScanner";
import PDFPreviewBar, { PDFDocumentPreview } from "./PDFPreviewBar";
import PDFVisualEditor from "./PDFVisualEditor";
import ProcessingOverlay from "./ProcessingOverlay";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { auth, db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { trackToolUsage, trackError } from "../lib/analytics";

export default function ToolView({ tool, onBack }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultFile, setResultFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [ocrText, setOcrText] = useState(null);
  const [pagesToProcess, setPagesToProcess] = useState("");
  const [customFileName, setCustomFileName] = useState("");
  const [watermarkText, setWatermarkText] = useState("WATERMARK");
  const [pageNumberPosition, setPageNumberPosition] = useState("bottom-center");
  const [editText, setEditText] = useState("");
  const [password, setPassword] = useState("");
  const [imageFormat, setImageFormat] = useState("jpg");
  const [imageQuality, setImageQuality] = useState(80);
  const [rotation, setRotation] = useState(90);
  const [showCamera, setShowCamera] = useState(false);
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [edits, setEdits] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [pdfContext, setPdfContext] = useState(null);
  const [isChatting, setIsChatting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Processing your files...");
  const [user] = useAuthState(auth);

  // Range selector state (for remove-pages tool)
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [pageRanges, setPageRanges] = useState([]); // [{from, to}]

  // Expand ranges + comma list into a sorted, unique array of page numbers
  const expandRanges = (rangesArr, manualInput) => {
    const pages = new Set();
    // From visual range badges
    rangesArr.forEach(({ from, to }) => {
      const f = parseInt(from), t = parseInt(to);
      if (!isNaN(f) && !isNaN(t)) {
        const lo = Math.min(f, t), hi = Math.max(f, t);
        for (let p = lo; p <= hi; p++) pages.add(p);
      }
    });
    // From the manual text input (supports both "1,3,5" and "2-6" tokens)
    if (manualInput && manualInput.trim()) {
      manualInput.split(",").forEach((token) => {
        token = token.trim();
        if (/^\d+-\d+$/.test(token)) {
          const [a, b] = token.split("-").map(Number);
          const lo = Math.min(a, b), hi = Math.max(a, b);
          for (let p = lo; p <= hi; p++) pages.add(p);
        } else if (/^\d+$/.test(token)) {
          pages.add(Number(token));
        }
      });
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const addRange = () => {
    const f = parseInt(rangeFrom), t = parseInt(rangeTo);
    if (isNaN(f) || isNaN(t) || f < 1 || t < 1) {
      toast.error("Please enter valid page numbers.");
      return;
    }
    if (f > t) {
      toast.error("'From' page must be ≤ 'To' page.");
      return;
    }
    setPageRanges((prev) => [...prev, { from: f, to: t }]);
    setRangeFrom("");
    setRangeTo("");
  };

  const removeRange = (idx) => {
    setPageRanges((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsChatting(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage, 
          context: pdfContext,
          history: chatMessages 
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      setChatMessages(prev => [...prev, { role: "model", text: data.response }]);

      if (user) {
        try {
          await addDoc(collection(db, "aiInteractions"), {
            userId: user.uid,
            prompt: userMessage,
            response: data.response,
            timestamp: Timestamp.now(),
            toolId: tool.id,
            type: "chat"
          });
        } catch (err) {
          console.error("Failed to log AI interaction:", err);
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
      const errMsg = error.message || "Unknown error";
      const userFriendly = errMsg.includes("API_KEY") || errMsg.includes("quota")
        ? "AI service is temporarily unavailable. Please try again later."
        : "Failed to get AI response: " + errMsg;
      toast.error(userFriendly);
      // Remove the optimistic user message if AI totally failed
      setChatMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setIsChatting(false);
    }
  };

  const handleOpenVisualEditor = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setProgress(30);
    
    try {
      const formData = new FormData();
      formData.append("files", files[0]);
      
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { files: uploadedFiles } = await uploadRes.json();
      
      setUploadedFileId(uploadedFiles[0].id);
      setShowVisualEditor(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFilesAdded = (newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileRemoved = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const saveHistory = async (result) => {
    if (!user) return;
    const finalName = customFileName.trim() 
      ? (customFileName.trim().endsWith(result.name.split('.').pop()) 
          ? customFileName.trim() 
          : `${customFileName.trim()}.${result.name.split('.').pop()}`)
      : (result.name || "processed_file");

    try {
      await addDoc(collection(db, "history"), {
        userId: user.uid,
        toolId: tool.name,
        fileName: finalName,
        fileSize: result.size || 0,
        timestamp: Timestamp.now(),
        downloadUrl: `/api/download/${result.id}${customFileName.trim() ? `?name=${encodeURIComponent(finalName)}` : ""}`
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "history");
    }
  };

  const processFiles = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file.");
      return;
    }

    if ((tool.id === "merge-pdf" || tool.id === "add-pages") && files.length < 2) {
      toast.error("Please upload at least 2 files for this tool.");
      return;
    }

    if (tool.id === "remove-pages") {
      const expanded = expandRanges(pageRanges, pagesToProcess);
      if (expanded.length === 0) {
        toast.error("Please select at least one page to remove (use ranges, thumbnails, or manual input).");
        return;
      }
    }
    if (tool.id === "split-pdf" && pagesToProcess.trim()) {
      if (!/^(\s*\d+\s*(,\s*\d+\s*)*)$/.test(pagesToProcess)) {
        toast.error("Please provide valid page numbers or leave empty to split all pages.");
        return;
      }
    }

    if (tool.id === "rotate-pdf" && pagesToProcess.trim()) {
      if (!/^(\s*\d+\s*(,\s*\d+\s*)*)$/.test(pagesToProcess)) {
        toast.error("Please provide valid comma-separated page numbers (e.g., 1, 3, 5) or leave empty for all pages.");
        return;
      }
    }

    setIsProcessing(true);
    setProgress(10);
    // Set context-specific processing message
    const statusMap = {
      "summarize-pdf": "Extracting text from PDF...",
      "chat-pdf": "Analyzing document for chat...",
      "ocr-pdf": "Running AI OCR engine...",
      "pdf-to-word": "Converting PDF to Word...",
      "merge-pdf": "Merging PDF documents...",
      "split-pdf": "Splitting pages...",
      "compress-pdf": "Compressing PDF...",
      "edit-pdf": "Preparing editor...",
      "word-to-pdf": "Converting Word to PDF...",
    };
    setProcessingStatus(statusMap[tool.id] || "Processing your files...");
    trackToolUsage(tool.id, 'process_start', { file_count: files.length });

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      
      setProgress(30);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { files: uploadedFiles } = await uploadRes.json();
      
      setProgress(60);
      
      let processRes;
      if (tool.id === "merge-pdf") {
        processRes = await fetch("/api/pdf/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: uploadedFiles.map((f) => f.id) }),
        });
      } else if (tool.id === "split-pdf") {
        processRes = await fetch("/api/pdf/split", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id,
            pagesToProcess: pagesToProcess 
          }),
        });
      } else if (tool.id === "compress-pdf") {
        processRes = await fetch("/api/pdf/compress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else if (tool.id === "rotate-pdf") {
        processRes = await fetch("/api/pdf/rotate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id, 
            degrees: rotation,
            pagesToProcess: pagesToProcess
          }),
        });
      } else if (tool.id === "jpg-to-pdf" || tool.id === "scan-to-pdf") {
        processRes = await fetch("/api/pdf/jpg-to-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: uploadedFiles.map((f) => f.id) }),
        });
      } else if (tool.id === "convert-image" || tool.id === "compress-image") {
        processRes = await fetch("/api/image/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id, 
            format: tool.id === "convert-image" ? imageFormat : "jpg",
            quality: tool.id === "compress-image" ? imageQuality : 80
          }),
        });
      } else if (tool.id === "pptx-to-pdf") {
        processRes = await fetch("/api/pdf/pptx-to-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else if (tool.id === "repair-pdf") {
        processRes = await fetch("/api/pdf/repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else if (tool.id === "chat-pdf") {
        const extractRes = await fetch("/api/pdf/extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id,
            pagesToProcess: pagesToProcess
          }),
        });
        
        if (!extractRes.ok) throw new Error("Failed to extract text from PDF for chat");
        const { text } = await extractRes.json();
        setPdfContext(text);
        setChatMessages([{ role: "model", text: "Hello! I've analyzed your document. What would you like to know about it?" }]);
        
        processRes = { 
          ok: true, 
          json: async () => ({ 
            id: uploadedFiles[0].id, 
            name: "chat-session" 
          }) 
        };
      } else if (tool.id === "summarize-pdf") {
        const extractRes = await fetch("/api/pdf/extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id,
            pagesToProcess: pagesToProcess
          }),
        });
        
        if (!extractRes.ok) {
          const errorData = await extractRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to extract text from PDF");
        }
        const { text } = await extractRes.json();
        setProgress(75);
        setProcessingStatus("Generating AI summary...");

        // Use streaming for real-time summary output
        let streamedSummary = "";
        // Set up the result file first so summary view is shown
        setResultFile({ id: uploadedFiles[0].id, name: "summary.pdf", size: 0 });
        setSummary(""); // clear any old summary first
        setProgress(100);
        // Hide processing overlay so summary streams in live
        setIsProcessing(false);
        setProgress(0);

        const streamRes = await fetch("/api/ai/summarize-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!streamRes.ok) throw new Error("AI summarization failed");

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.error) {
                  // Surface AI errors to the user immediately
                  toast.error("AI Error: " + parsed.error);
                  setIsProcessing(false);
                  setResultFile(null);
                  setSummary(null);
                  return;
                }
                if (parsed.text) {
                  streamedSummary += parsed.text;
                  setSummary(streamedSummary);
                }
                if (parsed.done) break;
              } catch (_e) { /* skip partial SSE parse errors */ }
            }
          }
        }

        const summaryText = streamedSummary;
        setSummary(summaryText);

        if (user) {
          try {
            await addDoc(collection(db, "aiInteractions"), {
              userId: user.uid,
              prompt: `Summarize PDF text (${text.length} chars)`,
              response: summaryText,
              timestamp: Timestamp.now(),
              toolId: tool.id,
              type: "summary"
            });
          } catch (err) {
            console.error("Failed to log AI interaction:", err);
          }
        }
        
        processRes = { 
          ok: true, 
          json: async () => ({ 
            summary: summaryText, 
            id: "ai-result", 
            name: "summary.pdf" 
          }) 
        };
        // Early return: streaming already set isProcessing=false and summary state
        saveHistory({ id: uploadedFiles[0].id, name: "summary.pdf", size: 0 });
        toast.success("Summary generated!");
        return;
      } else if (tool.id === "ocr-pdf") {
        const base64Res = await fetch("/api/pdf/get-base64", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id,
            pagesToProcess: pagesToProcess
          }),
        });
        
        if (!base64Res.ok) {
          const errorData = await base64Res.json();
          throw new Error(errorData.error || "Failed to get document data for OCR");
        }
        const { base64: base64Data } = await base64Res.json();
        
        const file = files[0];
        const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

        const ocrRes = await fetch("/api/ai/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: base64Data, mimeType }),
        });

        if (!ocrRes.ok) throw new Error(await ocrRes.text());
        const ocrData = await ocrRes.json();
        const extractedText = ocrData.text;
        setOcrText(extractedText);

        if (user) {
          try {
            await addDoc(collection(db, "aiInteractions"), {
              userId: user.uid,
              prompt: `OCR PDF (${base64Data.length} bytes)`,
              response: extractedText,
              timestamp: Timestamp.now(),
              toolId: tool.id,
              type: "ocr"
            });
          } catch (err) {
            console.error("Failed to log AI interaction:", err);
          }
        }
        
        processRes = { 
          ok: true, 
          json: async () => ({ 
            text: extractedText, 
            id: "ai-result", 
            name: "extracted-text.pdf" 
          }) 
        };
      } else if (tool.id === "pdf-to-word") {
        processRes = await fetch("/api/pdf/to-word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else if (tool.id === "word-to-pdf") {
        processRes = await fetch("/api/pdf/word-to-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else if (tool.id === "remove-pages") {
        const expandedPages = expandRanges(pageRanges, pagesToProcess);
        processRes = await fetch("/api/pdf/remove-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id, 
            pages: expandedPages
          }),
        });
      } else if (tool.id === "add-pages") {
        processRes = await fetch("/api/pdf/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: uploadedFiles.map((f) => f.id) }),
        });
      } else if (tool.id === "excel-to-pdf") {
        processRes = await fetch("/api/pdf/excel-to-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else if (tool.id === "watermark-pdf") {
        processRes = await fetch("/api/pdf/watermark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id, text: watermarkText }),
        });
      } else if (tool.id === "page-numbers-pdf") {
        processRes = await fetch("/api/pdf/page-numbers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id, position: pageNumberPosition }),
        });
      } else if (tool.id === "edit-pdf") {
        processRes = await fetch("/api/pdf/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fileId: uploadedFiles[0].id, 
            edits: edits.length > 0 ? edits : undefined,
            text: editText || undefined
          }),
        });
      } else if (tool.id === "lock-pdf" || tool.id === "unlock-pdf") {
        processRes = await fetch(`/api/pdf/${tool.id === "lock-pdf" ? "lock" : "unlock"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id, password }),
        });
      } else if (tool.id === "pdf-to-jpg") {
        processRes = await fetch("/api/pdf/to-jpg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: uploadedFiles[0].id }),
        });
      } else {
        processRes = { ok: true, json: async () => ({ id: uploadedFiles[0].id, name: "processed.pdf" }) };
      }

      if (!processRes.ok) {
        const errorData = await processRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Processing failed");
      }
      const result = await processRes.json();
      
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        if (tool.id === "summarize-pdf") {
          setSummary(result.summary);
          setResultFile({ id: result.id, name: result.name, size: 0 });
          saveHistory(result);
        } else if (tool.id === "ocr-pdf") {
          setOcrText(result.text);
          setResultFile({ id: result.id, name: result.name, size: 0 });
          saveHistory(result);
        } else {
          setResultFile(result);
          saveHistory(result);
        }
        trackToolUsage(tool.id, 'process_success');
        toast.success("File processed successfully!");
      }, 100);

    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      trackError('ToolView', error.message);
      toast.error(error.message || "An error occurred during processing.");
    }
  };

  const downloadResult = async () => {
    try {
      const isAI = tool.id === "ocr-pdf" || tool.id === "summarize-pdf";
      const content = summary || ocrText;

      if (isAI && content) {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const defaultName = tool.id === "summarize-pdf" ? "Summary" : "OCR_Result";
        link.download = `${defaultName}_${files[0]?.name || "Document"}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Text downloaded successfully!");
        return;
      }

    if (resultFile && resultFile.id !== "ai-result") {
      const ext = resultFile.name.split('.').pop() || "";
      const finalName = customFileName.trim() 
        ? (customFileName.trim().toLowerCase().endsWith(`.${ext.toLowerCase()}`) 
            ? customFileName.trim() 
            : `${customFileName.trim()}.${ext}`)
        : resultFile.name;
      
      const url = `/api/download/${resultFile.id}?name=${encodeURIComponent(finalName)}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', finalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      trackToolUsage(tool.id, 'download_result');
    }
    } catch (err) {
      console.error("Download Error:", err);
      toast.error("Download failed: " + err.message);
    }
  };

  return (
    <div className="min-h-screen pt-24 md:pt-32 pb-24 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-full transition-all duration-300 text-sm font-bold shadow-md hover:shadow-lg mb-8 w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" />
          Back to Tools
        </button>

        <div className="text-center mb-10 md:mb-14">
          <div className={`${tool.color} w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white shadow-lg`}>
            <tool.icon size={24} />
          </div>
          <h1 className="text-3xl md:text-4xl font-800 text-white mb-3 tracking-tight">{tool.name}</h1>
          <p className="text-zinc-400 text-base max-w-lg mx-auto mb-6 leading-relaxed">{tool.description}</p>

          {tool.features && (
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
              {tool.features.map((feature, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 text-[10px] font-700 uppercase tracking-wider rounded-full"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {feature}
                </span>
              ))}
            </div>
          )}

          {tool.proTip && (
            <div className="mt-6 p-4 rounded-xl max-w-lg mx-auto flex items-start gap-3 text-left"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Sparkles className="text-white shrink-0 mt-0.5" size={14} />
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="font-700 uppercase tracking-wider mr-2 text-white">Pro Tip:</span>
                {tool.proTip}
              </p>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!resultFile && !summary && !ocrText ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-6 max-w-md mx-auto p-5 rounded-2xl"
                style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <label className="block text-[10px] font-700 uppercase tracking-widest mb-2.5" style={{ color: "#ffffff" }}>
                  Output Filename (Optional)
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="e.g. my-document"
                  className="input-field"
                />
              </div>

              <div className="px-4 md:px-0">
                <FileUpload
                  files={files}
                  onFilesAdded={handleFilesAdded}
                  onFileRemoved={handleFileRemoved}
                  accept={
                    tool.id === "word-to-pdf" 
                      ? { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }
                      : tool.id === "excel-to-pdf"
                        ? { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"] }
                        : tool.id === "pptx-to-pdf"
                          ? { "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] }
                          : tool.category === "pdf" || tool.id === "summarize-pdf" || tool.id === "ocr-pdf" || tool.id === "chat-pdf"
                            ? { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png", ".webp"] } 
                            : { "image/*": [".jpg", ".jpeg", ".png", ".webp"] }
                  }
                  multiple={tool.id === "merge-pdf" || tool.id === "add-pages" || tool.id === "jpg-to-pdf" || tool.id === "scan-to-pdf"}
                />
              </div>

              {/* ── Dynamic Document Preview (shown for all PDF tools when a PDF file is selected) ── */}
              {files.length > 0 &&
                files[0].name?.toLowerCase().endsWith(".pdf") &&
                tool.id !== "ocr-pdf" &&
                tool.id !== "summarize-pdf" &&
                tool.id !== "remove-pages" &&
                tool.id !== "split-pdf" &&
                tool.id !== "rotate-pdf" &&
                tool.id !== "edit-pdf" &&
                tool.id !== "chat-pdf" && (
                  <PDFDocumentPreview file={files[0]} />
                )}

              {tool.id === "scan-to-pdf" && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setShowCamera(true)}
                    className="flex items-center gap-3 px-7 py-3.5 rounded-full font-600 text-sm text-black bg-white shadow-lg transition-all hover:scale-105"
                  >
                    <Camera size={18} />
                    Open Camera to Scan
                  </button>
                </div>
              )}

              {tool.id === "ocr-pdf" && files.length > 0 && files[0].name?.toLowerCase().endsWith(".pdf") && (
                <div className="space-y-6">
                  <PDFPreviewBar 
                    file={files[0]} 
                    onSelectionChange={(selected) => setPagesToProcess(selected.join(","))}
                    title="Select Pages to OCR"
                    toolId={tool.id}
                  />
                  <p className="max-w-md mx-auto text-[10px] text-zinc-600 italic text-center">
                    Note: If no pages are selected, the entire document will be processed.
                  </p>
                </div>
              )}

              {tool.id === "summarize-pdf" && files.length > 0 && files[0].name?.toLowerCase().endsWith(".pdf") && (
                <div className="space-y-6">
                  <PDFPreviewBar 
                    file={files[0]} 
                    onSelectionChange={(selected) => setPagesToProcess(selected.join(","))}
                    title="Select Pages to Summarize"
                    toolId={tool.id}
                  />
                  <p className="max-w-md mx-auto text-[10px] text-zinc-600 italic text-center">
                    Note: If no pages are selected, the entire document will be summarized.
                  </p>
                </div>
              )}

              {tool.id === "remove-pages" && files.length > 0 && (
                <div className="space-y-6">
                  <PDFPreviewBar 
                    file={files[0]} 
                    onSelectionChange={(selected) => setPagesToProcess(selected.join(","))}
                    title="Select Pages to Remove"
                    toolId={tool.id}
                  />

                  {/* ── Smart Page Range Selector ── */}
                  <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-black/30">
                      <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center">
                        <Hash size={18} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white tracking-tight">Smart Range Selector</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Select a range of pages to remove</p>
                      </div>
                      {(pageRanges.length > 0 || pagesToProcess.trim()) && (
                        <span className="ml-auto px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-black text-red-400 uppercase tracking-widest">
                          {expandRanges(pageRanges, pagesToProcess).length} pages queued
                        </span>
                      )}
                    </div>

                    <div className="p-6 space-y-5">
                      {/* Range input row */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">From Page</label>
                          <input
                            id="range-from"
                            type="number"
                            min="1"
                            value={rangeFrom}
                            onChange={(e) => setRangeFrom(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && document.getElementById("range-to").focus()}
                            placeholder="e.g. 2"
                            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors font-mono text-sm"
                          />
                        </div>
                        <div className="flex items-end justify-center pb-3">
                          <span className="text-zinc-600 font-black text-lg">→</span>
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">To Page</label>
                          <input
                            id="range-to"
                            type="number"
                            min="1"
                            value={rangeTo}
                            onChange={(e) => setRangeTo(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addRange()}
                            placeholder="e.g. 30"
                            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors font-mono text-sm"
                          />
                        </div>
                        <button
                          onClick={addRange}
                          className="flex items-center justify-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-red-500/20 shrink-0"
                        >
                          <Plus size={14} /> Add Range
                        </button>
                      </div>

                      {/* Range badges */}
                      {pageRanges.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Added Ranges</p>
                          <div className="flex flex-wrap gap-2">
                            <AnimatePresence>
                              {pageRanges.map((r, idx) => (
                                <motion.span
                                  key={idx}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-xs font-black text-red-300"
                                >
                                  Pages {r.from}–{r.to}
                                  <button
                                    onClick={() => removeRange(idx)}
                                    className="w-4 h-4 rounded-full bg-red-500/20 hover:bg-red-500 flex items-center justify-center transition-colors"
                                  >
                                    <X size={10} />
                                  </button>
                                </motion.span>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">or type manually</span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>

                      {/* Manual input */}
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                          Manual Entry — comma-separated, ranges OK (e.g. 1, 3, 8-15, 20)
                        </label>
                        <input 
                          type="text"
                          value={pagesToProcess}
                          onChange={(e) => setPagesToProcess(e.target.value)}
                          placeholder="e.g. 1, 3, 8-15, 20"
                          className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors font-mono text-sm"
                        />
                      </div>

                      {/* Live preview of expanded pages */}
                      {expandRanges(pageRanges, pagesToProcess).length > 0 && (
                        <div className="p-4 rounded-2xl bg-black/50 border border-zinc-800">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Pages that will be removed</p>
                          <p className="text-xs font-mono text-red-400 leading-relaxed break-all">
                            {expandRanges(pageRanges, pagesToProcess).join(", ")}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            Total: {expandRanges(pageRanges, pagesToProcess).length} page(s)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tool.id === "split-pdf" && files.length > 0 && (
                <div className="space-y-6">
                  <PDFPreviewBar 
                    file={files[0]} 
                    onSelectionChange={(selected) => setPagesToProcess(selected.join(","))}
                    title="Select Pages to Extract"
                    toolId={tool.id}
                  />
                  
                  <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl">
                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
                      Pages to Extract (e.g. 1, 3, 5)
                    </label>
                    <input 
                      type="text"
                      value={pagesToProcess}
                      onChange={(e) => setPagesToProcess(e.target.value)}
                      placeholder="Enter page numbers separated by commas"
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
                    />
                    <p className="mt-2 text-[10px] text-zinc-600 italic">
                      Note: Page numbers start from 1. You can select them from the preview above.
                    </p>
                  </div>
                </div>
              )}

              {tool.id === "rotate-pdf" && files.length > 0 && (
                <div className="space-y-6">
                  <PDFPreviewBar 
                    file={files[0]} 
                    onSelectionChange={(selected) => setPagesToProcess(selected.join(","))}
                    title="Select Pages to Rotate"
                    toolId={tool.id}
                  />
                  
                  <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl">
                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
                      Rotation Angle
                    </label>
                    <div className="flex gap-4">
                      {[90, 180, 270].map((deg) => (
                        <button
                          key={deg}
                          onClick={() => setRotation(deg)}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            rotation === deg 
                              ? "bg-white text-black shadow-lg scale-105" 
                              : "bg-black text-zinc-400 border border-zinc-800 hover:border-zinc-600"
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 text-[10px] text-zinc-600 italic">
                      Note: Selected pages will be rotated clockwise. If no pages are selected, the entire document will be rotated.
                    </p>
                  </div>
                </div>
              )}

              {tool.id === "watermark-pdf" && files.length > 0 && (
                <div className="mt-8 max-w-md mx-auto p-5 rounded-2xl"
                  style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <label className="block text-[10px] font-700 uppercase tracking-widest mb-3" style={{ color: "#ffffff" }}>Watermark Text</label>
                  <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Enter watermark text" className="input-field" />
                </div>
              )}

              {tool.id === "page-numbers-pdf" && files.length > 0 && (
                <div className="mt-8 max-w-md mx-auto p-5 rounded-2xl"
                  style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <label className="block text-[10px] font-700 uppercase tracking-widest mb-3" style={{ color: "#ffffff" }}>Page Number Position</label>
                  <select value={pageNumberPosition} onChange={(e) => setPageNumberPosition(e.target.value)}
                    className="input-field">
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              )}

              {tool.id === "edit-pdf" && files.length > 0 && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Edit3 className="text-white" size={32} />
                      </div>
                      <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Visual Editor Ready</h3>
                      <p className="text-zinc-500 text-sm mb-8">
                        Our advanced visual editor allows you to add text, rotate pages, and remove pages directly on the PDF.
                      </p>
                      <button 
                        onClick={handleOpenVisualEditor}
                        className="px-10 py-4 bg-white hover:bg-zinc-200 text-black rounded-full font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-white/10 hover:scale-105"
                      >
                        Open Visual Editor
                      </button>
                    </div>
                  </div>

                  {showVisualEditor && uploadedFileId && createPortal(
                    <PDFVisualEditor 
                      file={files[0]} 
                      onClose={() => setShowVisualEditor(false)}
                      onSave={async (edits) => {
                        setShowVisualEditor(false);
                        setIsProcessing(true);
                        setProgress(20);
                        
                        try {
                          const res = await fetch("/api/pdf/edit", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                              fileId: uploadedFileId, 
                              edits 
                            }),
                          });
                          
                          if (!res.ok) throw new Error("Failed to save edits");
                          const result = await res.json();
                          
                          setProgress(100);
                          setResultFile({ id: result.id, name: result.name, size: 0 });
                          toast.success("PDF edited successfully!");
                          saveHistory(result);
                        } catch (err) {
                          toast.error(err.message);
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                    />,
                    document.body
                  )}
                </div>
              )}

              {tool.id === "convert-image" && files.length > 0 && (
                <div className="mt-8 max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl">
                  <label className="block text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
                    Target Format
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {["jpg", "png", "webp"].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setImageFormat(fmt)}
                        className={`py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${
                          imageFormat === fmt 
                            ? "bg-white text-black shadow-lg scale-105" 
                            : "bg-black text-zinc-400 border border-zinc-800 hover:border-zinc-600"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tool.id === "compress-image" && files.length > 0 && (
                <div className="mt-8 max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">
                      Compression Quality
                    </label>
                    <span className="text-white font-black">{imageQuality}%</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="100"
                    value={imageQuality}
                    onChange={(e) => setImageQuality(parseInt(e.target.value))}
                    className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    <span>Small Size</span>
                    <span>Best Quality</span>
                  </div>
                </div>
              )}

              {(tool.id === "lock-pdf" || tool.id === "unlock-pdf") && files.length > 0 && (
                <div className="mt-8 max-w-md mx-auto p-5 rounded-2xl"
                  style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <label className="block text-[10px] font-700 uppercase tracking-widest mb-3" style={{ color: "#ffffff" }}>
                    {tool.id === "lock-pdf" ? "Password to Lock PDF" : "Password to Unlock PDF"}
                  </label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password" className="input-field" />
                </div>
              )}
              
              {tool.id === "chat-pdf" && files.length > 0 && (
                <div className="space-y-6">
                  <PDFPreviewBar
                    file={files[0]}
                    onSelectionChange={(selected) => setPagesToProcess(selected.join(","))}
                    title="Select Pages to Chat About"
                    toolId={tool.id}
                  />
                  <p className="max-w-md mx-auto text-[10px] text-zinc-600 italic text-center">
                    Note: Select specific pages or leave unselected to chat about the entire document.
                  </p>
                </div>
              )}

              {tool.id === "chat-pdf" && (
                <div className="mt-12 flex justify-center">
                  <button
                    onClick={processFiles}
                    disabled={files.length === 0}
                    className={`flex items-center gap-2.5 px-8 py-3.5 rounded-full font-700 text-sm transition-all ${
                      files.length > 0
                        ? "btn-primary"
                        : "cursor-not-allowed text-zinc-600"
                    }`}
                    style={files.length === 0 ? { background: "rgba(24,24,27,0.6)", border: "1px solid rgba(255,255,255,0.05)" } : {}}
                  >
                    <MessageSquare size={16} />
                    Start Chat with PDF
                  </button>
                </div>
              )}

              {tool.id !== "edit-pdf" && tool.id !== "chat-pdf" && (
                <div className="mt-12 flex justify-center">
                  <button
                    onClick={processFiles}
                    disabled={files.length === 0}
                    className={`flex items-center gap-2.5 px-8 py-3.5 rounded-full font-700 text-sm transition-all ${
                      files.length > 0
                        ? "btn-primary"
                        : "cursor-not-allowed text-zinc-600"
                    }`}
                    style={files.length === 0 ? { background: "rgba(24,24,27,0.6)", border: "1px solid rgba(255,255,255,0.05)" } : {}}
                  >
                    <Sparkles size={16} />
                    Process File{files.length > 1 ? "s" : ""}
                  </button>
                </div>
              )}
            </motion.div>
          ) : chatMessages.length > 0 ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 md:p-6 flex flex-col h-[500px] md:h-[600px] max-w-4xl mx-auto mx-4 md:mx-auto"
            >
              <div className="flex items-center gap-4 mb-4 md:mb-6 pb-4 border-b border-zinc-800">
                <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-white font-bold text-sm md:text-base">AI Document Assistant</h3>
                  <p className="text-zinc-500 text-[10px] md:text-xs uppercase tracking-widest font-black">Powered by Gemini 3 Flash</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4 md:mb-6 pr-2 custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] md:max-w-[75%] p-3 md:p-4 rounded-2xl text-sm ${
                      msg.role === "user" 
                        ? "bg-white text-black rounded-tr-none" 
                        : "bg-zinc-800 text-zinc-300 rounded-tl-none"
                    }`}>
                      <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase font-bold tracking-wider">
                        {msg.role === "user" ? <User size={10} /> : <FileText size={10} />}
                        {msg.role === "user" ? "You" : "PDF Assistant"}
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 md:gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-black border border-zinc-800 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-white text-sm focus:outline-none focus:border-white transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isChatting || !chatInput.trim()}
                  className="w-12 h-12 md:w-14 md:h-14 bg-white hover:bg-zinc-200 text-black rounded-xl md:rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Send size={20} className="md:w-6 md:h-6" />
                </button>
              </div>
              
              <button
                onClick={() => {
                  setChatMessages([]);
                  setPdfContext(null);
                  setResultFile(null);
                  setFiles([]);
                }}
                className="mt-4 text-zinc-500 text-[10px] md:text-xs hover:text-zinc-300 transition-colors"
              >
                Close Chat & Start Over
              </button>
            </motion.div>
          ) : summary || ocrText ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6 md:p-10"
              style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {summary ? <Sparkles size={18} className="text-white" /> : <FileText size={18} className="text-white" />}
                </div>
                <h2 className="text-xl font-700 text-white">{summary ? "Document Summary" : "Extracted Text"}</h2>
              </div>

              <div className="prose-custom mb-8 text-left text-sm leading-relaxed max-h-[400px] overflow-y-auto pr-2">
                <ReactMarkdown>{summary || ocrText}</ReactMarkdown>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={downloadResult} className="btn-primary flex-1 justify-center py-3">
                  <Download size={16} />
                  Download PDF
                </button>
                <button
                  onClick={() => { setSummary(null); setOcrText(null); setResultFile(null); setFiles([]); }}
                  className="btn-secondary flex-1 justify-center py-3"
                >
                  Process Another
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-10 md:p-14 text-center"
              style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <FileCheck size={28} className="text-white" />
              </div>
              <h2 className="text-2xl font-700 text-white mb-2">Your file{resultFile?.files ? "s are" : " is"} ready!</h2>
              <p className="text-zinc-500 text-sm mb-8">Processing complete. Download your file{resultFile?.files ? "s" : ""} below.</p>

              {resultFile?.files && resultFile.files.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                  {resultFile.files.map((f, i) => {
                    const isImage = f.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);
                    return (
                      <div key={f.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center gap-3">
                        {isImage ? (
                          <img src={`/api/download/${f.id}`} alt={f.name} className="w-full h-auto rounded-lg shadow-md max-h-32 object-contain bg-white" />
                        ) : (
                          <div className="w-full h-24 rounded-lg shadow-md bg-zinc-800 flex items-center justify-center border border-zinc-700">
                            <FileCheck size={32} className="text-red-400" />
                          </div>
                        )}
                        <p className="text-[10px] text-zinc-400 truncate w-full text-center font-bold tracking-widest uppercase">{f.name}</p>
                        <a 
                          href={`/api/download/${f.id}?name=${encodeURIComponent(f.name)}`} 
                          download 
                          className="btn-primary w-full py-2 text-xs flex justify-center items-center font-bold"
                        >
                          <Download size={14} className="mr-1"/> Download
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
                  <button onClick={downloadResult} className="btn-primary px-8 py-3">
                    <Download size={16} />
                    Download {customFileName.trim() || "File"}
                  </button>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={() => { setResultFile(null); setFiles([]); }}
                  className="btn-secondary px-8 py-3"
                >
                  Process Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isProcessing && <ProcessingOverlay status={processingStatus} progress={progress} />}

      
      {showCamera && (
        <CameraScanner 
          onPhotosCaptured={(capturedFiles) => {
            setFiles((prev) => [...prev, ...capturedFiles]);
            setShowCamera(false);
          }}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
