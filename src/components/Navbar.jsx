import { useState, useEffect, useRef } from "react";
import { FileText, LogIn, LogOut, LayoutDashboard, Menu, X, Grip, Download, Share, PlusSquare } from "lucide-react";
import { auth, googleProvider, signInWithPopup, signOut, db, doc, setDoc, getDoc, Timestamp } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { motion, AnimatePresence } from "motion/react";
import deepakImg from "../assets/deepak.webp";

export default function Navbar({ onDashboardClick, onHomeClick, onAboutClick, onFeedbackClick, onLoginClick }) {
  const [user] = useAuthState(auth);
  const [serverStatus, setServerStatus] = useState("checking");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const guideRef = useRef(null);

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone =
    ('standalone' in window.navigator && window.navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        setServerStatus(res.ok ? "online" : "offline");
      } catch {
        setServerStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isStandalone) { setIsInstalled(true); return; }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setDeferredPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Close iOS guide on outside click
  useEffect(() => {
    if (!showIosGuide) return;
    const handleOutside = (e) => {
      if (guideRef.current && !guideRef.current.contains(e.target)) {
        setShowIosGuide(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showIosGuide]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Native one-click install (Chrome, Edge, Android)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      // iOS or browser without native prompt — show how-to guide
      setShowIosGuide(prev => !prev);
    }
  };

  const handleLogin = () => { onLoginClick?.(); };

  const handleLogout = async () => {
    try { await signOut(auth); } catch (error) { console.error("Logout failed:", error); }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navLinks = [
    { label: "HOME PAGE", action: onHomeClick },
    { label: "SPLIT PDF", action: onHomeClick },
    { label: "ABOUT US", action: onAboutClick },
    { label: "FEEDBACK", action: onFeedbackClick },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#000000]/90 backdrop-blur-2xl border-b border-white/10 shadow-2xl shadow-black/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 md:h-24">

          <div className="flex items-center gap-6">
            {/* Logo */}
            <button
              onClick={() => { onHomeClick?.(); closeMobileMenu(); }}
              className="flex items-center gap-3 group focus-ring rounded-xl"
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-lg shadow-white/5 group-hover:shadow-white/10 transition-shadow duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText size={22} className="text-black drop-shadow-sm" />
                </div>
              </div>
              <div className="flex flex-col items-start leading-none mr-1 sm:mr-2">
                <span className="text-lg sm:text-xl font-800 text-white tracking-tight truncate">PDF Master</span>
              </div>
            </button>

            <button className="text-zinc-400 hover:text-white transition-colors hidden md:block">
              <Grip size={20} />
            </button>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map(link => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="flex items-center gap-1.5 text-[15px] font-700 text-white hover:text-red-500 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </button>
              ))}
              {user && (
                <button
                  onClick={onDashboardClick}
                  className="flex items-center gap-1.5 text-[15px] font-700 text-white hover:text-red-500 transition-colors whitespace-nowrap"
                >
                  DASHBOARD
                </button>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">

            {/* Install App button — always visible unless already installed */}
            {!isInstalled && (
              <div className="relative" ref={guideRef}>
                <button
                  id="navbar-install-btn"
                  onClick={handleInstallClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-700 text-white bg-white/10 border border-white/15 hover:bg-white/20 active:scale-95 transition-all duration-150"
                >
                  <Download size={13} />
                  Install App
                </button>

                {/* Guide popover — only shown on iOS or when no native prompt */}
                <AnimatePresence>
                  {showIosGuide && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-11 w-72 bg-[#1a1a1a] border border-white/15 rounded-2xl shadow-2xl p-4 z-50"
                    >
                      {isIos ? (
                        <>
                          <p className="text-white text-xs font-700 mb-3">Add to Home Screen (iOS)</p>
                          <div className="space-y-2.5 text-xs text-zinc-300">
                            <p className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-700 flex-shrink-0">1</span>
                              Tap the <Share size={13} className="text-white mx-1 flex-shrink-0" /> Share button in Safari.
                            </p>
                            <p className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-700 flex-shrink-0">2</span>
                              Tap <PlusSquare size={13} className="text-white mx-1 flex-shrink-0" /> <strong>Add to Home Screen</strong>.
                            </p>
                            <p className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-700 flex-shrink-0">3</span>
                              Tap <strong>Add</strong> to confirm.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-white text-xs font-700 mb-2">Install PDF Master</p>
                          <p className="text-zinc-400 text-xs mb-3">Your browser will show an install dialog shortly. If not:</p>
                          <div className="space-y-2 text-xs text-zinc-300">
                            <p className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-700 flex-shrink-0">1</span>
                              Click the <strong className="text-white mx-1">⋮</strong> menu in Chrome/Edge.
                            </p>
                            <p className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-700 flex-shrink-0">2</span>
                              Click <strong className="text-white">"Install PDF Master…"</strong>
                            </p>
                          </div>
                          <p className="text-zinc-500 text-[10px] mt-3">💡 For instant install, use Chrome or Edge.</p>
                        </>
                      )}
                      <div className="absolute -top-2 right-5 w-3 h-3 bg-[#1a1a1a] border-t border-l border-white/15 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Server status pill */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-600 uppercase tracking-widest transition-all duration-300 ${
                serverStatus === "online"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : serverStatus === "offline"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serverStatus === "online" ? "bg-emerald-400 animate-pulse" :
                  serverStatus === "offline" ? "bg-red-400" : "bg-amber-400"
                }`}
              />
              {serverStatus}
            </div>

            {/* Auth – desktop */}
            <div className="hidden md:flex items-center gap-6">
              {!user ? (
                <>
                  <button
                    onClick={handleLogin}
                    className="text-base font-700 text-white hover:text-zinc-300 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={handleLogin}
                    className="bg-[#E5322D] hover:bg-[#D42B27] text-white px-6 py-3 rounded-xl text-base font-700 transition-all shadow-lg"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={onDashboardClick}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || ""}
                        className="w-8 h-8 rounded-full ring-2 ring-white/20"
                      />
                    ) : (
                      <img
                        src={deepakImg}
                        alt="Profile"
                        className="w-8 h-8 rounded-full ring-2 ring-white/20 object-cover"
                      />
                    )}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 text-zinc-500 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileMenu}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[-1] h-screen"
            />
            
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mx-4 mb-3 bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black"
            >
              <div className="p-4 space-y-1">
                {navLinks.map(link => (
                  <button
                    key={link.label}
                    onClick={() => { link.action?.(); closeMobileMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-700 text-white hover:bg-white/6 transition-all"
                  >
                    {link.label}
                  </button>
                ))}
                {user && (
                  <button
                    onClick={() => { onDashboardClick?.(); closeMobileMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-500 text-zinc-300 hover:text-white hover:bg-white/6 transition-all"
                  >
                    <LayoutDashboard size={16} className="text-white" />
                    Dashboard
                  </button>
                )}
              </div>

              <div className="px-4 pb-4 pt-1 border-t border-white/5">
                {!user ? (
                  <button
                    onClick={() => { handleLogin(); closeMobileMenu(); }}
                    className="btn-primary w-full justify-center py-3 text-sm"
                  >
                    <LogIn size={16} />
                    Sign in with Google
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-3 py-2">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full ring-2 ring-white/20" />
                      ) : (
                        <img
                          src={deepakImg}
                          alt="Profile"
                          className="w-10 h-10 rounded-full ring-2 ring-white/20 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-white text-sm font-600 truncate">{user.displayName || "User"}</p>
                        <p className="text-zinc-500 text-xs truncate">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { handleLogout(); closeMobileMenu(); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 text-red-400 bg-red-500/8 border border-red-500/15 hover:bg-red-500/15 transition-all"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
