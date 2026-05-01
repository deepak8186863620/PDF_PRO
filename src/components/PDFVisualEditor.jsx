import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { X, Save, Type, RotateCw, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MousePointer2, Hand, Square, Circle, Minus, Type as TypeIcon, ScanText, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// Set up worker
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export default function PDFVisualEditor({ file, onClose, onSave }) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState([]);
  const [activeTool, setActiveTool] = useState("select");
  const [isSaving, setIsSaving] = useState(false);
  const [isOCRing, setIsOCRing] = useState({});
  const [editingBox, setEditingBox] = useState(null);
  const [ocrItems, setOcrItems] = useState({});
  const [pageRotations, setPageRotations] = useState({});
  const [deletedPages, setDeletedPages] = useState([]);
  const [pageTextItems, setPageTextItems] = useState({});
  const [editingItemId, setEditingItemId] = useState(null);
  
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const canvasRefs = useRef({});
  const renderTasks = useRef({});

  useEffect(() => {
    const loadPDF = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        
        // Initialize rotations
        const rotations = {};
        for (let i = 1; i <= pdf.numPages; i++) {
          rotations[i] = 0;
        }
        setPageRotations(rotations);
      } catch (error) {
        console.error("Error loading PDF:", error);
        toast.error("Failed to load PDF for editing");
      } finally {
        setLoading(false);
      }
    };

    loadPDF();

    return () => {
      // Cancel all tasks on unmount
      Object.values(renderTasks.current).forEach(task => task?.cancel());
    };
  }, [file]);

  useEffect(() => {
    if (!loading && pdfRef.current) {
      renderAllPages();
    }
  }, [loading, scale, pageRotations, deletedPages]);

  const renderAllPages = async () => {
    if (!pdfRef.current) return;

    for (let i = 1; i <= numPages; i++) {
      if (deletedPages.includes(i)) continue;
      renderPage(i, scale);
    }
  };

  const renderPage = async (pageNum, currentScale) => {
    if (!pdfRef.current) return;
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;

    // Cancel existing render task for this page
    if (renderTasks.current[pageNum]) {
      renderTasks.current[pageNum].cancel();
    }

    try {
      const page = await pdfRef.current.getPage(pageNum);
      const rotation = pageRotations[pageNum] || 0;
      const viewport = page.getViewport({ scale: currentScale, rotation });
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTasks.current[pageNum] = renderTask;

      await renderTask.promise;

      // Extract text content for editing
      const textContent = await page.getTextContent();
      const nativeItems = textContent.items.map((item, idx) => {
        const [tx, ty] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]) * currentScale;
        
        return {
          id: `${pageNum}-${idx}`,
          text: item.str,
          x: tx,
          y: ty - fontSize, // Adjust for top-left origin
          width: item.width * currentScale,
          height: item.height * currentScale,
          fontSize,
          pdfX: item.transform[4],
          pdfY: item.transform[5],
          pdfWidth: item.width,
          pdfHeight: item.height
        };
      });

      // Project OCR items to current viewport
      const currentOcrItems = (ocrItems[pageNum] || []).map((item) => {
        const [tx, ty] = viewport.convertToViewportPoint(item.pdfX, item.pdfY + item.pdfHeight);
        
        // Check if this item has been edited
        const edit = edits.find(e => e.page === pageNum && e.type === "replaceText" && e.x === item.pdfX && e.y === item.pdfY);
        
        return {
          ...item,
          text: edit ? edit.newText : item.text,
          isEdited: !!edit,
          x: tx,
          y: ty,
          width: item.pdfWidth * currentScale,
          height: item.pdfHeight * currentScale,
          fontSize: (item.pdfHeight * 0.8) * currentScale
        };
      });

      // Also check native items for edits
      const finalNativeItems = nativeItems.map(item => {
        const edit = edits.find(e => e.page === pageNum && e.type === "replaceText" && e.x === item.pdfX && e.y === item.pdfY);
        return {
          ...item,
          text: edit ? edit.newText : item.text,
          isEdited: !!edit
        };
      });

      setPageTextItems(prev => ({
        ...prev,
        [pageNum]: [...finalNativeItems, ...currentOcrItems]
      }));
    } catch (error) {
      if (error.name === "RenderingCancelledException") {
        return;
      }
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  };

  const runOCR = async (pageNum) => {
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;

    setIsOCRing(prev => ({ ...prev, [pageNum]: true }));
    try {
      const imageData = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      
      const res = await fetch("/api/ai/ocr-structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: imageData, mimeType: "image/jpeg" })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "OCR request failed");
      }

      const ocrResults = await res.json();
      
      // Get PDF page dimensions to map back to PDF points
      const page = await pdfRef.current.getPage(pageNum);
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      
      const newItems = ocrResults.map((item, idx) => {
        // Map 0-1000 to PDF points (PDF origin is bottom-left)
        const px = (item.x / 1000) * pdfWidth;
        const py = pdfHeight - ((item.y / 1000) * pdfHeight) - ((item.height / 1000) * pdfHeight);
        const pw = (item.width / 1000) * pdfWidth;
        const ph = (item.height / 1000) * pdfHeight;

        return {
          id: `ocr-${pageNum}-${idx}`,
          text: item.text,
          pdfX: px,
          pdfY: py,
          pdfWidth: pw,
          pdfHeight: ph,
          isOCR: true
        };
      });

      setOcrItems(prev => ({
        ...prev,
        [pageNum]: [...(prev[pageNum] || []), ...newItems]
      }));
      
      // Trigger a re-render of the page to project the new OCR items
      renderPage(pageNum, scale);
      
      toast.success(`OCR completed for page ${pageNum}. ${newItems.length} text blocks found.`);
    } catch (error) {
      console.error("OCR error:", error);
      toast.error("Failed to perform OCR on this page.");
    } finally {
      setIsOCRing(prev => ({ ...prev, [pageNum]: false }));
    }
  };

  const handleZoom = (delta) => {
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 3.0));
  };

  const rotatePage = (pageNum) => {
    setPageRotations(prev => ({
      ...prev,
      [pageNum]: (prev[pageNum] + 90) % 360
    }));
  };

  const deletePage = (pageNum) => {
    if (numPages - deletedPages.length <= 1) {
      toast.error("Cannot delete the last page");
      return;
    }
    setDeletedPages(prev => [...prev, pageNum]);
  };

  const handleSaveEditBox = () => {
    if (!editingBox) return;
    if (editingBox.text) {
      if (editingBox.mode === "add") {
        setEdits([...edits, {
          type: "text",
          page: editingBox.pageNum,
          text: editingBox.text,
          x: editingBox.x,
          y: editingBox.y,
          fontSize: 16,
          color: "#000000"
        }]);
      } else if (editingBox.mode === "edit" && editingBox.text !== editingBox.item?.text) {
        setEdits([...edits, {
          type: "replaceText",
          page: editingBox.pageNum,
          originalText: editingBox.item.text,
          newText: editingBox.text,
          x: editingBox.item.pdfX,
          y: editingBox.item.pdfY,
          width: editingBox.item.pdfWidth,
          height: editingBox.item.pdfHeight,
          fontSize: editingBox.item.fontSize / scale,
          color: "#000000"
        }]);
      }
    }
    setEditingBox(null);
  };

  const handleCanvasClick = (pageNum, e) => {
    if (activeTool !== "text") return;
    
    const canvas = canvasRefs.current[pageNum];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setEditingBox({
      isOpen: true,
      text: "",
      pageNum,
      x,
      y,
      mode: "add",
      position: { top: e.clientY, left: e.clientX }
    });
  };

  const handleTextItemClick = (pageNum, item, e) => {
    e.stopPropagation();
    if (activeTool !== "text") return;

    setEditingBox({
      isOpen: true,
      text: item.text,
      pageNum,
      x: item.pdfX,
      y: item.pdfY,
      mode: "edit",
      item,
      position: { top: e.clientY, left: e.clientX }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const allEdits = [
        ...edits,
        ...Object.entries(pageRotations)
          .filter(([_, rotation]) => rotation !== 0)
          .map(([page, rotation]) => ({ type: "rotate", page: parseInt(page), degrees: rotation })),
        ...deletedPages.map(page => ({ type: "delete", page }))
      ];
      await onSave(allEdits);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex flex-col"
    >
      {/* Header */}
      <div className="h-20 md:h-24 bg-zinc-900/50 border-b border-zinc-800/50 px-6 md:px-10 flex items-center justify-between backdrop-blur-2xl">
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-2xl flex items-center justify-center transition-all"
          >
            <X size={24} />
          </button>
          <div className="h-8 w-px bg-zinc-800 hidden md:block" />
          <div className="hidden md:block">
            <h3 className="text-xl font-black text-white tracking-tight">Visual PDF Editor</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Editing: {file.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 bg-black/50 p-1.5 md:p-2 rounded-2xl md:rounded-3xl border border-zinc-800/50">
          <button
            onClick={() => setActiveTool("select")}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${activeTool === "select" ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
          >
            <MousePointer2 size={20} />
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${activeTool === "text" ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
          >
            <TypeIcon size={20} />
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <button
            onClick={() => handleZoom(0.1)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={() => handleZoom(-0.1)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <ZoomOut size={20} />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl md:rounded-3xl font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-xl shadow-white/10 hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
          <Save size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-72 bg-zinc-900/30 border-b md:border-b-0 md:border-r border-zinc-800/50 p-6 flex flex-col gap-8">
          <div>
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Document Info</h4>
            <div className="bg-black/50 p-4 rounded-2xl border border-zinc-800/50">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Total Pages</p>
                <p className="text-sm font-black text-white">{numPages}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Visible Pages</p>
                <p className="text-sm font-black text-white">{numPages - deletedPages.length}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Active Edits ({edits.length + Object.values(pageRotations).filter(r => r !== 0).length + deletedPages.length})</h4>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {edits.length === 0 && Object.values(pageRotations).filter(r => r !== 0).length === 0 && deletedPages.length === 0 ? (
                <div className="text-center py-12 bg-black/30 border border-dashed border-zinc-800 rounded-2xl">
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">No edits yet</p>
                </div>
              ) : (
                <>
                  {deletedPages.map((page) => (
                    <div key={`del-${page}`} className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center">
                          <Trash2 size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Delete Page {page}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDeletedPages(deletedPages.filter(p => p !== page))}
                        className="w-8 h-8 text-zinc-600 hover:text-white transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {Object.entries(pageRotations).filter(([_, r]) => r !== 0).map(([page, rotation]) => (
                    <div key={`rot-${page}`} className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-2xl group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500/20 text-green-500 rounded-lg flex items-center justify-center">
                          <RotateCw size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Rotate Page {page}</p>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{rotation}° Clockwise</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPageRotations({ ...pageRotations, [parseInt(page)]: 0 })}
                        className="w-8 h-8 text-zinc-600 hover:text-white transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {edits.map((edit, idx) => (
                    <div key={`edit-${idx}`} className="flex items-center justify-between p-4 bg-black/50 border border-zinc-800 rounded-2xl group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center">
                          <Type size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[120px]">{edit.text}</p>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Page {edit.page}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEdits(edits.filter((_, i) => i !== idx))}
                        className="w-8 h-8 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 bg-black overflow-auto p-10 custom-scrollbar" ref={containerRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Preparing Editor...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-10">
              {Array.from({ length: numPages }).map((_, i) => {
                const pageNum = i + 1;
                if (deletedPages.includes(pageNum)) return null;
                
                return (
                  <div key={pageNum} className="relative group">
                    {/* Page Header/Actions */}
                    <div className="absolute -left-16 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => runOCR(pageNum)}
                        disabled={isOCRing[pageNum]}
                        className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl disabled:opacity-50"
                        title="Run OCR to make text editable"
                      >
                        {isOCRing[pageNum] ? <Loader2 size={18} className="animate-spin" /> : <ScanText size={18} />}
                      </button>
                      <button
                        onClick={() => rotatePage(pageNum)}
                        className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-green-500 rounded-xl flex items-center justify-center transition-all shadow-xl"
                        title="Rotate Page"
                      >
                        <RotateCw size={18} />
                      </button>
                      <button
                        onClick={() => deletePage(pageNum)}
                        className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-500 rounded-xl flex items-center justify-center transition-all shadow-xl"
                        title="Delete Page"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white">
                      <canvas 
                        ref={(el) => { canvasRefs.current[pageNum] = el; }} 
                        className={`max-w-full h-auto ${activeTool === "text" ? "cursor-crosshair" : "cursor-default"}`}
                        onClick={(e) => handleCanvasClick(pageNum, e)}
                      />
                      
                      {/* Overlay for edits and existing text */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Existing Text Layer (Interactive) */}
                        <div className="absolute inset-0">
                          {pageTextItems[pageNum]?.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                position: "absolute",
                                left: `${item.x}px`,
                                top: `${item.y}px`,
                                width: `${item.width}px`,
                                height: `${item.height || item.fontSize}px`,
                                fontSize: `${item.fontSize}px`,
                                pointerEvents: "auto",
                                cursor: activeTool === "text" ? "text" : "default",
                                opacity: 0, // Keep it transparent but clickable
                              }}
                              className={`hover:bg-white/10 hover:opacity-100 border border-transparent hover:border-white/30 transition-all ${item.isEdited ? "!opacity-100 !bg-white/5 !border-white/20" : ""}`}
                              onClick={(e) => handleTextItemClick(pageNum, item, e)}
                              title={item.text}
                            >
                              {item.isEdited && (
                                <span className="absolute inset-0 flex items-center px-1 text-black bg-white/80 backdrop-blur-sm whitespace-nowrap overflow-hidden">
                                  {item.text}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {edits.filter(e => e.page === pageNum && e.type === "text").map((edit, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: "absolute",
                              left: `${edit.x}%`,
                              top: `${edit.y}%`,
                              fontSize: `${edit.fontSize * scale}px`,
                              color: edit.color,
                              fontWeight: "bold",
                              pointerEvents: "auto",
                              transform: "translate(-50%, -50%)"
                            }}
                            className="border border-transparent hover:border-white p-1 rounded whitespace-nowrap"
                          >
                            {edit.text}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Page {pageNum}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Inline Text Input */}
      {editingBox && editingBox.isOpen && (
        <div 
          className="fixed z-50 bg-zinc-900 border border-zinc-800 p-2 rounded-xl shadow-2xl flex items-center gap-2"
          style={{ top: editingBox.position?.top, left: editingBox.position?.left }}
        >
          <input
            autoFocus
            type="text"
            value={editingBox.text}
            onChange={(e) => setEditingBox({ ...editingBox, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEditBox();
              if (e.key === 'Escape') setEditingBox(null);
            }}
            className="bg-black text-white px-3 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-white text-sm"
            placeholder="Enter text..."
          />
          <button onClick={handleSaveEditBox} className="w-8 h-8 bg-white hover:bg-zinc-200 text-black rounded-lg flex items-center justify-center transition-all">
            <Check size={16} />
          </button>
          <button onClick={() => setEditingBox(null)} className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition-all">
            <X size={16} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
