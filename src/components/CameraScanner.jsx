import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Check, RefreshCw, Zap, Maximize, Minimize, CameraOff, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function CameraScanner({ onPhotosCaptured, onCancel }) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [isFlashOn, setIsFlashOn] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      // Convert data URL to File
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
          onPhotosCaptured([file]);
        });
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 w-full z-10 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onCancel}
          className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all"
        >
          <X size={24} />
        </button>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsFlashOn(!isFlashOn)}
            className={`w-12 h-12 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center transition-all ${isFlashOn ? "bg-yellow-500 text-black shadow-xl shadow-yellow-500/20" : "bg-white/10 text-white"}`}
          >
            <Zap size={20} fill={isFlashOn ? "currentColor" : "none"} />
          </button>
          <button
            onClick={toggleFacingMode}
            className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Main Viewfinder */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />
            
            {/* Scanner Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-10">
              <div className="w-full max-w-lg aspect-[3/4] relative">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-red-500 rounded-tl-3xl" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-red-500 rounded-tr-3xl" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-red-500 rounded-bl-3xl" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-red-500 rounded-br-3xl" />
                
                {/* Scanning Line */}
                <motion.div
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 w-full h-1 bg-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.5)] blur-[1px]"
                />
              </div>
            </div>
            
            {!isCameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-6" />
                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Initializing Camera...</p>
              </div>
            )}
          </>
        ) : (
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain bg-zinc-900"
          />
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-40 md:h-48 bg-black flex items-center justify-center px-10 relative">
        <AnimatePresence mode="wait">
          {!capturedImage ? (
            <motion.div
              key="capture"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-12"
            >
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                <CameraOff size={24} />
              </div>
              
              <button
                onClick={captureImage}
                className="w-24 h-24 rounded-full border-4 border-white p-1 transition-all active:scale-95 hover:scale-105"
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-2 border-black/10" />
                </div>
              </button>

              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                <Sparkles size={24} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex items-center gap-6 w-full max-w-md"
            >
              <button
                onClick={() => setCapturedImage(null)}
                className="flex-1 py-5 bg-zinc-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
              >
                <RefreshCw size={18} />
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-5 bg-red-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-3"
              >
                <Check size={18} />
                Use Photo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
