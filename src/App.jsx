import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import React from "react";
import ToolCard from "./components/ToolCard";
import AboutUs from "./components/AboutUs";
import Login from "./components/Login";
import FeedbackPage from "./components/FeedbackPage";

const ToolView = React.lazy(() => import("./components/ToolView"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const Blog = React.lazy(() => import("./components/Blog"));
import TermsOfService from "./components/TermsOfService";
import PrivacyPolicy from "./components/PrivacyPolicy";
import { TOOLS } from "./constants";
import {
  Sparkles, FileText, Image as ImageIcon,
  Search, LayoutGrid, ArrowRight, Shield, Zap, Globe, Code2,
  Share2, Copy, Star, HelpCircle, Lock, CheckCircle, Info, Heart
} from "lucide-react";
import { auth, db, doc, setDoc, getDoc, Timestamp, handleFirestoreError, OperationType } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { trackPageView, setAnalyticsUser, clearAnalyticsUser } from "./lib/analytics";

export default function App() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [view, setView] = useState("login");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [user, loading] = useAuthState(auth);
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  useEffect(() => {
    if (!loading) {
      if (!user && view !== "login" && view !== "about" && view !== "feedback" && view !== "terms" && view !== "privacy") {
        setView("login");
        const params = new URLSearchParams(window.location.search);
        if (!params.has("esignDocId")) {
          setSelectedTool(null);
        }
      } else if (user && view === "login") {
        const params = new URLSearchParams(window.location.search);
        if (params.has("esignDocId")) {
          const esignTool = TOOLS.find(t => t.id === "esign-pdf");
          if (esignTool) {
            setSelectedTool(esignTool);
          }
        }
        setView("home");
      }
    }
  }, [user, loading, view]);

  // Handle auto-opening shared document if already authenticated
  useEffect(() => {
    if (user && !loading) {
      const params = new URLSearchParams(window.location.search);
      const esignDocId = params.get("esignDocId");
      if (esignDocId) {
        const esignTool = TOOLS.find(t => t.id === "esign-pdf");
        if (esignTool && selectedTool?.id !== "esign-pdf") {
          setSelectedTool(esignTool);
          setView("home");
        }
      }
    }
  }, [user, loading]);

  // Track SPA page views on every route/view change
  useEffect(() => {
    const pageName = selectedTool ? `tool_${selectedTool.id}` : view;
    trackPageView(pageName);
  }, [view, selectedTool]);

  // Intercept mobile back gesture / hardware back button
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (state) {
        if (state.tool) {
          const tool = TOOLS.find(t => t.id === state.tool);
          setSelectedTool(tool || null);
        } else {
          setSelectedTool(null);
        }
        if (state.view) {
          setView(state.view);
        }
      } else {
        setSelectedTool(null);
        setView(user ? "home" : "login");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user]);

  const handleOpenTool = (tool) => {
    window.history.pushState({ view, tool: tool.id }, "", "");
    setSelectedTool(tool);
  };

  const handleCloseTool = () => {
    // If the user clicks the UI back button, we manually trigger a history back 
    // to keep the history stack clean, which will trigger the popstate listener.
    window.history.back();
  };

  const categories = [
    { id: "all", label: "All Tools", icon: LayoutGrid, count: TOOLS.length },
    { id: "pdf", label: "PDF Tools", icon: FileText, count: TOOLS.filter(t => t.category === "pdf").length },
    { id: "image", label: "Image Tools", icon: ImageIcon, count: TOOLS.filter(t => t.category === "image").length },
  ];

  const stats = [
    { icon: Zap, value: "10x", label: "Faster Processing" },
    { icon: Shield, value: "100%", label: "Secure & Private" },
    { icon: Star, value: "4.9/5", label: "User Rating" },
  ];

  const filteredTools = TOOLS.filter(tool => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getToolsByCategory = (catId) =>
    filteredTools.filter(t => t.category === catId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedTool, view]);

  useEffect(() => {
    const checkHealth = async (retries = 3) => {
      try {
        await new Promise(r => setTimeout(r, 2000));
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log("Server Health:", data);
      } catch (err) {
        if (retries > 0) checkHealth(retries - 1);
      }
    };
    checkHealth();

    if (user) {
      // Identify user in GA using Firebase UID (safe — no PII)
      const provider = user.providerData?.[0]?.providerId || 'unknown';
      setAnalyticsUser(user.uid, provider);

      const userRef = doc(db, "users", user.uid);
      getDoc(userRef).then(docSnap => {
        if (!docSnap.exists()) {
          setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: Timestamp.now(),
            lastLogin: Timestamp.now(),
            role: "user",
          });
        } else {
          setDoc(userRef, {
            lastLogin: Timestamp.now(),
            displayName: user.displayName,
            photoURL: user.photoURL,
          }, { merge: true });
        }
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
    } else {
      // User logged out — clear GA identity
      clearAnalyticsUser();
    }
  }, [user]);

  const handleHomeClick = () => {
    if (view !== "home" || selectedTool) {
      window.history.pushState({ view: "home" }, "", "");
    }
    setSelectedTool(null);
    setView("home");
  };

  const handleDashboardClick = () => {
    if (view !== "dashboard" || selectedTool) {
      window.history.pushState({ view: "dashboard" }, "", "");
    }
    setSelectedTool(null);
    setView("dashboard");
  };

  const handleAboutClick = () => {
    if (view !== "about" || selectedTool) {
      window.history.pushState({ view: "about" }, "", "");
    }
    setSelectedTool(null);
    setView("about");
  };

  const handleFeedbackClick = () => {
    if (view !== "feedback" || selectedTool) {
      window.history.pushState({ view: "feedback" }, "", "");
    }
    setSelectedTool(null);
    setView("feedback");
  };

  const handleLoginClick = () => {
    if (view !== "login" || selectedTool) {
      window.history.pushState({ view: "login" }, "", "");
    }
    setSelectedTool(null);
    setView("login");
  };

  const handleTermsClick = () => {
    if (view !== "terms" || selectedTool) {
      window.history.pushState({ view: "terms" }, "", "");
    }
    setSelectedTool(null);
    setView("terms");
  };

  const handlePrivacyClick = () => {
    if (view !== "privacy" || selectedTool) {
      window.history.pushState({ view: "privacy" }, "", "");
    }
    setSelectedTool(null);
    setView("privacy");
  };

  const handleBlogClick = () => {
    if (view !== "blog" || selectedTool) {
      window.history.pushState({ view: "blog" }, "", "");
    }
    setSelectedTool(null);
    setView("blog");
  };

  const handleToolClick = (toolName) => {
    const tool = TOOLS.find(t => t.name === toolName);
    if (tool) {
      handleOpenTool(tool);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen min-h-[100dvh] font-sans overflow-x-hidden" style={{ background: "var(--bg-primary)", transition: "background 0.3s ease" }}>
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "rgba(24, 24, 27, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              backdropFilter: "blur(20px)",
            },
          }}
        />

        {/* Background layers */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Deep gradient base */}
          <div className="absolute inset-0" style={{
            background: theme === "light"
              ? "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.04) 0%, transparent 60%)"
              : "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,255,255,0.03) 0%, transparent 60%)"
          }} />
          {/* Animated orbs */}
          <div className="orb-1 absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-100" style={{
            background: theme === "light"
              ? "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)"
          }} />
          <div className="orb-2 absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full" style={{
            background: theme === "light"
              ? "radial-gradient(ellipse, rgba(168,85,247,0.05) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)"
          }} />
          <div className="orb-3 absolute top-[30%] right-[5%] w-[35%] h-[35%] rounded-full" style={{
            background: theme === "light"
              ? "radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(255,255,255,0.01) 0%, transparent 70%)"
          }} />
          {/* Subtle grid */}
          <div className="absolute inset-0" style={{
            opacity: theme === "light" ? 0.04 : 0.025,
            backgroundImage: theme === "light"
              ? `linear-gradient(rgba(15,23,42,0.8) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(15,23,42,0.8) 1px, transparent 1px)`
              : `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "72px 72px"
          }} />
        </div>

        {view !== "login" && (
          <Navbar
            onDashboardClick={handleDashboardClick}
            onHomeClick={handleHomeClick}
            onAboutClick={handleAboutClick}
            onFeedbackClick={handleFeedbackClick}
            onLoginClick={handleLoginClick}
            onBlogClick={handleBlogClick}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        <main className="relative z-10">
          <AnimatePresence mode="wait">
            {selectedTool ? (
              <motion.div
                key="tool-view"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>}>
                  <ToolView tool={selectedTool} onBack={handleCloseTool} />
                </React.Suspense>
              </motion.div>
            ) : view === "dashboard" ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>}>
                  <Dashboard 
                    onNavigateHome={handleHomeClick} 
                    onSelectTool={(toolId) => {
                      const tool = TOOLS.find(t => t.id === toolId);
                      if (tool) {
                        handleOpenTool(tool);
                      }
                    }} 
                  />
                </React.Suspense>
              </motion.div>
            ) : view === "about" ? (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <AboutUs onFeedbackClick={handleFeedbackClick} />
              </motion.div>
            ) : view === "feedback" ? (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <FeedbackPage />
              </motion.div>
            ) : view === "terms" ? (
              <motion.div
                key="terms"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <TermsOfService />
              </motion.div>
            ) : view === "privacy" ? (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <PrivacyPolicy />
              </motion.div>
            ) : view === "blog" ? (
              <motion.div
                key="blog"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20"><div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div></div>}>
                  <Blog onNavigateHome={handleHomeClick} />
                </React.Suspense>
              </motion.div>
            ) : view === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Login 
                  onBack={handleHomeClick} 
                  onLoginSuccess={handleHomeClick} 
                  onAboutClick={handleAboutClick} 
                  onToolClick={handleToolClick} 
                  onContactClick={handleFeedbackClick} 
                  onTermsClick={handleTermsClick} 
                  onPrivacyClick={handlePrivacyClick} 
                  onBlogClick={handleBlogClick}
                />
              </motion.div>
            ) : (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="pt-24 sm:pt-28 md:pt-36 pb-24 px-4 sm:px-6 lg:px-8"
              >
                {/* ── Hero Section ── */}
                <div className="max-w-5xl mx-auto text-center mb-20 md:mb-28">

                  {/* Product Hunt / Launch notice banner */}
                  <motion.a
                    href="https://producthunt.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="inline-flex items-center gap-3 bg-[#ff6154]/10 hover:bg-[#ff6154]/20 border border-[#ff6154]/20 px-5 py-2.5 rounded-full text-sm font-bold text-[#ff6154] mb-8 transition-colors duration-300 shadow-lg shadow-[#ff6154]/5 group"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm2.5-7.5h-5v-5h5a2.5 2.5 0 010 5zm-2.5-2.5v-2.5h-2.5v5h2.5a2.5 2.5 0 000-5z"/></svg>
                    <span className="hidden sm:inline">We are live on Product Hunt!</span>
                    <span className="sm:hidden">Live on Product Hunt</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </motion.a>

                  {/* Headline */}
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white mb-6 leading-[1.1] sm:leading-[1.0] uppercase"
                  >
                    THE ULTIMATE <br />
                    <span
                      className="text-transparent bg-clip-text"
                      style={{ backgroundImage: "linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #10b981 100%)" }}
                    >
                      AI PDF EDITOR
                    </span>
                  </motion.h1>

                  {/* Sub-headline */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-zinc-400 text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed mb-10"
                  >
                    Merge, split, compress, and sign documents instantly with the fastest, free AI-powered electronic signature platform.
                  </motion.p>
                  
                  {/* Trust Badges */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 mb-12 text-zinc-500 text-xs sm:text-sm font-semibold uppercase tracking-wider"
                  >
                    <span className="flex items-center gap-1.5"><Shield size={16} className="text-emerald-500" /> AES-256 Encrypted</span>
                    <span className="flex items-center gap-1.5"><CheckCircle size={16} className="text-blue-500" /> No Signup Required</span>
                    <span className="flex items-center gap-1.5"><Globe size={16} className="text-purple-500" /> Free Forever</span>
                  </motion.div>

                  {/* Search bar */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="max-w-xl mx-auto mb-10 relative z-10"
                  >
                    <div className="relative group">
                      <div
                        className="absolute -inset-[1px] rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm"
                        style={{ background: "linear-gradient(45deg, #3b82f6, #a855f7, #10b981)" }}
                      />
                      <div
                        className="relative flex items-center rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: "#111111", border: "1px solid #2a2a2a" }}
                      >
                        <Search className="absolute left-5 text-[#555555] group-focus-within:text-purple-400 transition-colors" size={20} />
                        <input
                          id="tool-search"
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search tools – e-sign, compress, OCR..."
                          className="w-full bg-transparent pl-14 pr-5 py-5 text-white focus:outline-none placeholder:text-[#666666] text-[16px] font-medium"
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* CTA buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 mb-16 relative z-10"
                  >
                    <button
                      onClick={() => document.getElementById("tools-section")?.scrollIntoView({ behavior: "smooth" })}
                      className="flex items-center justify-center w-full sm:w-auto gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-xl shadow-purple-500/20 px-10 py-4 rounded-full font-bold text-[16px] transition-all hover:scale-105 active:scale-95"
                    >
                      <Sparkles size={18} />
                      Start Editing Free
                    </button>
                    <button
                      onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                      className="flex items-center justify-center w-full sm:w-auto gap-2 bg-[#161616] border border-[#2a2a2a] text-white hover:bg-[#202020] px-10 py-4 rounded-full font-bold text-[16px] transition-all hover:scale-105 active:scale-95"
                    >
                      See How It Works
                      <ArrowRight size={18} />
                    </button>
                  </motion.div>

                  {/* Stats row */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 pt-8 border-t border-white/5"
                  >
                    {stats.map((stat, i) => (
                      <div key={i} className="flex items-center gap-4 group">
                        <div className="w-[54px] h-[54px] rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:bg-purple-500/10 group-hover:border-purple-500/30 group-hover:text-purple-400 transition-all duration-300 shadow-lg">
                          <stat.icon size={24} className="text-zinc-400 group-hover:text-purple-400 transition-colors" />
                        </div>
                        <div className="text-left">
                          <p className="text-white font-black text-2xl leading-none mb-1">{stat.value}</p>
                          <p className="text-zinc-500 text-[13px] font-bold uppercase tracking-wider leading-none">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* ── Tools Section ── */}
                <div id="tools-section" className="max-w-[1600px] mx-auto scroll-mt-28">

                  {/* Category tabs */}
                  <div className="flex items-center justify-center mb-16">
                    <div
                      className="flex items-center gap-1 p-2 rounded-[24px]"
                      style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                    >
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className={`flex items-center gap-1 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-3.5 rounded-[12px] sm:rounded-[16px] text-[12px] sm:text-[15px] transition-all duration-200 ${
                            activeCategory === cat.id
                              ? "text-black bg-white shadow-lg font-bold"
                              : "text-[#777777] font-medium hover:text-white"
                          }`}
                        >
                          <cat.icon size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span className="hidden min-[380px]:inline">{cat.label}</span>
                          <span className="min-[380px]:hidden">{cat.label.replace(' Tools', '')}</span>
                          <span
                            className={`text-[10px] sm:text-[12px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full ml-0.5 sm:ml-1 ${
                              activeCategory === cat.id
                                ? "bg-[#e5e5e5] text-black"
                                : "bg-[#222222] text-[#777777]"
                            }`}
                          >
                            {cat.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {filteredTools.length > 0 ? (
                      <motion.div
                        key={activeCategory + searchQuery}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-16"
                      >
                        {[
                          { id: "pdf", label: "PDF Tools", desc: "Professional document management" },
                          { id: "image", label: "Image Tools", desc: "High-performance image processing" },
                        ].map(cat => {
                          const tools = getToolsByCategory(cat.id);
                          if (tools.length === 0) return null;
                          if (activeCategory !== "all" && activeCategory !== cat.id) return null;

                          return (
                            <div key={cat.id}>
                              {/* Section header */}
                              <div className="flex flex-col items-center justify-center text-center mb-10">
                                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-[0.2em] mb-2">{cat.id} tools</p>
                                <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">{cat.label}</h2>
                                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] bg-[#161616] border border-[#2a2a2a] px-4 py-1.5 rounded-full">
                                  {tools.length} tools
                                </span>
                              </div>

                              {/* Tool grid — 2 columns on mobile, 3 on laptop, 4 on wide desktop */}
                              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 xl:gap-6">
                                {tools.map((tool, idx) => (
                                  <motion.div
                                    key={tool.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                  >
                                    <ToolCard
                                      {...tool}
                                      onClick={() => handleOpenTool(tool)}
                                    />
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-28"
                        style={{ background: "rgba(24,24,27,0.4)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "24px" }}
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <Search size={28} className="text-white/60" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No tools found</h3>
                        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8">
                          We couldn't find any tools matching "{searchQuery}".
                        </p>
                        <button
                          onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}
                          className="btn-primary text-sm px-6 py-2.5"
                        >
                          Clear search
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── How It Works Section ── */}
                <div id="how-it-works" className="max-w-[1600px] mx-auto mt-32 pt-20 border-t border-white/5">
                  <div className="text-center mb-16">
                    <span className="text-purple-400 font-bold uppercase tracking-widest text-sm mb-3 block">Simple Process</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6">How PDF Master Works</h2>
                    <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Upload your document, apply your changes securely in your browser, and download the finished file instantly.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    <div className="hidden md:block absolute top-[50%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10" />
                    
                    {[
                      { icon: Code2, title: "1. Upload File", desc: "Drag & drop your PDF or image securely into our browser sandbox." },
                      { icon: Sparkles, title: "2. Apply Tools", desc: "Sign, merge, compress, or use AI features directly on your device." },
                      { icon: Shield, title: "3. Save & Secure", desc: "Download instantly. Your files are never stored on our servers." }
                    ].map((step, idx) => (
                      <div key={idx} className="bg-[#111] border border-white/10 rounded-3xl p-8 text-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 text-white group-hover:scale-110 transition-transform">
                          <step.icon size={28} className="group-hover:text-purple-400 transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                        <p className="text-zinc-400">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Testimonials Section ── */}
                <div className="max-w-[1600px] mx-auto mt-32 pt-20 border-t border-white/5 pb-10">
                  <div className="text-center mb-16">
                    <span className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-3 block">Wall of Love</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Loved by Professionals</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { name: "Sarah L.", role: "Legal Consultant", text: "PDF Master is incredible. It handles large contracts effortlessly, and knowing the e-signatures are secure gives my clients peace of mind." },
                      { name: "James D.", role: "Software Engineer", text: "The fact that everything runs client-side makes it blazing fast. Finally, a PDF tool that respects user privacy and doesn't require a subscription." }
                    ].map((testimonial, idx) => (
                      <div key={idx} className="bg-[#111] border border-white/10 rounded-3xl p-8 flex flex-col justify-between">
                        <div>
                          <div className="flex gap-1 text-yellow-500 mb-6">
                            {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                          </div>
                          <p className="text-lg text-zinc-300 italic mb-8">"{testimonial.text}"</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg">
                            {testimonial.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{testimonial.name}</p>
                            <p className="text-xs text-zinc-500">{testimonial.role}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {view !== "login" && <Footer onAboutClick={handleAboutClick} onToolClick={handleToolClick} onContactClick={handleFeedbackClick} onTermsClick={handleTermsClick} onPrivacyClick={handlePrivacyClick} onBlogClick={handleBlogClick} />}
        
        {/* Floating Share / Feedback Button */}
        {view === "home" && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'PDF Master',
                    text: 'The best free AI PDF Editor & E-Signature platform.',
                    url: 'https://pdf-pro-dx2i.onrender.com/'
                  });
                } else {
                  navigator.clipboard.writeText('https://pdf-pro-dx2i.onrender.com/');
                  alert('Link copied to clipboard!');
                }
              }}
              className="group flex items-center justify-center w-12 h-12 rounded-full bg-[#111] border border-white/10 shadow-2xl hover:bg-purple-600 hover:border-purple-500 transition-all duration-300 hover:scale-110"
              aria-label="Share App"
            >
              <Share2 size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
            </button>
            <button
              onClick={handleFeedbackClick}
              className="group flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:bg-blue-500 transition-all duration-300 hover:scale-110"
              aria-label="Send Feedback"
            >
              <HelpCircle size={22} className="text-white" />
            </button>
          </div>
        )}

        <PWAInstallPrompt />
      </div>
    </ErrorBoundary>
  );
}
