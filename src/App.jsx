import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ToolCard from "./components/ToolCard";
import ToolView from "./components/ToolView";
import Dashboard from "./components/Dashboard";
import AboutUs from "./components/AboutUs";
import Login from "./components/Login";
import FeedbackPage from "./components/FeedbackPage";
import TermsOfService from "./components/TermsOfService";
import PrivacyPolicy from "./components/PrivacyPolicy";
import { TOOLS } from "./constants";
import {
  Sparkles, FileText, Image as ImageIcon,
  Search, LayoutGrid, ArrowRight, Shield, Zap, Globe, Code2
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

  useEffect(() => {
    if (!loading) {
      if (!user && view !== "login" && view !== "about" && view !== "feedback" && view !== "terms" && view !== "privacy") {
        setView("login");
        setSelectedTool(null);
      } else if (user && view === "login") {
        setView("home");
      }
    }
  }, [user, loading, view]);

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
    { icon: Zap, value: `${TOOLS.length}+`, label: "Tools Available" },
    { icon: Shield, value: "100%", label: "Secure Processing" },
    { icon: Globe, value: "Free", label: "No Sign-up Required" },
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

  const handleToolClick = (toolName) => {
    const tool = TOOLS.find(t => t.name === toolName);
    if (tool) {
      handleOpenTool(tool);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: "#000000" }}>
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
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,255,255,0.03) 0%, transparent 60%)"
          }} />
          {/* Animated orbs */}
          <div className="orb-1 absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-100" style={{
            background: "radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)"
          }} />
          <div className="orb-2 absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full" style={{
            background: "radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)"
          }} />
          <div className="orb-3 absolute top-[30%] right-[5%] w-[35%] h-[35%] rounded-full" style={{
            background: "radial-gradient(ellipse, rgba(255,255,255,0.01) 0%, transparent 70%)"
          }} />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
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
                <ToolView tool={selectedTool} onBack={handleCloseTool} />
              </motion.div>
            ) : view === "dashboard" ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <Dashboard 
                  onNavigateHome={handleHomeClick} 
                  onSelectTool={(toolId) => {
                    const tool = TOOLS.find(t => t.id === toolId);
                    if (tool) {
                      handleOpenTool(tool);
                    }
                  }} 
                />
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
                  onLoginSuccess={handleDashboardClick} 
                  onAboutClick={handleAboutClick} 
                  onToolClick={handleToolClick} 
                  onContactClick={handleFeedbackClick} 
                  onTermsClick={handleTermsClick} 
                  onPrivacyClick={handlePrivacyClick} 
                />
              </motion.div>
            ) : (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="pt-24 sm:pt-28 md:pt-36 pb-24 px-4 sm:px-6"
              >
                {/* ── Hero Section ── */}
                <div className="max-w-5xl mx-auto text-center mb-20 md:mb-28">

                  {/* Top badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-bold text-white mb-8 uppercase tracking-widest"
                  >
                    <Code2 size={16} />
                    <span>Professional Document Tools</span>
                  </motion.div>

                  {/* Headline */}
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter text-white mb-4 sm:mb-8 leading-[1.1] sm:leading-[0.9] uppercase"
                  >
                    EVERY TOOL YOU NEED <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-400 to-zinc-500">
                      FOR YOUR DOCUMENTS
                    </span>
                  </motion.h1>

                  {/* Sub-headline */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-zinc-400 text-xl max-w-2xl mx-auto leading-relaxed mb-12"
                  >
                    Merge, split, compress, convert, and edit PDFs and images with ease. Powerful tools that work directly in your browser.
                  </motion.p>

                  {/* Search bar */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="max-w-xl mx-auto mb-10"
                  >
                    <div className="relative group">
                      <div
                        className="absolute -inset-[1px] rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                      />
                      <div
                        className="relative flex items-center rounded-2xl overflow-hidden"
                        style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                      >
                        <Search className="absolute left-5 text-[#555555] group-focus-within:text-white transition-colors" size={20} />
                        <input
                          id="tool-search"
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search tools – merge, compress, OCR..."
                          className="w-full bg-transparent pl-14 pr-5 py-4.5 text-white focus:outline-none placeholder:text-[#555555] text-[16px] font-medium"
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* CTA buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-16"
                  >
                    <button
                      onClick={() => document.getElementById("tools-section")?.scrollIntoView({ behavior: "smooth" })}
                      className="flex items-center justify-center w-full sm:w-auto gap-2 bg-white text-black hover:bg-zinc-200 px-8 py-3.5 rounded-full font-bold text-[15px] transition-colors"
                    >
                      <Sparkles size={18} />
                      Explore All Tools
                    </button>
                    <button
                      onClick={() => document.getElementById("tools-section")?.scrollIntoView({ behavior: "smooth" })}
                      className="flex items-center justify-center w-full sm:w-auto gap-2 bg-[#161616] border border-[#2a2a2a] text-white hover:bg-[#202020] px-8 py-3.5 rounded-full font-bold text-[15px] transition-colors"
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
                    className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12"
                  >
                    {stats.map((stat, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center bg-transparent border border-[#2a2a2a]">
                          <stat.icon size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-white font-bold text-[19px] leading-tight mb-0.5">{stat.value}</p>
                          <p className="text-[#888888] text-[14px] font-medium leading-none">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* ── Tools Section ── */}
                <div id="tools-section" className="max-w-7xl mx-auto scroll-mt-28">

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

                              {/* Tool grid */}
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 xl:gap-8">
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {view !== "login" && <Footer onAboutClick={handleAboutClick} onToolClick={handleToolClick} onContactClick={handleFeedbackClick} onTermsClick={handleTermsClick} onPrivacyClick={handlePrivacyClick} />}
        <PWAInstallPrompt />
      </div>
    </ErrorBoundary>
  );
}
