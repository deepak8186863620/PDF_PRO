import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Zap, Crown, ArrowRight, Lock } from "lucide-react";
import { FREE_LIMITS } from "../lib/usePremium";

const TOOL_LABELS = {
  "summarize-pdf": "AI Summarize",
  "chat-pdf": "Chat with PDF",
  "ocr-pdf": "OCR (Text Extraction)",
  "esign-pdf": "E-Sign PDF",
  "smartsign-pro": "SmartSign Pro",
};

export default function UpgradeModal({ isOpen, onClose, toolId, used, limit, onUpgrade }) {
  if (!isOpen) return null;

  const toolName = TOOL_LABELS[toolId] || toolId;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-[10000] p-4"
          >
            <div className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all z-10"
              >
                <X size={16} />
              </button>

              {/* Top gradient accent */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-600/10 to-transparent pointer-events-none" />

              <div className="p-8 pt-10">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center">
                      <Lock size={32} className="text-purple-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center shadow-lg animate-pulse">
                      <Crown size={14} className="text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-800 text-white text-center mb-2 tracking-tight">
                  Free Limit Reached
                </h2>
                <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">
                  You've used all <span className="text-white font-bold">{limit}</span> free{" "}
                  <span className="text-white font-bold">{toolName}</span> uses this month. Upgrade to Pro for unlimited access.
                </p>

                {/* Usage bar */}
                <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-700 text-zinc-300 uppercase tracking-wider">{toolName}</span>
                    <span className="text-xs font-bold text-red-400">{used}/{limit} used</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Benefits preview */}
                <div className="space-y-3 mb-8">
                  {[
                    { icon: Zap, text: "Unlimited AI tool usage" },
                    { icon: Sparkles, text: "Priority processing speed" },
                    { icon: Crown, text: "Pro badge on your profile" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <item.icon size={14} className="text-purple-400" />
                      </div>
                      <span className="text-sm text-zinc-300">{item.text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA buttons */}
                <button
                  onClick={() => { onUpgrade?.(); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] mb-3"
                >
                  <Crown size={18} />
                  Upgrade to Pro — ₹199/mo
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={onClose}
                  className="w-full text-center text-zinc-500 hover:text-zinc-300 text-sm font-600 py-2 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
