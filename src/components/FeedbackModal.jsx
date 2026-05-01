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
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl"
          >
            {isSuccess ? (
              <div className="p-12 text-center flex flex-col items-center gap-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center text-white"
                >
                  <CheckCircle2 size={40} />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">Thank You!</h3>
                  <p className="text-zinc-400">Your feedback helps us make PDF MASTER better for everyone.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white tracking-tight">Send Feedback</h3>
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-8">
                  <div className="text-center space-y-4">
                    <p className="text-zinc-400 font-medium">How would you rate your experience?</p>
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
                            size={32}
                            className={`transition-colors duration-200 ${
                              star <= (hover || rating)
                                ? "fill-white text-white"
                                : "text-zinc-700"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                      Your Comments (Optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us what you think..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-white transition-colors resize-none"
                    />
                  </div>

                  <button
                    disabled={rating === 0 || isSubmitting}
                    onClick={handleSubmit}
                    className="w-full bg-white disabled:bg-zinc-800 text-black disabled:text-zinc-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
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
