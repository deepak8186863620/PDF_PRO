import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, X, Send, CheckCircle2, MessageSquare, Sparkles } from "lucide-react";
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
            className="relative w-full max-w-5xl bg-gradient-to-br from-[#111111] to-[#0A0D14] border border-white/10 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col md:flex-row"
          >
            {isSuccess ? (
              <div className="w-full p-20 text-center flex flex-col items-center justify-center gap-8 relative z-10 min-h-[500px]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-32 h-32 bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-center text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] rotate-3"
                >
                  <CheckCircle2 size={64} />
                </motion.div>
                <div className="space-y-4 max-w-lg">
                  <h3 className="text-5xl font-black text-white tracking-tight">Thank You!</h3>
                  <p className="text-zinc-400 text-lg font-medium leading-relaxed">Your feedback helps us build the future of document processing. We truly appreciate your time.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Left Side: Hero / Messaging */}
                <div className="hidden md:flex md:w-5/12 bg-black/40 border-r border-white/5 p-12 flex-col justify-between relative overflow-hidden min-h-[600px]">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full pointer-events-none" />
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center mb-10 shadow-xl shadow-white/10">
                      <MessageSquare size={28} />
                    </div>
                    <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 leading-[1.1]">Your Voice <br/><span className="text-zinc-500">Matters.</span></h3>
                    <p className="text-zinc-400 font-medium leading-relaxed text-lg">
                      We read every single piece of feedback. Help us understand what we are doing right and how we can improve PDF MASTER for everyone.
                    </p>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 text-zinc-500 font-bold uppercase tracking-widest text-[11px]">
                      <Sparkles size={16} />
                      <span>Shape the future of documents</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Form */}
                <div className="w-full md:w-7/12 flex flex-col relative">
                  <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-all active:scale-95 z-20"
                  >
                    <X size={24} />
                  </button>

                  <div className="flex-1 p-8 md:p-16 space-y-12 relative z-10 flex flex-col justify-center">
                    <div className="space-y-6">
                      <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">How would you rate your experience?</p>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onMouseEnter={() => setHover(star)}
                            onMouseLeave={() => setHover(0)}
                            onClick={() => setRating(star)}
                            className="p-1 transition-transform active:scale-90"
                          >
                            <Star
                              size={48}
                              className={`transition-all duration-300 ${
                                star <= (hover || rating)
                                  ? "fill-white text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-110"
                                  : "text-zinc-700/50 hover:text-zinc-600"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        Your Comments <span className="text-zinc-700 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What do you love? What could be better?"
                        className="w-full h-40 bg-black/50 border border-white/5 rounded-3xl p-6 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all resize-none shadow-inner text-lg"
                      />
                    </div>

                    <button
                      disabled={rating === 0 || isSubmitting}
                      onClick={handleSubmit}
                      className="w-full bg-white disabled:bg-white/10 text-black disabled:text-white/30 py-5 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all shadow-xl hover:shadow-white/10"
                    >
                      {isSubmitting ? (
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={20} />
                          Submit Feedback
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
