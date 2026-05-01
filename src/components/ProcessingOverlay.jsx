import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Loader2, FileText, CheckCircle2 } from "lucide-react";

export default function ProcessingOverlay({ status = "Processing...", progress }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6"
      >
        <div className="max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20 }}
            className="relative mb-12"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent animate-pulse" />
              <Loader2 className="text-white animate-spin" size={48} />
              
              {/* Floating particles */}
              <div className="absolute top-4 left-4 w-2 h-2 bg-white rounded-full blur-[1px] animate-bounce" />
              <div className="absolute bottom-6 right-8 w-1.5 h-1.5 bg-zinc-400 rounded-full blur-[1px] animate-bounce delay-300" />
              <div className="absolute top-1/2 right-4 w-1 h-1 bg-zinc-600 rounded-full blur-[1px] animate-bounce delay-700" />
            </div>
            
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-2 border-dashed border-zinc-800 rounded-[50px] -m-4"
            />
          </motion.div>

          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight uppercase">
            {status}
          </h2>
          <p className="text-zinc-400 text-sm md:text-base mb-12 font-medium max-w-xs mx-auto leading-relaxed">
            We're using high-performance algorithms to process your document. Please don't close this window.
          </p>

          <div className="relative h-4 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-white via-zinc-300 to-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            />
            
            {/* Progress shine */}
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
            />
          </div>
          
          <div className="flex justify-between mt-4 px-2">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Progress</span>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{progress}%</span>
          </div>

          <div className="mt-16 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${progress > 30 ? "bg-white/20 text-white" : "bg-zinc-900 text-zinc-700"}`}>
                <FileText size={20} />
              </div>
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Upload</span>
            </div>
            <div className="w-8 h-px bg-zinc-800" />
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${progress > 60 ? "bg-white/20 text-white" : "bg-zinc-900 text-zinc-700"}`}>
                <Sparkles size={20} />
              </div>
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">AI Engine</span>
            </div>
            <div className="w-8 h-px bg-zinc-800" />
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${progress === 100 ? "bg-white/20 text-white" : "bg-zinc-900 text-zinc-700"}`}>
                <CheckCircle2 size={20} />
              </div>
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Finish</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
