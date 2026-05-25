import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import FileUpload from "./FileUpload";
import ESignCreator from "./ESignCreator";
import ESignEditor from "./ESignEditor";
import ProcessingOverlay from "./ProcessingOverlay";
import { Download, FileSignature, User, Briefcase, Building2, PenLine, Share2, CheckCircle2 } from "lucide-react";
import { auth, db, collection, addDoc, Timestamp, doc, getDoc, setDoc } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function ESignTool({ onBack }) {
  const [files, setFiles]               = useState([]);
  const [signatureData, setSignatureData] = useState(null); // composite base64 PNG
  const [sigProfile, setSigProfile]     = useState(null);   // { fullName, designation, company }
  const [showEditor, setShowEditor]     = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultFile, setResultFile]     = useState(null);
  const [user]                          = useAuthState(auth);

  const [savedSignature, setSavedSignature]       = useState(null);
  const [loadingSavedSig, setLoadingSavedSig]     = useState(false);

  // ── Load saved profile signature ──
  useEffect(() => {
    async function loadSignature() {
      try {
        const guestRaw = localStorage.getItem("pdf_master_guest_sig");
        if (guestRaw) setSavedSignature(JSON.parse(guestRaw));
      } catch {}

      if (user) {
        setLoadingSavedSig(true);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc    = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().savedSignature) {
            setSavedSignature(userDoc.data().savedSignature);
          }
        } catch (err) {
          console.error("Error fetching user signature:", err);
        } finally {
          setLoadingSavedSig(false);
        }
      }
    }
    loadSignature();
  }, [user]);

  const handleFilesAdded  = (newFiles) => setFiles(prev => [...prev, ...newFiles]);
  const handleFileRemoved = (index) => { setFiles(prev => prev.filter((_, i) => i !== index)); setResultFile(null); };

  // ── Save newly created signature to profile ──
  const handleSaveSignature = async (compositeDataUrl, profile) => {
    setSignatureData(compositeDataUrl);

    const newSig = {
      dataUrl:     compositeDataUrl,
      fullName:    profile.fullName,
      designation: profile.designation,
      company:     profile.company,
      updatedAt:   Timestamp.now(),
    };

    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { savedSignature: newSig }, { merge: true });
        setSavedSignature(newSig);
        toast.success("Signature saved to your profile permanently!");
      } catch (err) {
        console.error("Error saving signature:", err);
        toast.error("Could not save signature to profile.");
      }
    } else {
      try {
        localStorage.setItem("pdf_master_guest_sig", JSON.stringify(newSig));
        setSavedSignature(newSig);
        toast.info("Signature saved locally.");
      } catch {}
    }

    setSigProfile(profile);
    setShowEditor(true);
    toast.success("Signature ready! Click on the PDF to place it.");
  };

  // ── Use the already-saved profile signature ──
  const handleUseSavedSignature = () => {
    if (!savedSignature) return;
    setSignatureData(savedSignature.dataUrl);
    setSigProfile({
      fullName:    savedSignature.fullName    ?? "",
      designation: savedSignature.designation ?? "",
      company:     savedSignature.company     ?? "",
    });
    setShowEditor(true);
    toast.success("Using your saved signature!");
  };

  // ── Embed signature into PDF via backend ──
  const handleApplySignature = async (formattedSigs) => {
    setShowEditor(false);
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("files", files[0]);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("File upload failed.");
      const { files: uploadedFiles } = await uploadRes.json();
      const fileId = uploadedFiles[0].id;

      const res = await fetch("/api/pdf/esign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, signatures: formattedSigs }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "E-Sign request failed.");
      }

      const result = await res.json();
      setResultFile(result);

      if (user) {
        try {
          await addDoc(collection(db, "history"), {
            userId:      user.uid,
            toolId:      "E-Sign",
            fileName:    result.name || "signed.pdf",
            fileSize:    result.size || 0,
            timestamp:   Timestamp.now(),
            downloadUrl: `/api/download/${result.id}`,
          });
        } catch {}
      }

      toast.success("PDF signed & encrypted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "An error occurred while signing the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultFile) return;
    const link  = document.createElement("a");
    link.href   = `/api/download/${resultFile.id}`;
    link.setAttribute("download", resultFile.name || "signed.pdf");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Saved Signature Card Preview ──
  const SavedSigCard = () => (
    <div className="glass-card rounded-3xl p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <CheckCircle2 size={18} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-base leading-tight">Saved Signature Profile</h3>
          <p className="text-zinc-500 text-xs mt-0.5">This signature will be applied to your document.</p>
        </div>
      </div>

      {/* Signature block preview — white card like DocuSign */}
      <div className="bg-white rounded-2xl p-5 shadow-inner border border-zinc-100 mx-auto max-w-[380px]">
        {/* Signature image */}
        <img
          src={savedSignature.dataUrl}
          alt="Saved Signature"
          className="max-h-[80px] object-contain mb-0"
          style={{ maxWidth: "100%" }}
        />
        {/* Divider */}
        <div className="border-t border-gray-200 mt-3 mb-3" />
        {/* Name */}
        {savedSignature.fullName && (
          <p className="font-bold text-gray-900 text-[15px] leading-tight" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {savedSignature.fullName}
          </p>
        )}
        {/* Designation & Company */}
        {(savedSignature.designation || savedSignature.company) && (
          <p className="text-gray-500 text-[12px] mt-0.5" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {[savedSignature.designation, savedSignature.company].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      {/* Profile meta pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {savedSignature.fullName && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium">
            <User size={11} /> {savedSignature.fullName}
          </span>
        )}
        {savedSignature.designation && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium">
            <Briefcase size={11} /> {savedSignature.designation}
          </span>
        )}
        {savedSignature.company && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium">
            <Building2 size={11} /> {savedSignature.company}
          </span>
        )}
      </div>

      <button
        onClick={handleUseSavedSignature}
        className="btn-primary w-full justify-center gap-2 py-3.5"
      >
        <FileSignature size={16} />
        Proceed to Sign Document
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      {isProcessing && <ProcessingOverlay progress={50} status="Embedding your digital signature securely…" />}

      {/* ── Editor overlay ── */}
      {showEditor && signatureData && files.length > 0 && (
        <ESignEditor
          file={files[0]}
          signatureData={signatureData}
          sigProfile={sigProfile}
          onClose={() => setShowEditor(false)}
          onSave={handleApplySignature}
        />
      )}

      {/* ── Main UI ── */}
      {!resultFile ? (
        <div className="space-y-6">
          <FileUpload
            files={files}
            onFilesAdded={handleFilesAdded}
            onFileRemoved={handleFileRemoved}
            accept={{ "application/pdf": [".pdf"] }}
            multiple={false}
          />

          {files.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              {loadingSavedSig ? (
                <div className="glass-card rounded-3xl p-8 max-w-2xl mx-auto text-center">
                  <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">Loading your signature profile…</p>
                </div>
              ) : savedSignature ? (
                <SavedSigCard />
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                      <PenLine size={20} className="text-violet-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Set Up Your Signature Profile</h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      Create your professional signature once — it's saved permanently to your profile and reused on all future documents.
                    </p>
                  </div>
                  <ESignCreator
                    onSave={handleSaveSignature}
                    prefillName={user?.displayName ?? ""}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Success card ── */
        <div className="glass-card rounded-3xl p-8 text-center max-w-md mx-auto space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
            <FileSignature size={28} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Document Signed!</h3>
            <p className="text-xs text-zinc-500 mt-1">Encrypted & locked. Ready for download or sharing.</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 uppercase tracking-wider font-bold">Document:</span>
              <span className="text-zinc-300 font-bold max-w-[180px] truncate">{files[0]?.name}</span>
            </div>
            {savedSignature?.fullName && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 uppercase tracking-wider font-bold">Signed by:</span>
                <span className="text-zinc-300 font-bold">{savedSignature.fullName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={handleDownload} className="btn-primary w-full justify-center gap-2">
              <Download size={16} />
              Download Signed PDF
            </button>
            <button
              onClick={() => { setFiles([]); setResultFile(null); setSignatureData(null); }}
              className="px-6 py-3 rounded-full text-zinc-500 hover:text-white text-xs font-bold transition-colors"
            >
              Sign another document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
