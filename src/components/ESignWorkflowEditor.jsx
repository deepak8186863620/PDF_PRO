import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
import { X, Save, ZoomIn, ZoomOut, Move, Maximize2, FileSignature, Info, Settings, HelpCircle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export default function ESignWorkflowEditor({ file, userAEmail, userBEmail, onClose, onSave }) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasDims, setCanvasDims] = useState({});
  const [activePlaceholderId, setActivePlaceholderId] = useState("userA");

  // Three fixed placeholders: User A, User B, Creator
  const [placeholders, setPlaceholders] = useState([
    {
      id: "userA",
      role: "User A",
      email: userAEmail || "usera@example.com",
      colorClass: "border-blue-500 bg-blue-500/10 text-blue-400 hover:border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
      badgeColor: "bg-blue-600 text-white",
      pageIndex: 0,
      x: 80,
      y: 120,
      w: 180,
      h: 80,
    },
    {
      id: "userB",
      role: "User B",
      email: userBEmail || "userb@example.com",
      colorClass: "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
      badgeColor: "bg-emerald-600 text-white",
      pageIndex: 0,
      x: 80,
      y: 240,
      w: 180,
      h: 80,
    },
    {
      id: "creator",
      role: "Creator (Auto)",
      email: "Auto-applied",
      colorClass: "border-purple-500 bg-purple-500/10 text-purple-400 hover:border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.15)]",
      badgeColor: "bg-purple-600 text-white",
      pageIndex: 0,
      x: 80,
      y: 360,
      w: 180,
      h: 80,
    }
  ]);

  const pdfRef = useRef(null);
  const canvasRefs = useRef({});
  const renderTasks = useRef({});
  const dragging = useRef(null);
  const resizing = useRef(null);

  // Load PDF
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
    return () => {
      Object.values(renderTasks.current).forEach(t => t?.cancel());
    };
  }, [file]);

  // Render pages
  const renderPage = useCallback(async (pageNum) => {
    if (!pdfRef.current) return;
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;
    renderTasks.current[pageNum]?.cancel();
    try {
      const page = await pdfRef.current.getPage(pageNum);
      const vp = page.getViewport({ scale });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.floor(vp.width);
      const cssH = Math.floor(vp.height);
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
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

  // Dragging
  const startDrag = (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    const item = placeholders.find(p => p.id === id);
    if (!item) return;
    setActivePlaceholderId(id);
    dragging.current = { id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y };
    const move = ev => {
      if (!dragging.current) return;
      const { id: activeId, sx, sy, ox, oy } = dragging.current;
      setPlaceholders(p => p.map(item => item.id === activeId
        ? { ...item, x: Math.max(0, ox + ev.clientX - sx), y: Math.max(0, oy + ev.clientY - sy) }
        : item
      ));
    };
    const up = () => {
      setTimeout(() => { dragging.current = null; }, 50);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Resizing
  const startResize = (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    const item = placeholders.find(p => p.id === id);
    if (!item) return;
    setActivePlaceholderId(id);
    resizing.current = { id, sx: e.clientX, sy: e.clientY, ow: item.w, oh: item.h };
    const move = ev => {
      if (!resizing.current) return;
      const { id: activeId, sx, sy, ow, oh } = resizing.current;
      setPlaceholders(p => p.map(item => item.id === activeId
        ? { ...item, w: Math.max(80, ow + ev.clientX - sx), h: Math.max(40, oh + ev.clientY - sy) }
        : item
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

  const handlePageChange = (id, targetPageNum) => {
    setPlaceholders(prev => prev.map(p => p.id === id ? { ...p, pageIndex: targetPageNum - 1 } : p));
    toast.success(`Moved ${placeholders.find(p => p.id === id).role} to Page ${targetPageNum}`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const results = {};
      for (const p of placeholders) {
        const page = await pdfRef.current.getPage(p.pageIndex + 1);
        const vp = page.getViewport({ scale });
        const [pdfX, pdfY] = vp.convertToPdfPoint(p.x, p.y + p.h);
        results[p.id] = {
          role: p.role,
          email: p.id === "creator" ? "auto" : (p.id === "userA" ? userAEmail : userBEmail),
          pageIndex: p.pageIndex,
          pdfX,
          pdfY,
          pdfWidth: p.w / scale,
          pdfHeight: p.h / scale,
          status: p.id === "creator" ? "auto" : "pending"
        };
      }
      await onSave(results);
    } catch (err) {
      toast.error("Failed to map placeholders: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const PlaceholderOverlay = ({ p }) => {
    const isActive = activePlaceholderId === p.id;
    return (
      <div
        style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, pointerEvents: "auto" }}
        onClick={e => { e.stopPropagation(); setActivePlaceholderId(p.id); }}
        className={`group/placeholder rounded-lg border-2 flex flex-col justify-between p-2.5 transition-all duration-150 cursor-pointer ${
          isActive
            ? "border-violet-500 ring-2 ring-violet-500/20 bg-zinc-950/80"
            : p.colorClass
        }`}
      >
        {/* Role Banner */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${p.badgeColor}`}>
            {p.role}
          </span>
          {/* Quick Page Selector */}
          <select
            value={p.pageIndex + 1}
            onClick={e => e.stopPropagation()}
            onChange={e => handlePageChange(p.id, parseInt(e.target.value))}
            className="bg-zinc-800 border border-white/10 text-[9px] font-bold text-white rounded px-1 py-0.5 focus:outline-none"
          >
            {Array.from({ length: numPages }, (_, idx) => (
              <option key={idx + 1} value={idx + 1}>Pg {idx + 1}</option>
            ))}
          </select>
        </div>

        {/* Info */}
        <div className="mt-1">
          <p className="text-white text-xs font-bold truncate">{p.id === "creator" ? "Auto-Apply Template" : p.email}</p>
          <p className="text-zinc-400 text-[9px] mt-0.5 truncate">Drag here to position placeholder</p>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={e => startDrag(p.id, e)}
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 bg-violet-600 hover:bg-violet-500 border-2 border-white rounded-full flex items-center justify-center cursor-move shadow-lg opacity-0 group-hover/placeholder:opacity-100 transition-opacity"
          title="Drag to move"
        >
          <Move size={11} className="text-white" />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={e => startResize(p.id, e)}
          className="absolute -bottom-3 -right-3 w-6 h-6 bg-zinc-700 hover:bg-violet-600 border-2 border-white rounded-full flex items-center justify-center cursor-se-resize shadow-md opacity-0 group-hover/placeholder:opacity-100 transition-opacity"
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
      {/* Top Bar */}
      <div className="shrink-0 h-16 bg-zinc-950 border-b border-white/5 px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-white/5">
            <X size={18} />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center">
              <FileSignature size={15} className="text-violet-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Define Signing Positions</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Drag each signer box to its proper location on the document</p>
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 p-1">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <ZoomOut size={16} />
          </button>
          <span className="text-zinc-400 text-xs font-bold w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Complete Setup */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
        >
          {isSaving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Save size={15} />}
          {isSaving ? "Configuring..." : "Launch Workflow"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 shrink-0 bg-zinc-950 border-r border-white/5 p-5 flex flex-col gap-6 overflow-y-auto hidden md:flex">
          {/* Instructions */}
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={12} className="text-violet-400" />
              <p className="text-violet-300 text-[10px] font-black uppercase tracking-widest">Workflow Guide</p>
            </div>
            <ul className="text-zinc-400 text-[11px] space-y-2 leading-relaxed">
              <li>1. Review positions of all three boxes on the document.</li>
              <li>2. Select page for each signer block using the dropdown.</li>
              <li>3. Resize blocks to fit their designated signature lines.</li>
              <li>4. When ready, click <strong>Launch Workflow</strong> to generate links.</li>
            </ul>
          </div>

          {/* Placeholders List */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Signers & Roles</p>
            {placeholders.map((p) => {
              const isActive = activePlaceholderId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setActivePlaceholderId(p.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isActive
                      ? "border-violet-500 bg-violet-500/5"
                      : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${p.badgeColor}`}>
                      {p.role}
                    </span>
                    <span className="text-zinc-500 text-[10px] font-bold">Page {p.pageIndex + 1}</span>
                  </div>
                  <p className="text-white text-xs font-bold truncate">{p.id === "creator" ? "Auto-Apply (Your saved template)" : p.email}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); startDrag(p.id, e); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-bold border border-white/5 transition-all"
                    >
                      <Move size={10} /> Position
                    </button>
                    <select
                      value={p.pageIndex + 1}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handlePageChange(p.id, parseInt(e.target.value))}
                      className="bg-zinc-800 border border-white/10 text-[10px] font-bold text-white rounded-lg px-2 py-1 focus:outline-none"
                    >
                      {Array.from({ length: numPages }, (_, idx) => (
                        <option key={idx + 1} value={idx + 1}>Page {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PDF Canvas Area */}
        <div className="flex-1 overflow-auto bg-zinc-900/50" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-zinc-800 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-medium">Loading PDF document…</p>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center gap-10">
              {Array.from({ length: numPages }, (_, i) => {
                const pageNum = i + 1;
                const dim = canvasDims[pageNum];
                const pagePlaceholders = placeholders.filter(p => p.pageIndex === i);

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
                    >
                      <canvas ref={el => { canvasRefs.current[pageNum] = el; }} style={{ display: "block" }} />

                      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                        {pagePlaceholders.map(p => (
                          <PlaceholderOverlay key={p.id} p={p} />
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
    </motion.div>,
    document.body
  );
}
