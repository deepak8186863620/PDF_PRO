import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, Send, CheckCircle2, MessageSquare, Bug, Lightbulb, Heart } from "lucide-react";
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
    { id: "general", label: "General Feedback", icon: Heart },
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
      <div className="max-w-7xl mx-auto">
        
        {/* Hero Section */}
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-bold text-white mb-8 uppercase tracking-widest"
          >
            <MessageSquare size={16} />
            <span>Help Us Improve</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-[0.9]"
          >
            YOUR VOICE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-400 to-zinc-500">
              MATTERS
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-400 text-xl max-w-2xl mx-auto leading-relaxed"
          >
            PDF MASTER was built for you. Whether you've found a bug, have a brilliant idea for a new feature, or just want to tell us what you love, we're all ears.
          </motion.p>
        </div>

        {/* Info Grid Section (Mirrors AboutUs Mission/Values) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {[
            {
              icon: Bug,
              title: "Bug Reports",
              desc: "Found an issue? Let us know. We prioritize squashing bugs to ensure a smooth, error-free experience."
            },
            {
              icon: Lightbulb,
              title: "Feature Requests",
              desc: "Missing a tool? Suggest it! Some of our best features started as ideas from our incredible community."
            },
            {
              icon: Heart,
              title: "General Thoughts",
              desc: "Love the app? Or think we can do better? Your honest reviews keep us motivated and pointed in the right direction."
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/50 rounded-[32px] hover:border-zinc-700/50 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-500">
                <item.icon size={28} />
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-tight">{item.title}</h3>
              <p className="text-zinc-500 leading-relaxed font-medium">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Feedback Form Section (Mirrors AboutUs Contact CTA) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="p-8 md:p-16 bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-[48px] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full" />
          
          <div className="relative z-10 max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-20 text-center flex flex-col items-center justify-center gap-8 min-h-[500px]"
                >
                  <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-center text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] rotate-3">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="space-y-4 max-w-lg mx-auto">
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
                  className="space-y-12"
                >
                  <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-white mb-6 tracking-tight">Submit your feedback</h2>
                    <p className="text-zinc-400 text-lg max-w-xl mx-auto">
                      Fill out the form below to let us know what's on your mind.
                    </p>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-6">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center block">
                      What is this regarding?
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={`flex flex-col items-center justify-center gap-4 p-6 rounded-3xl border transition-all duration-300 ${
                            category === cat.id
                              ? "bg-white text-black border-white shadow-lg shadow-white/10 scale-[1.02]"
                              : "bg-black border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700"
                          }`}
                        >
                          <cat.icon size={28} />
                          <span className="font-bold tracking-tight text-sm">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Star Rating (Optional) */}
                  <div className="flex flex-col items-center justify-center space-y-6 py-6 border-y border-zinc-800">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
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

                  {/* Title & Details */}
                  <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        Title / Subject
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Briefly summarize your feedback..."
                        className="w-full bg-black border border-zinc-800 rounded-2xl p-5 text-white placeholder:text-zinc-700 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-lg"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        Details
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Please provide as much detail as possible..."
                        className="w-full h-48 bg-black border border-zinc-800 rounded-3xl p-6 text-white placeholder:text-zinc-700 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all resize-none text-lg"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="pt-8 flex justify-center">
                    <button
                      disabled={isSubmitting || !title.trim() || !comment.trim()}
                      onClick={handleSubmit}
                      className="w-full md:w-auto md:px-16 bg-white disabled:bg-zinc-800 text-black disabled:text-zinc-600 py-5 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all shadow-xl"
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
          </div>
        </motion.div>
      </div>
    </div>
  );
}
