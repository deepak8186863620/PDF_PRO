import { useState, useRef, useEffect, useCallback } from "react";
import { PenTool, Type, Upload, RefreshCw, Plus, User, Briefcase, Building2, Eye } from "lucide-react";
import { toast } from "sonner";

const SIG_FONTS = ["Dancing Script", "Great Vibes", "Pacifico", "Satisfy", "Caveat"];

function loadFonts() {
  if (document.getElementById("esign-gf")) return;
  const l = document.createElement("link");
  l.id = "esign-gf"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Satisfy&family=Caveat:wght@700&family=Inter:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
}

export default function ESignCreator({ onSave, prefillName = "" }) {
  const [mode, setMode] = useState("draw");
  const [typedText, setTypedText] = useState("");
  const [font, setFont] = useState(SIG_FONTS[0]);
  const [rawUploadedImg, setRawUploadedImg] = useState(null);
  const [uploadedImg, setUploadedImg] = useState(null);
  const [threshold, setThreshold] = useState(160); // Extraction threshold
  const [hasStrokes, setHasStrokes] = useState(false);
  const [currentDrawDataUrl, setCurrentDrawDataUrl] = useState(null);

  // Profile metadata fields
  const [fullName, setFullName]       = useState(prefillName);
  const [designation, setDesignation] = useState("");
  const [company, setCompany]         = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const canvasRef    = useRef(null);
  const previewRef   = useRef(null);
  const isDrawing    = useRef(false);

  useEffect(() => { loadFonts(); }, []);

  // ── Signature Extraction / OCR ──
  useEffect(() => {
    if (!rawUploadedImg) {
      setUploadedImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      // Create high-res internal canvas for crisp vector-like extraction
      const cvs = document.createElement("canvas");
      cvs.width = img.width;
      cvs.height = img.height;
      const ctx = cvs.getContext("2d");
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = imgData.data;

      // Extract signature by thresholding: remove paper background, darken ink
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue; // skip already transparent pixels
        
        // Calculate grayscale brightness
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        
        if (brightness > threshold) {
          // Turn paper background transparent
          data[i+3] = 0; 
        } else {
          // Convert pen strokes to clean, crisp black (vector-like finish)
          data[i] = 15;     // R
          data[i+1] = 23;   // G
          data[i+2] = 42;   // B
          data[i+3] = 255;  // Solid alpha
        }
      }
      ctx.putImageData(imgData, 0, 0);
      setUploadedImg(cvs.toDataURL("image/png"));
    };
    img.src = rawUploadedImg;
  }, [rawUploadedImg, threshold]);

  // ── Canvas init ──
  const initCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.5;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    setHasStrokes(false);
    setCurrentDrawDataUrl(null);
  }, []);

  useEffect(() => { if (mode === "draw") setTimeout(initCanvas, 60); }, [mode, initCanvas]);

  const getPt = (c, e) => {
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * sx, y: (cy - r.top) * sy };
  };

  const startDraw = (e) => {
    e.preventDefault(); isDrawing.current = true;
    const pt = getPt(canvasRef.current, e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(pt.x, pt.y); setHasStrokes(true);
  };
  const draw = (e) => {
    e.preventDefault(); if (!isDrawing.current) return;
    const pt = getPt(canvasRef.current, e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(pt.x, pt.y); ctx.stroke();
  };
  const stopDraw = (e) => { 
    e.preventDefault(); 
    isDrawing.current = false; 
    if (hasStrokes) {
      setCurrentDrawDataUrl(canvasRef.current.toDataURL("image/png"));
    }
  };

  // ── Typed mode render ──
  const renderTyped = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    if (!typedText.trim()) return;
    ctx.font = `54px "${font}", cursive`;
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(typedText.trim(), c.width / 2, c.height / 2);
  }, [typedText, font]);

  useEffect(() => { if (mode === "type") document.fonts.ready.then(renderTyped); }, [mode, typedText, font, renderTyped]);

  // ── Build the composite signature block as a single data URL ──
  const buildCompositeDataUrl = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Get raw signature image
      let sigSrc = null;
      if (mode === "draw" || mode === "type") {
        sigSrc = canvasRef.current?.toDataURL("image/png");
      } else {
        sigSrc = uploadedImg;
      }
      if (!sigSrc) { reject(new Error("No signature image")); return; }

      const name        = fullName.trim();
      const desg        = designation.trim();
      const comp        = company.trim();

      // Block dimensions
      const W  = 520;
      const SIG_H = 120;  // signature image height
      const PAD = 16;
      const DIVIDER_Y = SIG_H + PAD;
      const nameH      = name ? 28  : 0;
      const metaH      = (desg || comp) ? 20 : 0;
      const H  = DIVIDER_Y + (name ? 4 + nameH : 0) + (metaH ? 4 + metaH : 0) + PAD;

      const offscreen = document.createElement("canvas");
      offscreen.width  = W * 2;  // 2× for retina quality
      offscreen.height = H * 2;
      const ctx = offscreen.getContext("2d");
      ctx.scale(2, 2);

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Draw signature image
      const img = new Image();
      img.onload = () => {
        // Center signature image in top zone
        const aspect = img.naturalWidth / img.naturalHeight;
        const drawH  = Math.min(SIG_H - PAD, 90);
        const drawW  = Math.min(drawH * aspect, W - PAD * 2);
        const imgX   = PAD;
        const imgY   = PAD / 2;
        ctx.drawImage(img, imgX, imgY, drawW, drawH);

        // Divider line
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, DIVIDER_Y);
        ctx.lineTo(W - PAD, DIVIDER_Y);
        ctx.stroke();

        let textY = DIVIDER_Y + PAD;

        // Full name (bold, dark)
        if (name) {
          ctx.font         = `700 16px "Inter", ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle    = "#111827";
          ctx.textAlign    = "left";
          ctx.textBaseline = "top";
          ctx.fillText(name, PAD, textY);
          textY += nameH + 2;
        }

        // Designation & Company (lighter, smaller)
        const meta = [desg, comp].filter(Boolean).join(", ");
        if (meta) {
          ctx.font         = `400 12px "Inter", ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle    = "#6b7280";
          ctx.textAlign    = "left";
          ctx.textBaseline = "top";
          ctx.fillText(meta, PAD, textY);
        }

        resolve(offscreen.toDataURL("image/png", 1.0));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = sigSrc;
    });
  }, [mode, uploadedImg, fullName, designation, company]);

  // ── Save ──
  const handleSave = async () => {
    if (!fullName.trim()) { toast.error("Please enter your full name."); return; }

    if (mode === "draw" && !hasStrokes)   { toast.error("Please draw your signature."); return; }
    if (mode === "type" && !typedText.trim()) { toast.error("Please type your signature."); return; }
    if (mode === "upload" && !uploadedImg)    { toast.error("Please upload a signature image."); return; }

    try {
      const compositeDataUrl = await buildCompositeDataUrl();
      onSave(compositeDataUrl, {
        fullName:    fullName.trim(),
        designation: designation.trim(),
        company:     company.trim(),
      });
    } catch (err) {
      toast.error("Failed to build signature: " + err.message);
    }
  };

  // ── Live preview ──
  const SignatureBlockPreview = () => {
    const rawSig = mode === "upload" ? uploadedImg
      : mode === "draw" ? currentDrawDataUrl
      : mode === "type" ? (typedText ? canvasRef.current?.toDataURL("image/png") : null)
      : null;

    return (
      <div className="bg-white rounded-2xl p-5 shadow-inner border border-zinc-200 min-h-[150px]">
        {/* Signature image area */}
        {rawSig ? (
          <img src={rawSig} alt="signature" className="max-h-[72px] object-contain mb-0" />
        ) : (
          <div className="h-16 flex items-center">
            <span className="text-zinc-300 text-sm italic">Your signature appears here…</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200 mt-3 mb-3" />

        {/* Name */}
        {fullName.trim() ? (
          <p className="font-bold text-gray-900 text-[15px] leading-tight" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {fullName}
          </p>
        ) : (
          <p className="text-gray-300 text-[14px]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>Full Name</p>
        )}

        {/* Designation & Company */}
        {(designation.trim() || company.trim()) && (
          <p className="text-gray-500 text-[12px] mt-0.5" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {[designation.trim(), company.trim()].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6">
        <h3 className="text-white font-bold text-lg mb-1">Create Your Signature Profile</h3>
        <p className="text-zinc-500 text-xs">This will be permanently saved to your profile and reused across all documents.</p>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="flex gap-1 p-1 bg-black/40 rounded-2xl mb-6">
        {[["draw", PenTool, "Draw"], ["type", Type, "Type"], ["upload", Upload, "Upload"]].map(([m, Icon, lbl]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === m ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}>
            <Icon size={14} />{lbl}
          </button>
        ))}
      </div>

      {/* ── Signature Canvas / Upload ── */}
      <div className="mb-6">
        {(mode === "draw" || mode === "type") && (
          <div className="relative rounded-2xl overflow-hidden border border-zinc-700" style={{ background: "#f8f7f2" }}>
            <canvas ref={canvasRef} width={500} height={140} className="w-full touch-none block"
              onMouseDown={mode === "draw" ? startDraw : undefined}
              onMouseMove={mode === "draw" ? draw : undefined}
              onMouseUp={mode === "draw" ? stopDraw : undefined}
              onMouseLeave={mode === "draw" ? stopDraw : undefined}
              onTouchStart={mode === "draw" ? startDraw : undefined}
              onTouchMove={mode === "draw" ? draw : undefined}
              onTouchEnd={mode === "draw" ? stopDraw : undefined}
            />
            {mode === "draw" && !hasStrokes && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-zinc-400 text-sm italic">Sign here…</p>
              </div>
            )}
          </div>
        )}

        {mode === "draw" && (
          <button onClick={initCanvas} className="mt-2 flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-bold transition-colors">
            <RefreshCw size={11} /> Clear
          </button>
        )}

        {mode === "type" && (
          <div className="mt-4 space-y-3">
            <input value={typedText} onChange={e => setTypedText(e.target.value)}
              placeholder="Your name or initials" className="input-field"
              style={{ fontFamily: `"${font}", cursive` }} />
            <div className="flex flex-wrap gap-2">
              {SIG_FONTS.map(f => (
                <button key={f} onClick={() => setFont(f)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${font === f ? "border-violet-500 bg-violet-500/20 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  style={{ fontFamily: `"${f}", cursive` }}>
                  {f.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div className="mt-4 space-y-4">
            <label className="cursor-pointer flex flex-col items-center gap-3 p-8 border border-dashed border-zinc-700 rounded-2xl hover:border-zinc-500 transition-all block">
              {uploadedImg
                ? <div className="bg-white p-2 rounded-xl border border-zinc-200">
                    <img src={uploadedImg} alt="sig" className="max-h-24 object-contain" />
                  </div>
                : <><Upload size={28} className="text-zinc-500" /><span className="text-zinc-400 text-sm text-center">Take a photo of your signature<br/>or upload an image</span></>}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = ev => setRawUploadedImg(ev.target.result); r.readAsDataURL(f);
                }} />
            </label>

            {rawUploadedImg && (
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Extraction Threshold</p>
                  <p className="text-xs text-violet-400 font-bold">{threshold}</p>
                </div>
                <input 
                  type="range" min="50" max="250" value={threshold} 
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-[10px] text-zinc-500">Adjust the slider to remove paper background and make strokes crisp.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Profile Details ── */}
      <div className="space-y-3 mb-6">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Signature Identity</p>

        <div className="relative">
          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Full Name *"
            className="input-field pl-9"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder="Designation (optional)"
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="relative">
            <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Company (optional)"
              className="input-field pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Live Preview ── */}
      <div className="mb-6">
        <button
          onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-xs font-bold transition-colors mb-3"
        >
          <Eye size={13} />
          {showPreview ? "Hide Preview" : "Preview Signature Block"}
        </button>
        {showPreview && (
          <div className="animate-in fade-in slide-in-from-top-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2">Final Signature Block</p>
            <SignatureBlockPreview />
            <p className="text-[10px] text-zinc-600 mt-2">This exact block will be embedded into your PDFs.</p>
          </div>
        )}
      </div>

      <button onClick={handleSave} className="btn-primary w-full justify-center">
        <Plus size={16} /> Save Signature to Profile
      </button>
    </div>
  );
}
