import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, Send, CheckCircle2, MessageSquare, Bug, Lightbulb, Heart, Info, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { auth, db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { toast } from "sonner";

export default function FeedbackPage({ theme }) {
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

  const getContextualTips = () => {
    switch (category) {
      case "bug":
        return [
          "Include steps to reproduce the issue.",
          "Mention your browser and operating system.",
          "Describe what you expected to happen vs. what actually happened."
        ];
      case "feature":
        return [
          "Describe the problem this feature would solve.",
          "How would this improve your workflow?",
          "Are there other tools that do this well?"
        ];
      case "general":
      default:
        return [
          "Be specific about what you like or dislike.",
          "Share how long you've been using the platform.",
          "Your honest opinion helps us grow!"
        ];
    }
  };

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
        await fetch("/api/submit-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: user.displayName || "Anonymous",
            userEmail: user.email,
            category,
            rating,
            title,
            comment,
          })
        });
      } catch (emailError) {
        console.error("Failed to trigger email notification", emailError);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setRating(0);
        setTitle("");
        setComment("");
        setCategory("general");
      }, 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLight = theme === "light";

  /* ─── inline style constants (immune to .light overrides) ─── */
  const S = {
    page:        { background: isLight ? "#f8fafc" : "#000000", color: isLight ? "#0f172a" : "#ffffff", transition: "background 0.3s ease" },
    badge:       { background: isLight ? "rgba(15,23,42,0.05)" : "rgba(39,39,42,0.5)", border: isLight ? "1px solid rgba(15,23,42,0.1)" : "1px solid rgba(255,255,255,0.1)", color: isLight ? "#0f172a" : "#ffffff" },
    card:        { background: isLight ? "#ffffff" : "rgba(24,24,27,0.4)", border: isLight ? "1px solid #e2e8f0" : "1px solid #27272a", color: isLight ? "#0f172a" : "#ffffff", boxShadow: isLight ? "0 4px 6px -1px rgb(0 0 0 / 0.1)" : "none" },
    cardHover:   { background: isLight ? "#f1f5f9" : "rgba(24,24,27,0.6)", border: isLight ? "1px solid #cbd5e1" : "1px solid #3f3f46" },
    iconBox:     { background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)", border: isLight ? "1px solid rgba(15,23,42,0.1)" : "1px solid rgba(255,255,255,0.1)", color: isLight ? "#0f172a" : "#ffffff" },
    infoPanel:   { background: isLight ? "#f8fafc" : "rgba(18,18,20,0.7)", border: isLight ? "1px solid #e2e8f0" : "1px solid #27272a" },
    helpBox:     { background: isLight ? "rgba(15,23,42,0.03)" : "rgba(0,0,0,0.5)", border: isLight ? "1px solid #e2e8f0" : "1px solid #27272a" },
    input:       { background: isLight ? "#ffffff" : "#09090b", border: isLight ? "1px solid #cbd5e1" : "1px solid #27272a", color: isLight ? "#0f172a" : "#ffffff" },
    inputFocus:  { border: isLight ? "1px solid #0f172a" : "1px solid #ffffff" },
    divider:     { borderTop: isLight ? "1px solid rgba(15,23,42,0.1)" : "1px solid rgba(255,255,255,0.06)" },
    faqCard:     { background: isLight ? "#ffffff" : "rgba(24,24,27,0.35)", border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(63,63,70,0.5)", color: isLight ? "#0f172a" : "#ffffff", boxShadow: isLight ? "0 1px 3px 0 rgb(0 0 0 / 0.1)" : "none" },
    statsRow:    { background: isLight ? "#f1f5f9" : "rgba(39,39,42,0.3)", border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(63,63,70,0.4)", borderRadius: "24px", overflow: "hidden" },
    statCell:    { background: isLight ? "#ffffff" : "rgba(24,24,27,0.5)" },
    tagPill:     { background: isLight ? "#ffffff" : "rgba(24,24,27,0.5)", border: isLight ? "1px solid #e2e8f0" : "1px solid #27272a", color: isLight ? "#475569" : "#a1a1aa" },
    cta:         { background: isLight ? "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)" : "linear-gradient(135deg, #111111 0%, #000000 50%, #111111 100%)", border: isLight ? "1px solid #e2e8f0" : "1px solid #27272a" },
    ctaGlow:     { background: isLight ? "radial-gradient(ellipse, rgba(15,23,42,0.04) 0%, transparent 70%)" : "radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%)" },
    catActive:   { background: isLight ? "#0f172a" : "#ffffff", color: isLight ? "#ffffff" : "#000000", border: isLight ? "1px solid #0f172a" : "1px solid #ffffff", boxShadow: isLight ? "0 4px 6px -1px rgb(0 0 0 / 0.1)" : "none" },
    catInactive: { background: isLight ? "#ffffff" : "#09090b", color: isLight ? "#64748b" : "#a1a1aa", border: isLight ? "1px solid #e2e8f0" : "1px solid #27272a" },
    btnPrimary:  { background: isLight ? "#0f172a" : "#ffffff", color: isLight ? "#ffffff" : "#000000" },
    btnDisabled: { background: isLight ? "#e2e8f0" : "#27272a", color: isLight ? "#94a3b8" : "#52525b" },
    stepCard:    { background: isLight ? "#ffffff" : "rgba(24,24,27,0.3)", border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(63,63,70,0.5)", borderRadius: "28px", boxShadow: isLight ? "0 4px 6px -1px rgb(0 0 0 / 0.1)" : "none" },
    successBox:  { background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)", border: isLight ? "1px solid rgba(15,23,42,0.1)" : "1px solid rgba(255,255,255,0.12)" },
    textTitle:   { color: isLight ? "#0f172a" : "#ffffff" },
    textMuted:   { color: isLight ? "#64748b" : "#a1a1aa" },
    textLabel:   { color: isLight ? "#475569" : "#71717a" },
    textNormal:  { color: isLight ? "#334155" : "#d4d4d8" },
  };

  return (
    <div className="pt-32 pb-20 px-6 min-h-[100dvh]" style={S.page}>
      <div className="max-w-7xl mx-auto">
        
        {/* Hero Section */}
        <div className="text-center mb-20 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8 uppercase tracking-widest relative z-10"
            style={S.badge}
          >
            <MessageSquare size={16} className="text-inherit" />
            <span>Help Us Build The Future</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight relative z-10" style={S.textTitle}
          >
            Your Feedback Drives <br className="hidden md:block" />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #ffffff 0%, #71717a 100%)" }}
            >
              Our Innovation
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed relative z-10" style={S.textMuted}
          >
            We don't just build software; we build it for you. Every bug reported, feature requested, and opinion shared directly shapes the next version of PageDocx.
          </motion.p>
        </div>

        {/* Process Timeline Section */}
        <div className="mb-24 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight mb-3" style={S.textTitle}>What happens when you submit?</h2>
            <p style={S.textLabel}>A transparent look into our feedback pipeline.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Send, title: "1. We Receive It", desc: "Your feedback is instantly routed to our core development team's dashboard." },
              { icon: ShieldCheck, title: "2. We Review It", desc: "Every single submission is read, categorized, and discussed during our weekly product syncs." },
              { icon: Zap, title: "3. We Take Action", desc: "Critical bugs are hotfixed immediately. Great feature ideas are added to our public roadmap." }
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-[32px] text-center flex flex-col items-center"
                style={S.stepCard}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ ...S.iconBox, ...S.textTitle }}>
                  <step.icon size={24} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={S.textTitle}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={S.textMuted}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Main Content: Form & Info Side-by-Side */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10"
        >
          {/* Left Column: Form */}
          <div className="lg:col-span-8 backdrop-blur-2xl rounded-[40px] p-8 md:p-12" style={S.card}>
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-20 text-center flex flex-col items-center justify-center gap-8 min-h-[400px]"
                >
                  <div className="w-24 h-24 rounded-[32px] flex items-center justify-center drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]" style={{ ...S.successBox, color: '#ffffff' }}>
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="space-y-4 max-w-md mx-auto">
                    <h3 className="text-4xl font-black tracking-tight" style={S.textTitle}>Got it!</h3>
                    <p className="text-lg font-medium leading-relaxed" style={S.textMuted}>
                      Thank you for taking the time to write to us. Your insights are invaluable in making PageDocx better.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-10"
                >
                  <div>
                    <h2 className="text-3xl font-black mb-2 tracking-tight" style={S.textTitle}>Submit Feedback</h2>
                    <p style={S.textMuted}>Please fill out the details below.</p>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-inherit uppercase tracking-widest">
                      Category
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className="flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 text-left"
                          style={category === cat.id ? S.catActive : S.catInactive}
                        >
                          <cat.icon size={20} style={{ color: category === cat.id ? S.catActive.color : S.catInactive.color }} />
                          <span className="font-bold tracking-tight text-sm">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest flex items-center justify-between" style={S.textLabel}>
                      <span>Subject / Title</span>
                      <span className="font-normal" style={S.textLabel}>Keep it brief</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="E.g., Dark mode contrast issue, or Love the new PDF merge tool!"
                      className={`w-full rounded-2xl p-5 focus:outline-none transition-all text-base ${isLight ? "placeholder:text-[#94a3b8]" : "placeholder:text-[#52525b]"}`}
                      style={S.input}
                    />
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-inherit uppercase tracking-widest">
                      Details
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Please describe your experience, issue, or idea in detail..."
                      className={`w-full h-40 rounded-2xl p-5 focus:outline-none transition-all resize-none text-base ${isLight ? "placeholder:text-[#94a3b8]" : "placeholder:text-[#52525b]"}`}
                      style={S.input}
                    />
                  </div>

                  {/* Star Rating & Submit Row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6" style={S.divider}>
                    <div className="flex flex-col space-y-2 w-full sm:w-auto">
                      <label className="text-xs font-bold uppercase tracking-widest" style={S.textLabel}>
                        Rate your experience (Optional)
                      </label>
                      <div className="flex items-center gap-1">
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
                              className={`transition-all duration-200 ${
                                star <= (hover || rating)
                                  ? "fill-white text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-110"
                                  : "text-[#52525b] hover:text-zinc-600"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={isSubmitting || !title.trim() || !comment.trim()}
                      onClick={handleSubmit}
                      className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:-translate-y-1 active:translate-y-0 transition-all"
                      style={isSubmitting || !title.trim() || !comment.trim() ? S.btnDisabled : S.btnPrimary}
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Submit</span>
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Informative Context Panel */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-[32px] p-8 h-full flex flex-col" style={S.infoPanel}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ ...S.iconBox, ...S.textTitle }}>
                  <Info size={20} />
                </div>
                <h3 className="text-lg font-bold" style={S.textTitle}>Tips for Great Feedback</h3>
              </div>
              
              <p className="text-sm mb-8 leading-relaxed" style={S.textMuted}>
                To help us understand and address your feedback quickly, keep these guidelines in mind based on the category you've selected:
              </p>

              <div className="flex-1">
                <AnimatePresence mode="wait">
                  <motion.ul
                    key={category}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    {getContextualTips().map((tip, i) => (
                      <li key={i} className="flex gap-3 text-sm" style={S.textNormal}>
                        <div className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isLight ? '#94a3b8' : '#71717a' }} />
                        <span className="leading-relaxed">{tip}</span>
                      </li>
                    ))}
                  </motion.ul>
                </AnimatePresence>
              </div>

              <div className="mt-10 p-5 rounded-2xl" style={S.helpBox}>
                <p className="text-xs leading-relaxed text-center" style={S.textLabel}>
                  Need immediate help? Check out our <a href="#" style={S.textTitle} className="underline underline-offset-4 transition-colors">FAQ</a> or <a href="#" style={S.textTitle} className="underline underline-offset-4 transition-colors">Documentation</a> first.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── FAQ Section ── */}
        <div className="mt-28 relative z-10">
          <div className="text-center mb-14">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-xs font-bold uppercase tracking-widest mb-3" style={S.textLabel}
            >
              Common Questions
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-black tracking-tight" style={S.textTitle}
            >
              Frequently Asked Questions
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
            {[
              {
                q: "Do I need to be logged in to submit feedback?",
                a: "Yes. Logging in lets us link your feedback to your account so we can follow up if needed. It also helps us eliminate spam and prioritize genuine user reports."
              },
              {
                q: "How long does it take to get a response?",
                a: "Bug reports are triaged within 24–48 hours. Feature requests are reviewed weekly during our product syncs. We may not reply to every submission, but every one is read."
              },
              {
                q: "Will my idea actually be implemented?",
                a: "Absolutely — if it fits our roadmap and enough users request it! Several of our most-loved features originated directly from user suggestions through this page."
              },
              {
                q: "Can I submit multiple pieces of feedback?",
                a: "Yes, please do! We encourage you to submit separate entries for separate topics so each one can be tracked and resolved individually."
              },
              {
                q: "What information helps most for a bug report?",
                a: "Your browser name & version, your operating system, steps to reproduce, and what you expected to happen vs. what actually occurred. Screenshots attached in the details are a bonus."
              },
              {
                q: "Is my feedback anonymous?",
                a: "No — since you're logged in, your name and email are recorded. This helps our team reach out for clarification. Your data is never sold or shared with third parties."
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl p-7 transition-all"
                style={S.faqCard}
              >
                <h3 className="font-bold mb-3 leading-snug" style={S.textTitle}>{item.q}</h3>
                <p className="text-sm leading-relaxed" style={S.textMuted}>{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Trust / Stats Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-px relative z-10"
          style={S.statsRow}
        >
          {[
            { value: "20+", label: "Tools Available", sub: "PDF, Image & AI" },
            { value: "100%", label: "Free to Use", sub: "No hidden fees" },
            { value: "Private", label: "Client-Side Processing", sub: "Files never leave your browser" },
            { value: "Always", label: "Open to Feedback", sub: "Your input shapes us" },
          ].map((stat, i) => (
            <div key={i} className="p-8 text-center flex flex-col items-center justify-center gap-1 transition-colors" style={S.statCell}>
              <span className="text-2xl md:text-3xl font-black tracking-tight" style={S.textTitle}>{stat.value}</span>
              <span className="text-sm font-bold mt-1" style={S.textNormal}>{stat.label}</span>
              <span className="text-xs" style={S.textMuted}>{stat.sub}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Popular Tools Strip ── */}
        <div className="mt-24 relative z-10">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={S.textLabel}>Tools on PageDocx</p>
            <h2 className="text-2xl font-black tracking-tight" style={S.textTitle}>
              Everything you need for documents
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Merge PDF", "Split PDF", "Compress PDF", "Rotate PDF", "Edit PDF",
              "PDF to Word", "PDF to JPG", "JPG to PDF", "Compress Image",
              "Convert Image", "OCR — Extract Text", "AI Data Extractor", "E-Sign PDF", "Scan to PDF"
            ].map((tool) => (
              <motion.span
                key={tool}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="px-4 py-2 text-sm font-medium rounded-full transition-all cursor-default hover:opacity-80"
                style={S.tagPill}
              >
                {tool}
              </motion.span>
            ))}
          </div>
        </div>

        {/* ── Final CTA Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 relative z-10 rounded-[40px] p-12 md:p-20 text-center overflow-hidden"
          style={S.cta}
        >
          <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] blur-[100px] rounded-full pointer-events-none" style={S.ctaGlow} />
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={S.textLabel}>Made for you</p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-tight" style={S.textTitle}>
              PageDocx is built <br className="hidden md:block" />
              <span style={S.textLabel}>on your input.</span>
            </h2>
            <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={S.textMuted}>
              We're a small team with big ambitions. Every bug fix, new tool, and UI improvement you see is directly influenced by people like you taking a minute to share their thoughts.
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-3 font-bold text-sm uppercase tracking-widest px-8 py-4 rounded-xl hover:-translate-y-1 transition-all active:translate-y-0"
              style={S.btnPrimary}
            >
              <MessageSquare size={18} />
              Share Your Feedback
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
