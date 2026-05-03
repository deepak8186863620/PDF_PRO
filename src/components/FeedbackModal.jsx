import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, X, Send, CheckCircle2 } from "lucide-react";
import { auth, db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function FeedbackModal({ isOpen, onClose }) {
  const [user] = useAuthState(auth);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        rating,
        comment,
        timestamp: Timestamp.now()
      });

      // Send email notification automatically via FormSubmit
      try {
        await fetch("https://formsubmit.co/ajax/deepakprajapati3227@gmail.com", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            _subject: `PDF MASTER Feedback - ${rating}/5 Stars`,
            User_Name: user.displayName || "Anonymous",
            User_Email: user.email || "No email",
            Rating: `${rating} out of 5`,
            Message: comment || "No comments provided",
          })
        });
      } catch (emailError) {
        console.error("Failed to send email notification", emailError);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setRating(0);
        setComment("");
        onClose();
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-gradient-to-b from-[#111111] to-[#0A0D14] border border-white/10 rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            {/* Decorative background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-white/5 blur-[100px] rounded-full pointer-events-none" />

            {isSuccess ? (
              <div className="p-12 text-center flex flex-col items-center gap-6 relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  <CheckCircle2 size={48} />
                </motion.div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tight">Thank You!</h3>
                  <p className="text-zinc-400 font-medium leading-relaxed">Your feedback helps us build the future of document processing.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-8 border-b border-white/5 flex items-center justify-between relative z-10">
                  <h3 className="text-2xl font-black text-white tracking-tight">Send Feedback</h3>
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-all active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-8 relative z-10">
                  <div className="text-center space-y-5">
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-[11px]">How would you rate your experience?</p>
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onMouseEnter={() => setHover(star)}
                          onMouseLeave={() => setHover(0)}
                          onClick={() => setRating(star)}
                          className="p-1 transition-transform active:scale-90"
                        >
                          <Star
                            size={36}
                            className={`transition-all duration-300 ${
                              star <= (hover || rating)
                                ? "fill-white text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] scale-110"
                                : "text-zinc-700/50 hover:text-zinc-600"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      Your Comments <span className="text-zinc-700 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us what you think..."
                      className="w-full h-32 bg-black/50 border border-white/5 rounded-2xl p-5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all resize-none shadow-inner"
                    />
                  </div>

                  <button
                    disabled={rating === 0 || isSubmitting}
                    onClick={handleSubmit}
                    className="w-full bg-white disabled:bg-white/10 text-black disabled:text-white/30 py-4 rounded-full font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all shadow-xl hover:shadow-white/10"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
