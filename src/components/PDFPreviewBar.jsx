import React, { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Check, Square, CheckSquare, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PDFPreviewBar({ file, onSelectionChange, title = "Select Pages", toolId }) {
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const generateThumbnails = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setTotalPages(pdf.numPages);
        
        const thumbs = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
            thumbs.push(canvas.toDataURL());
          }
        }
        setThumbnails(thumbs);
      } catch (error) {
        console.error("Error generating thumbnails:", error);
      } finally {
        setLoading(false);
      }
    };

    generateThumbnails();
  }, [file]);

  const togglePage = (pageIndex) => {
    const pageNum = pageIndex + 1;
    setSelectedPages((prev) => {
      const newSelection = prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      onSelectionChange(newSelection);
      return newSelection;
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
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Generating Previews...</p>
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
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{selectedPages.length} of {totalPages} pages selected</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-black/50 p-2 rounded-2xl border border-zinc-800/50">
          <button
            onClick={selectAll}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
          >
            Select All
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={deselectAll}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {thumbnails.map((thumb, index) => (
          <motion.div
            key={index}
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => togglePage(index)}
            className={`relative group cursor-pointer transition-all duration-300 ${
              selectedPages.includes(index + 1)
                ? "ring-4 ring-red-500 ring-offset-4 ring-offset-black"
                : "hover:ring-2 hover:ring-zinc-700 hover:ring-offset-2 hover:ring-offset-black"
            } rounded-2xl overflow-hidden bg-black aspect-[3/4] shadow-2xl`}
          >
            <img src={thumb} alt={`Page ${index + 1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute top-3 right-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                selectedPages.includes(index + 1)
                  ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/50"
                  : "bg-black/50 text-white/50 backdrop-blur-md border border-white/10"
              }`}>
                {selectedPages.includes(index + 1) ? <CheckSquare size={18} /> : <Square size={18} />}
              </div>
            </div>

            <div className="absolute bottom-3 left-3">
              <span className="px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                Page {index + 1}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
