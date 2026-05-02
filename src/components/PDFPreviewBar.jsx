import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Check, Square, CheckSquare, Layers, ChevronLeft, ChevronRight, Eye, FileText, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Use unpkg CDN for the worker (matches installed version exactly)
const PDFJS_VERSION = pdfjsLib.version;
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
}

// ─── Mini single-page preview canvas ─────────────────────────────────────────
function PageCanvas({ pdfDoc, pageNum, scale = 1.0, className = "", onClick, selected, showNum = true }) {
  const canvasRef = useRef(null);
  const taskRef = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (taskRef.current) taskRef.current.cancel();
        const task = page.render({ canvasContext: ctx, viewport });
        taskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn(`Page ${pageNum} render error:`, err.message);
        }
      }
    };
    render();

    return () => {
      cancelled = true;
      if (taskRef.current) taskRef.current.cancel();
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`relative group cursor-pointer rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl transition-all duration-200 ${
        selected
          ? "ring-4 ring-red-500 ring-offset-2 ring-offset-black"
          : "hover:ring-2 hover:ring-zinc-600 hover:ring-offset-2 hover:ring-offset-black"
      } ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-auto block" />

      {/* Selection overlay */}
      <div className={`absolute inset-0 transition-all duration-200 ${selected ? "bg-red-500/10" : "bg-black/0 group-hover:bg-white/5"}`} />

      {/* Checkbox */}
      {onClick && (
        <div className="absolute top-2 right-2">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${
            selected
              ? "bg-red-500 text-white scale-110 shadow-red-500/50"
              : "bg-black/60 text-white/50 backdrop-blur-md border border-white/10 group-hover:bg-black/80"
          }`}>
            {selected ? <CheckSquare size={16} /> : <Square size={16} />}
          </div>
        </div>
      )}

      {showNum && (
        <div className="absolute bottom-2 left-2">
          <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
            {pageNum}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Dynamic Document Preview ─────────────────────────────────────────────────
export function PDFDocumentPreview({ file }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [file]);

  if (!file) return null;
  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-10 flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Loading Preview…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-center">
        <p className="text-zinc-500 text-sm">Could not render preview</p>
        <p className="text-zinc-700 text-xs mt-1">{error}</p>
      </div>
    );
  }
  if (!pdfDoc) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center">
            <Eye size={18} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight truncate max-w-[200px]">{file.name}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
              Page {currentPage} of {numPages}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-black/50 rounded-2xl p-1.5 border border-zinc-800/50">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-black text-zinc-400 px-2 tabular-nums">{currentPage}/{numPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="p-6 flex justify-center bg-black/20">
        <div className="max-w-full rounded-xl overflow-hidden shadow-2xl bg-white">
          <PageCanvas pdfDoc={pdfDoc} pageNum={currentPage} scale={1.2} showNum={false} className="rounded-xl" />
        </div>
      </div>

      {/* Thumbnail strip */}
      {numPages > 1 && (
        <div className="px-6 pb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
              <div key={n} className="shrink-0 w-16" onClick={() => setCurrentPage(n)}>
                <PageCanvas
                  pdfDoc={pdfDoc}
                  pageNum={n}
                  scale={0.2}
                  selected={n === currentPage}
                  showNum
                  className="w-16 h-20 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Selectable Page Preview Bar (for tools that need page selection) ─────────
export default function PDFPreviewBar({ file, onSelectionChange, title = "Select Pages", toolId }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [file]);

  const toggle = (pageNum) => {
    setSelectedPages(prev => {
      const next = prev.includes(pageNum) ? prev.filter(p => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b);
      onSelectionChange(next);
      return next;
    });
  };

  const selectAll = () => {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    setSelectedPages(all);
    onSelectionChange(all);
  };

  const deselectAll = () => {
    setSelectedPages([]);
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center">
        <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mx-auto mb-6" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Generating Previews…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-3xl p-10 text-center">
        <RefreshCw size={24} className="mx-auto text-zinc-600 mb-3" />
        <p className="text-zinc-500 text-sm">Preview unavailable</p>
        <p className="text-zinc-700 text-xs mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-zinc-900/30 border border-zinc-800/50 rounded-[40px] p-6 md:p-10 backdrop-blur-2xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
            <Layers size={24} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">{title}</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
              {selectedPages.length} of {totalPages} pages selected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-black/50 p-2 rounded-2xl border border-zinc-800/50">
          <button onClick={selectAll} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">
            Select All
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          <button onClick={deselectAll} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">
            Deselect All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {pdfDoc && Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
          <PageCanvas
            key={pageNum}
            pdfDoc={pdfDoc}
            pageNum={pageNum}
            scale={0.3}
            selected={selectedPages.includes(pageNum)}
            onClick={() => toggle(pageNum)}
            showNum
            className="aspect-[3/4]"
          />
        ))}
      </div>
    </div>
  );
}
