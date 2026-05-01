import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image as ImageIcon, File as FileIcon, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function FileUpload({
  files,
  onFilesAdded,
  onFileRemoved,
  accept,
  multiple = false,
}) {
  const onDrop = useCallback(
    (acceptedFiles) => onFilesAdded(acceptedFiles),
    [onFilesAdded]
  );

  const onDropRejected = useCallback((fileRejections) => {
    const reasons = fileRejections.map(r => r.errors.map(e => e.message).join(", "));
    const unique = [...new Set(reasons)];
    if (unique.some(r => r.toLowerCase().includes("file type"))) {
      toast.error("Wrong file type. Please check the accepted formats for this tool.");
    } else {
      toast.error("File rejected: " + unique[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept,
    multiple,
  });

  const getFileIcon = (file) => {
    if (file.type.includes("pdf"))
      return <FileText className="text-white" size={20} />;
    if (file.type.includes("image"))
      return <ImageIcon className="text-white" size={20} />;
    return <FileIcon className="text-zinc-500" size={20} />;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className="relative cursor-pointer select-none group"
      >
        <input {...getInputProps()} />

        {/* Animated border glow when dragging */}
        {isDragActive && (
          <div
            className="absolute -inset-[1px] rounded-2xl pointer-events-none glow-pulse"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6), rgba(161,161,170,0.6))", zIndex: 0 }}
          />
        )}

        <div
          className="relative z-10 rounded-2xl p-8 md:p-10 text-center transition-all duration-300"
          style={{
            background: isDragActive
              ? "rgba(255,255,255,0.06)"
              : "rgba(24,24,27,0.6)",
            border: isDragActive
              ? "2px dashed rgba(255,255,255,0.5)"
              : "2px dashed rgba(255,255,255,0.12)",
          }}
          onMouseEnter={e => {
            if (!isDragActive) {
              (e.currentTarget).style.borderColor = "rgba(255,255,255,0.25)";
              (e.currentTarget).style.background = "rgba(24,24,27,0.8)";
            }
          }}
          onMouseLeave={e => {
            if (!isDragActive) {
              (e.currentTarget).style.borderColor = "rgba(255,255,255,0.12)";
              (e.currentTarget).style.background = "rgba(24,24,27,0.6)";
            }
          }}
        >
          {/* Upload icon */}
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-all duration-400 ${
              isDragActive ? "scale-110 rotate-3" : "group-hover:scale-105"
            }`}
            style={{
              background: isDragActive
                ? "rgba(255,255,255,0.2)"
                : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <Upload
              size={22}
              className={`transition-colors duration-300 ${isDragActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`}
            />
          </div>

          <h3 className="text-lg font-700 text-white mb-2">
            {isDragActive
              ? "Release to upload"
              : files.length > 0
              ? "Add more files"
              : "Upload your files"}
          </h3>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
            {isDragActive
              ? "Drop here to add your files"
              : "Drag & drop files here, or click to browse"}
          </p>

          {/* Accepted types hint */}
          {accept && (
            <p className="mt-3 text-[11px] text-zinc-600 uppercase tracking-widest font-600">
              {Object.values(accept).flat().join("  ·  ")}
            </p>
          )}
        </div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-white" />
                <span className="text-xs font-700 text-zinc-400 uppercase tracking-widest">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); files.forEach((_, i) => onFileRemoved(i)); }}
                className="text-[11px] font-700 text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Clear all
              </button>
            </div>

            {files.map((file, index) => (
              <motion.div
                key={file.name + index}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="group flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200"
                style={{
                  background: "rgba(24,24,27,0.7)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget).style.borderColor = "rgba(255,255,255,0.22)";
                  (e.currentTarget).style.background = "rgba(39,39,42,0.9)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget).style.borderColor = "rgba(255,255,255,0.1)";
                  (e.currentTarget).style.background = "rgba(24,24,27,0.7)";
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {getFileIcon(file)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-white truncate">{file.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onFileRemoved(index); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
