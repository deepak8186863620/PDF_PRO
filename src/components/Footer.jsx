import { Github, Twitter, Linkedin, Mail, FileText, Heart, Sparkles } from "lucide-react";

const SOCIAL_LINKS = [
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
  { icon: Mail, label: "Email", href: "#" },
];

export default function Footer({ onAboutClick, onToolClick, onContactClick, onTermsClick, onPrivacyClick, onBlogClick }) {
  return (
    <footer className="relative z-20 border-t pt-16 pb-10 px-4 sm:px-6" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.92)", isolation: "isolate" }}>
      <div className="max-w-[1600px] mx-auto">

        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-14">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "#ffffff", boxShadow: "0 4px 16px rgba(255,255,255,0.15)" }}>
                <FileText size={17} className="text-black" />
              </div>
              <div>
                <span className="text-base font-800 text-white tracking-tight">PageDocx</span>
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
                  onClick={(e) => {
                    if (s.href === "#") e.preventDefault();
                  }}
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
                  <button 
                    onClick={(e) => { e.preventDefault(); if (onToolClick) onToolClick(item); }} 
                    className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                  >
                    {item}
                  </button>
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
                  <button 
                    onClick={(e) => { e.preventDefault(); if (onToolClick) onToolClick(item); }} 
                    className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                  >
                    {item}
                  </button>
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
                  onClick={(e) => { e.preventDefault(); if (onAboutClick) onAboutClick(); }}
                  className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={(e) => { e.preventDefault(); if (onBlogClick) onBlogClick(); }}
                  className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                >
                  Blog & Guides
                </button>
              </li>
              {["Privacy Policy", "Terms of Service", "Contact"].map(item => {
                let onClickHandler = (e) => e.preventDefault();
                if (item === "Contact") onClickHandler = (e) => { e.preventDefault(); if (onContactClick) onContactClick(); };
                if (item === "Terms of Service") onClickHandler = (e) => { e.preventDefault(); if (onTermsClick) onTermsClick(); };
                if (item === "Privacy Policy") onClickHandler = (e) => { e.preventDefault(); if (onPrivacyClick) onPrivacyClick(); };
                
                return (
                  <li key={item}>
                    <button 
                      onClick={onClickHandler} 
                      className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
              <li>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                >
                  Sitemap
                </a>
              </li>
            </ul>
          </div>

          {/* Get the App */}
          <div className="col-span-1">
            <h4 className="text-xs font-800 text-white uppercase tracking-widest mb-5">Get the App</h4>
            <div className="flex flex-col gap-3">
              
              {/* Google Play */}
              <a href="https://play.google.com/store/apps/details?id=com.pdfmaster.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-white/20 rounded-xl px-3 py-2.5 transition-all duration-200 group" style={{ background: '#111111' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-6 h-6 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <path fill="#2196f3" d="M32.5,463.3L237.9,256L32.5,48.7c-3.1,5.2-4.9,11.2-4.9,17.7v379.3C27.6,452.1,29.4,458.1,32.5,463.3z"/>
                  <path fill="#4caf50" d="M344.2,362.4L237.9,256L32.5,463.3c7.5,12.7,24,16.5,37.3,8.9l274.4-155.8v0C344.2,362.4,344.2,362.4,344.2,362.4z"/>
                  <path fill="#ffc107" d="M480.9,228.6L344.2,149.6v0L237.9,256l106.3,106.4v0l136.7-79C494.6,275.6,494.6,236.4,480.9,228.6z"/>
                  <path fill="#f44336" d="M344.2,149.6L69.8,39.8c-13.3-7.5-29.8-3.7-37.3,8.9L237.9,256L344.2,149.6z"/>
                </svg>
                <div className="flex flex-col justify-center">
                  <p className="text-[9px] text-zinc-400 font-medium leading-[1] mb-0.5">GET IT ON</p>
                  <p className="text-[14px] text-white font-bold leading-[1]">Google Play</p>
                </div>
              </a>

              {/* App Store */}
              <a href="https://apps.apple.com/us/app/pdf-master/id123456789" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-white/20 rounded-xl px-3 py-2.5 transition-all duration-200 group" style={{ background: '#111111' }}>
                <svg viewBox="0 0 384 512" className="w-6 h-6 shrink-0 group-hover:scale-110 transition-transform duration-300 text-white fill-current">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                <div className="flex flex-col justify-center">
                  <p className="text-[9px] text-zinc-400 font-medium leading-[1] mb-0.5">Download on the</p>
                  <p className="text-[14px] text-white font-bold leading-[1]">App Store</p>
                </div>
              </a>

              {/* Mac App Store */}
              <a href="https://apps.apple.com/us/app/pdf-master-for-mac/id987654321" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-white/20 rounded-xl px-3 py-2.5 transition-all duration-200 group" style={{ background: '#111111' }}>
                <svg viewBox="0 0 384 512" className="w-6 h-6 shrink-0 group-hover:scale-110 transition-transform duration-300 text-white fill-current">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                <div className="flex flex-col justify-center">
                  <p className="text-[9px] text-zinc-400 font-medium leading-[1] mb-0.5">Download on the</p>
                  <p className="text-[14px] text-white font-bold leading-[1]">Mac App Store</p>
                </div>
              </a>

              {/* Microsoft Store */}
              <a href="https://apps.microsoft.com/store/detail/pdf-master/9WZDNCRFJ3PT" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-white/20 rounded-xl px-3 py-2.5 transition-all duration-200 group" style={{ background: '#111111' }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <path fill="#f35325" d="M1.5 1.5h10v10h-10z"/>
                  <path fill="#81bc06" d="M12.5 1.5h10v10h-10z"/>
                  <path fill="#05a6f0" d="M1.5 12.5h10v10h-10z"/>
                  <path fill="#ffba08" d="M12.5 12.5h10v10h-10z"/>
                </svg>
                <div className="flex flex-col justify-center">
                  <p className="text-[9px] text-zinc-400 font-medium leading-[1] mb-0.5">GET IT FROM</p>
                  <p className="text-[14px] text-white font-bold leading-[1]">Microsoft</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} PageDocx by Deepak Prajapati. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://pdf-pro-dx2i.onrender.com/" target="_blank" className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-300 transition-colors">
              <Sparkles size={12} className="text-purple-400" /> Made with PageDocx
            </a>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              Made with <Heart size={11} className="text-red-500 fill-red-500" /> by{" "}
              <span className="text-zinc-300 font-600">Deepak Prajapati & Team</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
