import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, X, Check, RefreshCw, Zap, CameraOff, Sparkles, ChevronLeft, ChevronRight, Trash2, CheckCheck, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function CameraScanner({ onPhotosCaptured, onCancel }) {
  const [stream, setStream] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]); // array of dataUrl
  const [previewImage, setPreviewImage] = useState(null);   // dataUrl for full preview
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stripIndex, setStripIndex] = useState(0); // scroll index of thumbnail strip

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stripRef = useRef(null);

  // ---------- camera lifecycle ----------
  const startCamera = useCallback(async () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      setStream(newStream);
      setIsCameraReady(false);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // ---------- flash toggle ----------
  useEffect(() => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack?.getCapabilities?.()?.torch !== undefined) {
      videoTrack.applyConstraints({ advanced: [{ torch: isFlashOn }] }).catch(() => {});
    }
  }, [isFlashOn, stream]);

  // ---------- capture ----------
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (facingMode === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImages((prev) => {
      const next = [...prev, dataUrl];
      // auto-scroll strip to end
      setTimeout(() => {
        if (stripRef.current) {
          stripRef.current.scrollLeft = stripRef.current.scrollWidth;
        }
      }, 50);
      return next;
    });

    // Brief flash animation
    setTimeout(() => setIsCapturing(false), 150);
    toast.success(`Photo ${capturedImages.length + 1} captured!`, { duration: 800 });
  }, [isCameraReady, facingMode, capturedImages.length]);

  // ---------- delete a photo ----------
  const deletePhoto = (idx) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== idx));
    if (previewImage === capturedImages[idx]) setPreviewImage(null);
  };

  // ---------- confirm all ----------
  const handleConfirmAll = async () => {
    if (capturedImages.length === 0) return;

    // Convert all dataUrls to File objects
    const files = await Promise.all(
      capturedImages.map(async (dataUrl, i) => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], `scan_${Date.now()}_${i + 1}.jpg`, { type: "image/jpeg" });
      })
    );

    onPhotosCaptured(files);
  };

  const STRIP_VISIBLE = 5;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
    >
      {/* ─── Header ─── */}
      <div className="absolute top-0 left-0 w-full z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onCancel}
          className="w-11 h-11 bg-white/10 backdrop-blur-xl border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all"
        >
          <X size={22} />
        </button>

        {/* Photo count badge */}
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2">
          <ImageIcon size={14} className="text-white" />
          <span className="text-white font-black text-sm">
            {capturedImages.length} / 200+
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFlashOn(!isFlashOn)}
            className={`w-11 h-11 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center transition-all ${
              isFlashOn ? "bg-yellow-400 text-black shadow-xl shadow-yellow-500/30" : "bg-white/10 text-white"
            }`}
          >
            <Zap size={18} fill={isFlashOn ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
            className="w-11 h-11 bg-white/10 backdrop-blur-xl border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ─── Viewfinder ─── */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />

        {/* Shutter flash */}
        <AnimatePresence>
          {isCapturing && (
            <motion.div
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Scanner overlay corners */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-10">
          <div className="w-full max-w-sm aspect-[3/4] relative">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white/80 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white/80 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white/80 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white/80 rounded-br-2xl" />
            {/* Scanning line */}
            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute left-2 right-2 h-0.5 bg-white/60 shadow-[0_0_12px_rgba(255,255,255,0.7)]"
            />
          </div>
        </div>

        {/* Camera loading */}
        {!isCameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            <div className="w-14 h-14 border-4 border-white/10 border-t-white rounded-full animate-spin mb-4" />
            <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">
              Initializing Camera…
            </p>
          </div>
        )}
      </div>

      {/* ─── Thumbnail Strip ─── */}
      <AnimatePresence>
        {capturedImages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-black/90 border-t border-white/10 px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Captured Photos ({capturedImages.length})
              </span>
              <button
                onClick={() => setCapturedImages([])}
                className="ml-auto text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            </div>
            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto pb-1 scroll-smooth"
              style={{ scrollbarWidth: "none" }}
            >
              {capturedImages.map((img, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 14 }}
                  className="relative flex-shrink-0 group"
                >
                  <img
                    src={img}
                    alt={`Photo ${i + 1}`}
                    className="w-16 h-20 object-cover rounded-xl border-2 border-white/10 cursor-pointer hover:border-white/50 transition-all"
                    onClick={() => setPreviewImage(img)}
                  />
                  {/* Page number badge */}
                  <div className="absolute bottom-1 left-1 bg-black/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    {i + 1}
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => deletePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={10} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bottom Controls ─── */}
      <div className="bg-black h-36 md:h-44 flex items-center justify-between px-8 md:px-14">
        {/* Left: Done / Cancel */}
        <div className="w-20">
          {capturedImages.length > 0 ? (
            <button
              onClick={handleConfirmAll}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all hover:scale-105">
                <CheckCheck size={24} className="text-white" />
              </div>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                Use {capturedImages.length}
              </span>
            </button>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
              <CameraOff size={20} />
            </div>
          )}
        </div>

        {/* Center: Shutter */}
        <button
          onClick={captureImage}
          disabled={!isCameraReady}
          className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white p-1 transition-all active:scale-90 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-black/10" />
          </div>
        </button>

        {/* Right: Hint */}
        <div className="w-20 flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
            <Sparkles size={20} />
          </div>
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">
            Tap to Scan
          </span>
        </div>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── Full-screen photo preview overlay ─── */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-6"
            onClick={() => setPreviewImage(null)}
          >
            <button
              className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
              onClick={() => setPreviewImage(null)}
            >
              <X size={20} />
            </button>
            <motion.img
              src={previewImage}
              alt="Preview"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-4 mt-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = capturedImages.indexOf(previewImage);
                  if (idx !== -1) deletePhoto(idx);
                  setPreviewImage(null);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded-full font-bold text-sm hover:bg-red-500/30 transition-all"
              >
                <Trash2 size={16} /> Delete
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-full font-bold text-sm hover:bg-white/20 transition-all"
              >
                Keep
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}
