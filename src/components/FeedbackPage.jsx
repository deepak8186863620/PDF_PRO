import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, Send, CheckCircle2, MessageSquare, Sparkles, Bug, Lightbulb, MessageCircle } from "lucide-react";
import { auth, db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { toast } from "sonner";

export default function FeedbackPage() {
  const [user] = useAuthState(auth);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const categories = [
    { id: "general", label: "General Feedback", icon: MessageCircle },
    { id: "bug", label: "Report a Bug", icon: Bug },
    { id: "feature", label: "Feature Request", icon: Lightbulb },
  ];

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Authentication Required", { description: "Please log in to submit feedback." });
      return;
    }
    if (!title.trim() || !comment.trim()) {
      toast.error("Incomplete Form", { description: "Please provide a title and details." });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        category,
        title,
        rating,
        comment,
        timestamp: Timestamp.now()
      });

      try {
        await fetch("https://formsubmit.co/ajax/deepakprajapati3227@gmail.com", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            _subject: `PDF MASTER Feedback - ${category.toUpperCase()} - ${title}`,
            User_Name: user.displayName || "Anonymous",
            User_Email: user.email || "No email",
            Category: category,
            Rating: rating > 0 ? `${rating} out of 5` : "N/A",
            Title: title,
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
        setTitle("");
        setComment("");
        setCategory("general");
      }, 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 min-h-[100dvh]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-bold text-white mb-8 uppercase tracking-widest"
          >
            <Sparkles size={16} />
            <span>Help Us Improve</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-[0.9]"
          >
            WE VALUE YOUR <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-400 to-zinc-500">
              FEEDBACK
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          >
            Whether you've found a bug, have a brilliant idea for a new feature, or just want to tell us what you love, we're all ears.
          </motion.p>
        </div>

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative max-w-4xl mx-auto bg-gradient-to-br from-[#111111] to-[#0A0D14] border border-white/10 rounded-[48px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)]"
        >
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-zinc-800/10 blur-[120px] rounded-full pointer-events-none" />

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-20 text-center flex flex-col items-center justify-center gap-8 min-h-[600px] relative z-10"
              >
                <div className="w-32 h-32 bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-center text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] rotate-3">
                  <CheckCircle2 size={64} />
                </div>
                <div className="space-y-4 max-w-lg">
                  <h3 className="text-5xl font-black text-white tracking-tight">Thank You!</h3>
                  <p className="text-zinc-400 text-lg font-medium leading-relaxed">
                    Your feedback has been successfully submitted. We review every submission to make PDF MASTER better for everyone.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 md:p-16 space-y-12 relative z-10"
              >
                {/* Category Selection */}
                <div className="space-y-6">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                    What is this regarding?
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-center gap-4 p-6 rounded-3xl border transition-all duration-300 ${
                          category === cat.id
                            ? "bg-white/10 border-white text-white shadow-lg scale-[1.02]"
                            : "bg-black/40 border-white/5 text-zinc-400 hover:bg-black/60 hover:border-white/20"
                        }`}
                      >
                        <cat.icon size={28} />
                        <span className="font-bold tracking-tight text-sm">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Star Rating (Optional) */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                      Rate your experience
                    </label>
                    <span className="text-zinc-700 text-xs font-normal">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => setRating(star)}
                        className="p-2 transition-transform active:scale-90"
                      >
                        <Star
                          size={40}
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

                {/* Title */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                    Title / Subject
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Briefly summarize your feedback..."
                    className="w-full bg-black/50 border border-white/5 rounded-2xl p-5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all shadow-inner text-lg"
                  />
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                    Details
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Please provide as much detail as possible..."
                    className="w-full h-48 bg-black/50 border border-white/5 rounded-3xl p-6 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all resize-none shadow-inner text-lg"
                  />
                </div>

                {/* Submit */}
                <div className="pt-6 border-t border-white/5">
                  <button
                    disabled={isSubmitting || !title.trim() || !comment.trim()}
                    onClick={handleSubmit}
                    className="w-full md:w-auto md:px-16 bg-white disabled:bg-white/10 text-black disabled:text-white/30 py-5 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all shadow-xl hover:shadow-white/10 ml-auto"
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
