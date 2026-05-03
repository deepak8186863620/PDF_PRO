import { useState, useEffect } from "react";
import { FileText, LogIn, LogOut, LayoutDashboard, Menu, X, Grip } from "lucide-react";
import { auth, googleProvider, signInWithPopup, signOut, db, doc, setDoc, getDoc, Timestamp } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { motion, AnimatePresence } from "motion/react";
import deepakImg from "../assets/deepak.png";

export default function Navbar({ onDashboardClick, onHomeClick, onAboutClick, onFeedbackClick, onLoginClick }) {
  const [user] = useAuthState(auth);
  const [serverStatus, setServerStatus] = useState("checking");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  const handleLogin = () => {
    onLoginClick?.();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">

          <div className="flex items-center gap-6">
            {/* Logo */}
            <button
              onClick={() => { onHomeClick?.(); closeMobileMenu(); }}
              className="flex items-center gap-3 group focus-ring rounded-xl"
            >
              <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-white/5 group-hover:shadow-white/10 transition-shadow duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText size={18} className="text-black drop-shadow-sm" />
                </div>
              </div>
              <div className="flex flex-col items-start leading-none mr-2">
                <span className="text-base font-800 text-white tracking-tight">PDF Master</span>
              </div>
            </button>

            <button className="text-zinc-400 hover:text-white transition-colors hidden md:block">
              <Grip size={20} />
            </button>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="flex items-center gap-1.5 text-[13px] font-700 text-white hover:text-red-500 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </button>
              ))}
              {user && (
                <button
                  onClick={onDashboardClick}
                  className="flex items-center gap-1.5 text-[13px] font-700 text-white hover:text-red-500 transition-colors whitespace-nowrap"
                >
                  DASHBOARD
                </button>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">

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
                    className="text-[14px] font-700 text-white hover:text-zinc-300 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={handleLogin}
                    className="bg-[#E5322D] hover:bg-[#D42B27] text-white px-5 py-2.5 rounded-lg text-[14px] font-700 transition-all shadow-lg"
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
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mx-4 mb-3 glass-card rounded-2xl overflow-hidden"
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
                    <div>

                      <p className="text-zinc-500 text-xs">{user.email}</p>
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
        )}
      </AnimatePresence>
    </nav>
  );
}
