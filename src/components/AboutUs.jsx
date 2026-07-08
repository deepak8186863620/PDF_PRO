import { motion, animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Github, Linkedin, Mail, Twitter, Sparkles, MessageSquare, Code2, Users, FileText, Star, Activity, ArrowRight, ShieldCheck, Cpu } from "lucide-react";
import deepakRealImg from "../assets/deepak_real.webp";
import { db, collection, onSnapshot } from "../firebase";

// Animated number counter
function Counter({ target, suffix = "", duration = 2 }) {
  const nodeRef = useRef(null);
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const controls = animate(0, target, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate(value) {
        node.textContent = Math.round(value).toLocaleString() + suffix;
      },
    });
    return () => controls.stop();
  }, [target, suffix, duration]);
  return <span ref={nodeRef}>0{suffix}</span>;
}

// Live stat card with real Firestore data
function LiveStatCard({ icon: Icon, label, value, suffix, color, live }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="group relative bg-[#111] border border-white/10 rounded-[24px] p-6 overflow-hidden hover:border-white/20 transition-all duration-300"
    >
      {/* Glow */}
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${color}`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
            <Icon size={18} />
          </div>
          {live && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          )}
        </div>
        <div className="text-3xl font-black text-white tracking-tight mb-1">
          {value !== null ? <Counter target={value} suffix={suffix} /> : <span className="animate-pulse text-zinc-700">—</span>}
        </div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{label}</p>
      </div>
    </motion.div>
  );
}

export default function AboutUs({ onFeedbackClick }) {
  const [liveUsers, setLiveUsers] = useState(null);
  const [liveRatings, setLiveRatings] = useState(null);
  const [avgRating, setAvgRating] = useState(null);

  // Real-time Firestore listener for user count
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setLiveUsers(snap.size);
    }, () => setLiveUsers(0));
    return unsub;
  }, []);

  // Real-time listener for feedback/ratings
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "feedback"), (snap) => {
      setLiveRatings(snap.size);
      if (snap.size > 0) {
        const ratings = snap.docs
          .map(d => d.data().rating)
          .filter(r => typeof r === "number");
        if (ratings.length > 0) {
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      }
    }, () => { setLiveRatings(0); setAvgRating(4.9); });
    return unsub;
  }, []);

  const stats = [
    { icon: Users,    label: "Registered Users",      value: liveUsers,   suffix: "",   color: "bg-blue-500/20",   live: true  },
    { icon: Star,     label: "App Rating",             value: avgRating || 4.9, suffix: "★", color: "bg-yellow-500/20", live: true  },
    { icon: Activity, label: "Reviews Submitted",      value: liveRatings, suffix: "",   color: "bg-emerald-500/20",live: true  },
    { icon: FileText, label: "Tools Available",        value: 30,          suffix: "+",  color: "bg-purple-500/20", live: false },
  ];

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Hero ── */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-xs font-bold text-zinc-400 mb-6 uppercase tracking-widest"
          >
            <Code2 size={12} />
            <span>Behind the Scenes</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-white mb-6 leading-tight"
          >
            WE BUILD TOOLS<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(to right, #a855f7, #3b82f6, #10b981)" }}>
              FOR THE FUTURE
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed"
          >
            PageDocX was born from a simple frustration — complex PDF tools that were slow, expensive, or invasive. We set out to build something better: fast, private, and AI-native.
          </motion.p>
        </div>

        {/* ── LIVE Real-Time Stats ── */}
        <div className="mb-24">
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Live from Firebase — updated in real-time</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <LiveStatCard key={idx} {...stat} />
            ))}
          </div>
        </div>

        {/* ── Story + Founder ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-24 border-t border-white/5 pt-24">
          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="relative group w-64 md:w-72 lg:w-80 mx-auto"
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-transparent rounded-[40px] blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative aspect-[4/5] rounded-[32px] overflow-hidden border border-white/10 bg-zinc-900">
              <img
                src={deepakRealImg}
                alt="Deepak Prajapati"
                className="w-full h-full object-cover object-top scale-105 group-hover:scale-100 transition-transform duration-700"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-6 left-6">
                <p className="text-white font-black text-xl">Deepak Prajapati</p>
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Founder & Lead Developer</p>
              </div>
            </div>
          </motion.div>

          {/* Story Text */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="space-y-6"
          >
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">The Origin Story</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight mb-4">
                Born from frustration.<br />Built with purpose.
              </h2>
            </div>
            <div className="w-12 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />
            <div className="space-y-4 text-zinc-400 leading-relaxed">
              <p>
                In 2025, Deepak was constantly juggling five different apps just to manage PDFs for work — compress one, merge another, sign a third. Every tool was either expensive, invasive, or painfully slow.
              </p>
              <p>
                So he built his own. PageDocX started as a weekend project and grew into a full-stack, AI-native document platform used by professionals worldwide.
              </p>
              <blockquote className="border-l-2 border-white/10 pl-4 text-zinc-300 italic">
                "I wanted to build something I'd actually use every day — fast, private, and intelligent."
              </blockquote>
            </div>
            <div className="flex items-center gap-3 pt-2">
              {[
                { icon: Github,   href: "https://github.com/deepak8186863620",                              label: "GitHub"   },
                { icon: Linkedin, href: "https://www.linkedin.com/in/deepak-prajapati-819b81327/",          label: "LinkedIn" },
                { icon: Twitter,  href: "#",                                                                 label: "Twitter"  },
                { icon: Mail,     href: "mailto:deepakprajapatid021@gmail.com",                              label: "Email"    },
              ].map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} aria-label={label}
                  className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Latest Insights (Mini Blog Section) ── */}
        <div className="mb-24 border-t border-white/5 pt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Knowledge Base</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Latest from the blog</h2>
            </div>
            <a href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-purple-400 transition-colors uppercase tracking-widest">
              View all articles <ArrowRight size={16} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "How AI is changing document workflows", desc: "Discover how Gemini 2.5 Flash helps extract tables, summarize texts, and OCR scanned pages instantly.", date: "May 24, 2026", read: "5 min read", color: "from-purple-500 to-pink-500", icon: Sparkles },
              { title: "Secure PDF Signing: A Guide", desc: "Keep your files confidential. Read our best practices for processing financial, legal, and medical documents.", date: "May 20, 2026", read: "3 min read", color: "from-blue-500 to-indigo-500", icon: ShieldCheck },
              { title: "The Future of Local-First Web Apps", desc: "Why we believe the browser is the ultimate operating system, and how we built a secure platform around it.", date: "May 15, 2026", read: "4 min read", color: "from-emerald-400 to-emerald-600", icon: Cpu }
            ].map((blog, i) => (
              <a href="/blog" key={i} className="group block bg-[#111] border border-white/10 rounded-[24px] p-6 hover:border-white/20 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${blog.color} flex items-center justify-center text-white mb-6 shadow-lg`}>
                  <blog.icon size={20} />
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 font-bold uppercase tracking-widest mb-3">
                  <span>{blog.date}</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span>{blog.read}</span>
                </div>
                <h3 className="text-xl font-black text-white mb-3 group-hover:text-purple-400 transition-colors leading-tight">{blog.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{blog.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* ── Timeline / Roadmap ── */}
        <div className="mb-24 border-t border-white/5 pt-24">
          <div className="text-center mb-16">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">The Journey</p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">How we got here</h2>
          </div>
          
          <div className="max-w-4xl mx-auto">
            {[
              { year: "2024", title: "The First Prototype", desc: "Built a simple script to merge PDFs locally because existing tools were too slow." },
              { year: "2025", title: "PageDocX is Born", desc: "Launched the first version of the platform with 10 core tools and zero ads." },
              { year: "2026", title: "AI Integration", desc: "Partnered with Gemini to bring intelligent OCR, summarization, and chat directly into the browser." },
              { year: "Future", title: "Collaborative Workspaces", desc: "Building real-time multiplayer document editing for teams and enterprises." },
            ].map((item, i) => (
              <div key={i} className="flex gap-8 group">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-[#111] border-2 border-white/10 flex items-center justify-center text-white font-black group-hover:border-purple-500 transition-colors z-10 shrink-0 shadow-xl">
                    {item.year === "Future" ? <Sparkles size={20} className="text-purple-400" /> : item.year.slice(2)}
                  </div>
                  {i !== 3 && <div className="w-0.5 h-full bg-gradient-to-b from-white/10 to-transparent my-2" />}
                </div>
                <div className="pb-16 pt-3">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{item.year}</span>
                    <h3 className="text-2xl font-black text-white">{item.title}</h3>
                  </div>
                  <p className="text-zinc-400 text-lg leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contact CTA ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="p-10 md:p-16 bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-[40px] text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Have a question or feedback?</h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
              We're always looking to improve. Reach out to us if you have suggestions or just want to say hi!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={onFeedbackClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
              >
                <MessageSquare size={16} /> Rate our App
              </button>
              <a href="mailto:deepakprajapatid021@gmail.com"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-zinc-900 text-white border border-white/10 px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
              >
                <Mail size={16} /> Get in Touch
              </a>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
