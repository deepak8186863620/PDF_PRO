import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
import { X, Save, Trash2, ZoomIn, ZoomOut, Move, Maximize2, FileSignature, Info, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const DEFAULT_SIG_W = 200;
const DEFAULT_SIG_H = 90;

export default function ESignEditor({ file, signatureData, sigProfile, onClose, onSave }) {
  const [numPages, setNumPages]       = useState(0);
  const [scale, setScale]             = useState(1.2);
  const [loading, setLoading]         = useState(true);
  const [placedSigs, setPlacedSigs]   = useState([]);
  const [activeSigId, setActiveSigId] = useState(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [canvasDims, setCanvasDims]   = useState({});

  const pdfRef       = useRef(null);
  const canvasRefs   = useRef({});
  const renderTasks  = useRef({});
  const dragging     = useRef(null);
  const resizing     = useRef(null);

  // ── Load PDF ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
      } catch (e) {
        toast.error("Failed to load PDF: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { Object.values(renderTasks.current).forEach(t => t?.cancel()); };
  }, [file]);

  // ── Render pages ──
  const renderPage = useCallback(async (pageNum) => {
    if (!pdfRef.current) return;
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;
    renderTasks.current[pageNum]?.cancel();
    try {
      const page = await pdfRef.current.getPage(pageNum);
      const vp   = page.getViewport({ scale });
      const ctx  = canvas.getContext("2d");
      if (!ctx) return;
      const dpr  = window.devicePixelRatio || 1;
      const cssW = Math.floor(vp.width);
      const cssH = Math.floor(vp.height);
      canvas.width  = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width   = cssW + "px";
      canvas.style.height  = cssH + "px";
      canvas.style.display = "block";
      setCanvasDims(prev => ({ ...prev, [pageNum]: { w: cssW, h: cssH } }));
      const task = page.render({
        canvasContext: ctx,
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      });
      renderTasks.current[pageNum] = task;
      await task.promise;
    } catch (e) {
      if (e.name !== "RenderingCancelledException") console.error(e);
    }
  }, [scale]);

  useEffect(() => {
    if (!loading && pdfRef.current) {
      for (let i = 1; i <= numPages; i++) renderPage(i);
    }
  }, [loading, numPages, renderPage]);

  // ── Place signature on click ──
  const handlePageClick = (pageNum, e) => {
    if (dragging.current || resizing.current) return;
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const sig = {
      id: `s${Date.now()}`,
      pageIndex: pageNum - 1,
      x: Math.max(0, x - DEFAULT_SIG_W / 2),
      y: Math.max(0, y - DEFAULT_SIG_H / 2),
      w: DEFAULT_SIG_W,
      h: DEFAULT_SIG_H,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    };
    setPlacedSigs(prev => [...prev, sig]);
    setActiveSigId(sig.id);
    toast.success("Signature placed! Drag to reposition.", { duration: 1500 });
  };

  // ── Drag ──
  const startDrag = (sigId, e) => {
    e.stopPropagation(); e.preventDefault();
    const sig = placedSigs.find(s => s.id === sigId);
    if (!sig) return;
    setActiveSigId(sigId);
    dragging.current = { id: sigId, sx: e.clientX, sy: e.clientY, ox: sig.x, oy: sig.y };
    const move = ev => {
      if (!dragging.current) return;
      const { id, sx, sy, ox, oy } = dragging.current;
      setPlacedSigs(p => p.map(s => s.id === id ? { ...s, x: ox + ev.clientX - sx, y: oy + ev.clientY - sy } : s));
    };
    const up = () => {
      setTimeout(() => { dragging.current = null; }, 50);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── Resize ──
  const startResize = (sigId, e) => {
    e.stopPropagation(); e.preventDefault();
    const sig = placedSigs.find(s => s.id === sigId);
    if (!sig) return;
    setActiveSigId(sigId);
    resizing.current = { id: sigId, sx: e.clientX, sy: e.clientY, ow: sig.w, oh: sig.h };
    const move = ev => {
      if (!resizing.current) return;
      const { id, sx, sy, ow, oh } = resizing.current;
      setPlacedSigs(p => p.map(s => s.id === id
        ? { ...s, w: Math.max(80, ow + ev.clientX - sx), h: Math.max(40, oh + ev.clientY - sy) }
        : s
      ));
    };
    const up = () => {
      setTimeout(() => { resizing.current = null; }, 50);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── Save / Submit ──
  const handleSave = async () => {
    if (placedSigs.length === 0) { toast.error("Place at least one signature on the PDF."); return; }
    setIsSaving(true);
    try {
      const formatted = await Promise.all(placedSigs.map(async sig => {
        const page = await pdfRef.current.getPage(sig.pageIndex + 1);
        const vp   = page.getViewport({ scale });
        const [pdfX, pdfY] = vp.convertToPdfPoint(sig.x, sig.y + sig.h);
        return {
          pageIndex:   sig.pageIndex,
          pdfX, pdfY,
          pdfWidth:    sig.w / scale,
          pdfHeight:   sig.h / scale,
          imageData:   signatureData,   // composite PNG (sig + name + desg + company)
          // pass profile metadata separately for backend text rendering
          fullName:    sigProfile?.fullName    ?? "",
          designation: sigProfile?.designation ?? "",
          company:     sigProfile?.company     ?? "",
          showDate:    false,
          showBadge:   false,
          date:        sig.date,
        };
      }));
      await onSave(formatted);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Signature overlay block (mirrors what will be embedded) ──
  const SigOverlay = ({ sig }) => {
    const isActive = activeSigId === sig.id;
    return (
      <div
        key={sig.id}
        style={{ position: "absolute", left: sig.x, top: sig.y, width: sig.w, height: sig.h, pointerEvents: "auto" }}
        onClick={e => { e.stopPropagation(); setActiveSigId(sig.id); }}
        className={`group/sig rounded-lg border transition-all duration-150 overflow-hidden ${
          isActive
            ? "border-violet-500 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]"
            : "border-dashed border-violet-400/70 hover:border-violet-400"
        }`}
      >
        {/* Composite signature image */}
        <img
          src={signatureData}
          alt="sig"
          className="w-full h-full object-contain pointer-events-none select-none bg-white"
          style={{ padding: "2px" }}
        />

        {/* Drag handle */}
        <div
          onMouseDown={e => startDrag(sig.id, e)}
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 bg-violet-600 hover:bg-violet-500 border-2 border-white rounded-full flex items-center justify-center cursor-move shadow-lg opacity-0 group-hover/sig:opacity-100 transition-opacity"
          title="Drag to move"
        >
          <Move size={11} className="text-white" />
        </div>

        {/* Delete */}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setPlacedSigs(p => p.filter(s => s.id !== sig.id)); if (activeSigId === sig.id) setActiveSigId(null); }}
          className="absolute -top-4 -right-4 w-7 h-7 bg-red-600 hover:bg-red-500 border-2 border-white rounded-full flex items-center justify-center cursor-pointer shadow-lg opacity-0 group-hover/sig:opacity-100 transition-opacity"
          title="Delete"
        >
          <X size={11} className="text-white" />
        </button>

        {/* Resize handle */}
        <div
          onMouseDown={e => startResize(sig.id, e)}
          className="absolute -bottom-3 -right-3 w-6 h-6 bg-zinc-700 hover:bg-violet-600 border-2 border-white rounded-full flex items-center justify-center cursor-se-resize shadow-md opacity-0 group-hover/sig:opacity-100 transition-opacity"
          title="Drag to resize"
        >
          <Maximize2 size={9} className="text-white" />
        </div>
      </div>
    );
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex flex-col bg-[#080808]"
    >
      {/* ── Top Bar ── */}
      <div className="shrink-0 h-16 bg-zinc-950 border-b border-white/5 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="w-10 h-10 shrink-0 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-white/5">
            <X size={18} />
          </button>
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center shrink-0">
              <FileSignature size={15} className="text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none">Place Signature</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Click anywhere on the PDF to stamp your signature block</p>
            </div>
          </div>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 p-1">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <ZoomOut size={16} />
          </button>
          <span className="text-zinc-400 text-xs font-bold w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Apply — desktop */}
        <button
          onClick={handleSave}
          disabled={isSaving || placedSigs.length === 0}
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
        >
          {isSaving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Save size={15} />}
          {isSaving ? "Applying…" : `Apply ${placedSigs.length > 0 ? `(${placedSigs.length})` : ""}`}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar */}
        <div className="w-64 shrink-0 bg-zinc-950 border-r border-white/5 p-5 flex flex-col gap-5 overflow-y-auto hidden md:flex">

          {/* Signature preview (composite block) */}
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Your Signature Block</p>
            <div className="bg-white rounded-xl p-3 shadow-inner">
              <img src={signatureData} alt="Signature Block" className="w-full object-contain max-h-24" />
            </div>
          </div>

          {/* Profile info */}
          {sigProfile?.fullName && (
            <div className="bg-zinc-900 rounded-2xl p-3 space-y-1">
              <p className="text-white text-xs font-bold">{sigProfile.fullName}</p>
              {sigProfile.designation && <p className="text-zinc-500 text-[10px]">{sigProfile.designation}</p>}
              {sigProfile.company && <p className="text-zinc-500 text-[10px]">{sigProfile.company}</p>}
            </div>
          )}

          {/* Placed list */}
          <div className="flex-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
              Placed ({placedSigs.length})
            </p>
            {placedSigs.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-2xl p-5 text-center">
                <p className="text-zinc-600 text-xs">No signatures yet</p>
                <p className="text-zinc-700 text-[10px] mt-1">Click on the PDF →</p>
              </div>
            ) : (
              <div className="space-y-2">
                {placedSigs.map((sig) => (
                  <div key={sig.id}
                    onClick={() => setActiveSigId(sig.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${activeSigId === sig.id ? "border-violet-500 bg-violet-500/10" : "border-zinc-800 hover:border-zinc-600 bg-white/2"}`}>
                    <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} className="text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-bold">Page {sig.pageIndex + 1}</p>
                      <p className="text-zinc-500 text-[10px] truncate">{Math.round(sig.w)}×{Math.round(sig.h)}px</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setPlacedSigs(p => p.filter(s => s.id !== sig.id)); if (activeSigId === sig.id) setActiveSigId(null); }}
                      className="w-6 h-6 shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={12} className="text-violet-400" />
              <p className="text-violet-300 text-[10px] font-black uppercase tracking-widest">Tips</p>
            </div>
            <ul className="text-zinc-400 text-[10px] space-y-1.5 leading-relaxed">
              <li>• Click anywhere on the PDF to place</li>
              <li>• Drag the <span className="text-violet-300">◉</span> handle to move</li>
              <li>• Drag <span className="text-violet-300">↘</span> corner to resize</li>
              <li>• Click <span className="text-red-400">✕</span> on the sig to delete</li>
            </ul>
          </div>
        </div>

        {/* PDF Canvas Area */}
        <div className="flex-1 overflow-auto bg-zinc-900/50" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-zinc-800 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-medium">Loading PDF…</p>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center gap-10">
              {Array.from({ length: numPages }, (_, i) => {
                const pageNum  = i + 1;
                const dim      = canvasDims[pageNum];
                const pageSigs = placedSigs.filter(s => s.pageIndex === i);

                return (
                  <div key={pageNum} className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 w-full justify-center">
                      <div className="h-px flex-1 bg-zinc-800 max-w-16" />
                      <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Page {pageNum}</span>
                      <div className="h-px flex-1 bg-zinc-800 max-w-16" />
                    </div>

                    <div
                      className="relative shadow-[0_8px_48px_rgba(0,0,0,0.6)] rounded-sm cursor-crosshair select-none"
                      style={{ width: dim ? dim.w : "auto", height: dim ? dim.h : "auto", background: "#fff" }}
                      onClick={e => handlePageClick(pageNum, e)}
                    >
                      <canvas ref={el => { canvasRefs.current[pageNum] = el; }} style={{ display: "block" }} />

                      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                        {pageSigs.map(sig => (
                          <SigOverlay key={sig.id} sig={sig} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile sticky bottom Apply bar ── */}
      <div className="sm:hidden shrink-0 bg-zinc-950 border-t border-white/10 px-4 py-3">
        <button
          onClick={handleSave}
          disabled={isSaving || placedSigs.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all"
        >
          {isSaving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Save size={15} />}
          {isSaving ? "Applying signatures…" : `Apply Signature${placedSigs.length > 1 ? `s (${placedSigs.length})` : ""}`}
        </button>
      </div>
    </motion.div>,
    document.body
  );
}
