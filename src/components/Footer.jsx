import { Github, Twitter, Linkedin, Mail, FileText, Heart } from "lucide-react";

const SOCIAL_LINKS = [
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
  { icon: Mail, label: "Email", href: "#" },
];

export default function Footer({ onAboutClick }) {
  return (
    <footer className="relative z-20 border-t pt-16 pb-10 px-4 sm:px-6" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.92)", isolation: "isolate" }}>
      <div className="max-w-7xl mx-auto">

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand column */}
          <div className="col-span-1 min-[480px]:col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "#ffffff", boxShadow: "0 4px 16px rgba(255,255,255,0.15)" }}>
                <FileText size={17} className="text-black" />
              </div>
              <div>
                <span className="text-base font-800 text-white tracking-tight">PDF Master</span>
                <p className="text-[9px] font-600 text-zinc-500 tracking-widest uppercase leading-none mt-0.5">Pro Tools</p>
              </div>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6 max-w-full sm:max-w-[220px]">
              Professional-grade PDF and image processing tools — free, fast, and secure.
            </p>
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  onMouseEnter={e => {
                    (e.currentTarget).style.background = "rgba(255,255,255,0.1)";
                    (e.currentTarget).style.borderColor = "rgba(255,255,255,0.2)";
                    (e.currentTarget).style.color = "#ffffff";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget).style.borderColor = "rgba(255,255,255,0.06)";
                    (e.currentTarget).style.color = "";
                  }}
                >
                  <s.icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* PDF Tools */}
          <div>
            <h4 className="text-xs font-800 text-white uppercase tracking-widest mb-5">PDF Tools</h4>
            <ul className="space-y-3">
              {["Merge PDF", "Split PDF", "Compress PDF", "Rotate PDF", "Edit PDF"].map(item => (
                <li key={item}>
                  <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors duration-200">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Image Tools */}
          <div>
            <h4 className="text-xs font-800 text-white uppercase tracking-widest mb-5">Image Tools</h4>
            <ul className="space-y-3">
              {["Compress Image", "Convert Image", "JPG to PDF", "PDF to JPG"].map(item => (
                <li key={item}>
                  <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors duration-200">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-800 text-white uppercase tracking-widest mb-5">Company</h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={onAboutClick}
                  className="text-sm text-zinc-500 hover:text-white transition-colors duration-200"
                >
                  About Us
                </button>
              </li>
              {["Privacy Policy", "Terms of Service", "Contact"].map(item => (
                <li key={item}>
                  <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors duration-200">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} PDF Master. All rights reserved.
          </p>
          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
            Made with <Heart size={11} className="text-red-500 fill-red-500" /> by{" "}
            <span className="text-zinc-300 font-600">Deepak Prajapati & Team</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
