import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { X, Save, Type, RotateCw, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MousePointer2, Hand, Square, Circle, Minus, Type as TypeIcon, ScanText, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// Set up worker — matches installed pdfjs-dist version
if (typeof window !== "undefined") {
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

      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height =  Math.floor(viewport.height) + "px";

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : null;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
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
      
      // Get canvas pixel dimensions to normalize coordinates
      const canvasEl = canvasRefs.current[pageNum];
      const canvasW = canvasEl.width;   // canvas pixel width
      const canvasH = canvasEl.height;  // canvas pixel height

      // Get PDF page dimensions in points
      const page = await pdfRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const { width: pdfWidth, height: pdfHeight } = viewport;
      
      const newItems = ocrResults.map((item, idx) => {
        // Vision API returns pixel coords on the rendered canvas image.
        // Normalize to [0..1] then scale to PDF points (origin bottom-left).
        const px = (item.x / canvasW) * pdfWidth;
        const py = pdfHeight - ((item.y / canvasH) * pdfHeight) - ((item.height / canvasH) * pdfHeight);
        const pw = (item.width / canvasW) * pdfWidth;
        const ph = (item.height / canvasH) * pdfHeight;

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
      toast.error(`OCR Error: ${error.message}`);
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

  const handleEditChange = (text) => {
    if (!editingBox) return;
    setEditingBox(prev => ({ ...prev, text }));
    
    // Real-time update for "edit" mode (replacing existing text)
    if (editingBox.mode === "edit") {
      setEdits(prev => {
        const otherEdits = prev.filter(e => !(e.page === editingBox.pageNum && e.type === "replaceText" && e.x === editingBox.item.pdfX && e.y === editingBox.item.pdfY));
        if (!text) return otherEdits; // If empty, effectively removes the edit
        return [...otherEdits, {
          type: "replaceText",
          page: editingBox.pageNum,
          originalText: editingBox.item.text,
          newText: text,
          x: editingBox.item.pdfX,
          y: editingBox.item.pdfY,
          width: editingBox.item.pdfWidth,
          height: editingBox.item.pdfHeight,
          fontSize: (editingBox.item.fontSize || 12) / scale,
          color: "#000000"
        }];
      });
    } 
    // Real-time update for "add" mode (new text overlay)
    else if (editingBox.mode === "add" && editingBox.editId) {
      setEdits(prev => prev.map(e => e.id === editingBox.editId ? { ...e, text } : e));
    }
  };

  const handleSaveEditBox = () => {
    if (!editingBox) return;
    
    // Finalize the "add" edit if it wasn't empty
    if (editingBox.mode === "add" && !editingBox.editId && editingBox.text.trim()) {
      const id = uuidv4();
      setEdits([...edits, {
        id,
        type: "text",
        page: editingBox.pageNum,
        text: editingBox.text,
        x: editingBox.x,
        y: editingBox.y,
        fontSize: 16,
        color: "#000000"
      }]);
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
    if (activeTool !== "text" && activeTool !== "select") return;

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
      className="fixed inset-0 z-[150] bg-[#050505] flex flex-col"
    >
      {/* Header */}
      <div className="h-20 md:h-24 bg-zinc-950 border-b border-white/5 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="w-12 h-12 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl flex items-center justify-center transition-all border border-white/5"
          >
            <X size={24} />
          </button>
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          <div className="hidden md:block">
            <h3 className="text-xl font-black text-white tracking-tight">Visual PDF Editor</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Docx-style precision mode</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 bg-white/5 p-1.5 md:p-2 rounded-2xl md:rounded-3xl border border-white/10">
          <button
            onClick={() => setActiveTool("select")}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${activeTool === "select" ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
          >
            <MousePointer2 size={20} />
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${activeTool === "text" ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
          >
            <TypeIcon size={20} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button
            onClick={() => handleZoom(0.1)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={() => handleZoom(-0.1)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <ZoomOut size={20} />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 bg-[#E5322D] hover:bg-[#D42B27] text-white rounded-2xl md:rounded-3xl font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-xl shadow-red-500/10 hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
          <Save size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-zinc-950 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col gap-8">
          <div>
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Document Navigator</h4>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
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

          <div className="flex-1 overflow-hidden flex flex-col">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">History Log ({edits.length})</h4>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {edits.length === 0 && Object.values(pageRotations).filter(r => r !== 0).length === 0 && deletedPages.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">No changes tracked</p>
                </div>
              ) : (
                <>
                  {deletedPages.map((page) => (
                    <div key={`del-${page}`} className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-2xl group animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center">
                          <Trash2 size={14} />
                        </div>
                        <p className="text-xs font-bold text-white">Delete Page {page}</p>
                      </div>
                      <button onClick={() => setDeletedPages(deletedPages.filter(p => p !== page))} className="text-zinc-600 hover:text-white transition-all"><X size={14} /></button>
                    </div>
                  ))}
                  {Object.entries(pageRotations).filter(([_, r]) => r !== 0).map(([page, rotation]) => (
                    <div key={`rot-${page}`} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center"><RotateCw size={14} /></div>
                        <div>
                          <p className="text-xs font-bold text-white">Rotate Page {page}</p>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{rotation}° Clockwise</p>
                        </div>
                      </div>
                      <button onClick={() => setPageRotations({ ...pageRotations, [parseInt(page)]: 0 })} className="text-zinc-600 hover:text-white transition-all"><X size={14} /></button>
                    </div>
                  ))}
                  {edits.map((edit, idx) => (
                    <div key={edit.id || idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center"><Type size={14} /></div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate w-32">{edit.text || edit.newText}</p>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Page {edit.page} • {edit.type === "replaceText" ? "MODIFIED" : "ADDED"}</p>
                        </div>
                      </div>
                      <button onClick={() => setEdits(edits.filter((_, i) => i !== idx))} className="w-8 h-8 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 bg-[#0a0a0a] overflow-auto p-4 md:p-10 custom-scrollbar" ref={containerRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 border-4 border-white/5 border-t-white rounded-full animate-spin mb-6" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Assembling Workspace...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-10">
              {Array.from({ length: numPages }).map((_, i) => {
                const pageNum = i + 1;
                if (deletedPages.includes(pageNum)) return null;
                
                return (
                  <div key={pageNum} className="relative group">

                    {/* Page Actions Overlay */}
                    <div className="absolute top-2 right-2 md:-left-12 md:right-auto md:top-0 flex md:flex-col gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-10">
                      <button onClick={() => runOCR(pageNum)} disabled={isOCRing[pageNum]} className="w-8 h-8 md:w-9 md:h-9 bg-zinc-900/80 md:bg-zinc-900 backdrop-blur-md md:backdrop-blur-none border border-white/10 text-zinc-400 hover:text-white rounded-lg md:rounded-xl flex items-center justify-center transition-all shadow-xl disabled:opacity-50" title="Make Text Editable">
                        {isOCRing[pageNum] ? <Loader2 size={16} className="animate-spin w-4 h-4" /> : <ScanText size={16} className="w-4 h-4 md:w-4 md:h-4" />}
                      </button>
                      <button onClick={() => rotatePage(pageNum)} className="w-8 h-8 md:w-9 md:h-9 bg-zinc-900/80 md:bg-zinc-900 backdrop-blur-md md:backdrop-blur-none border border-white/10 text-zinc-400 hover:text-white rounded-lg md:rounded-xl flex items-center justify-center transition-all shadow-xl" title="Rotate Page">
                        <RotateCw size={16} className="w-4 h-4 md:w-4 md:h-4" />
                      </button>
                      <button onClick={() => deletePage(pageNum)} className="w-8 h-8 md:w-9 md:h-9 bg-zinc-900/80 md:bg-zinc-900 backdrop-blur-md md:backdrop-blur-none border border-white/10 text-zinc-400 hover:text-red-500 rounded-lg md:rounded-xl flex items-center justify-center transition-all shadow-xl" title="Delete Page">
                        <Trash2 size={16} className="w-4 h-4 md:w-4 md:h-4" />
                      </button>
                    </div>

                    <div className="relative shadow-2xl bg-white">
                      <canvas 
                        ref={(el) => { canvasRefs.current[pageNum] = el; }} 
                        className={`max-w-full h-auto ${activeTool === "text" ? "cursor-text" : "cursor-default"}`}
                        onClick={(e) => handleCanvasClick(pageNum, e)}
                      />
                      
                      {/* Interaction Layer */}
                      <div className="absolute inset-0 select-none">
                        {/* Text Items Layer */}
                        <div className="absolute inset-0 overflow-hidden">
                          {pageTextItems[pageNum]?.map((item) => {
                            const edit = edits.find(e => e.page === pageNum && e.type === "replaceText" && e.x === item.pdfX && e.y === item.pdfY);
                            return (
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
                                }}
                                className={`group/item border border-transparent hover:border-red-500/30 hover:bg-red-500/5 transition-all cursor-text ${edit ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
                                onClick={(e) => handleTextItemClick(pageNum, item, e)}
                              >
                                {edit ? (
                                  <div className="absolute inset-0 bg-white text-black font-medium leading-none flex items-center whitespace-nowrap overflow-visible z-10">
                                    {edit.newText}
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/5 text-transparent pointer-events-none">
                                    {item.text}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Manually Added Text Layer */}
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
                            className="border border-dashed border-red-500/50 hover:bg-red-500/5 px-2 py-1 rounded cursor-move"
                          >
                            {edit.text}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <div className="h-px w-8 bg-white/5" />
                      <p className="text-[10px] font-black text-zinc-800 uppercase tracking-widest">Page {pageNum}</p>
                      <div className="h-px w-8 bg-white/5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Inline Floating Editor Bar */}
      <AnimatePresence>
        {editingBox && editingBox.isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-[90%] md:w-[600px] bg-zinc-950 border border-white/10 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row items-stretch"
          >
            <div className="flex-1 p-6 flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
                {editingBox.mode === "edit" ? "Edit Existing Text" : "Add New Text Block"}
              </label>
              <textarea
                autoFocus
                rows={2}
                value={editingBox.text}
                onChange={(e) => handleEditChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEditBox();
                  }
                  if (e.key === 'Escape') setEditingBox(null);
                }}
                className="w-full bg-transparent text-white text-xl font-bold focus:outline-none placeholder:text-zinc-800 resize-none leading-tight"
                placeholder="Start typing..."
              />
            </div>
            <div className="bg-white/5 md:w-32 p-4 md:p-6 flex md:flex-col items-center justify-center gap-3 border-t md:border-t-0 md:border-l border-white/5">
              <button 
                onClick={handleSaveEditBox} 
                className="flex-1 md:flex-none w-full h-12 md:h-full bg-white hover:bg-zinc-200 text-black rounded-2xl flex items-center justify-center transition-all group"
              >
                <Check size={24} className="group-hover:scale-110 transition-transform" />
              </button>
              <button 
                onClick={() => setEditingBox(null)} 
                className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-2xl flex items-center justify-center transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
