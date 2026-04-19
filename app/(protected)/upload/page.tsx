"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { extractTextFromImage } from "@/lib/services/ocr";
import { analyzeHarassment } from "@/lib/services/ai";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/** Format bytes to human-readable size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Page() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // data URL for images
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const acceptFile = useCallback((selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    // Generate image preview if applicable
    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null); // PDF — show icon instead
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0] ?? null);
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Drag & drop handlers ──────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please select an image file first.");
      return;
    }

    setLoading(true);
    try {
      // Step 1 — OCR
      toast.loading("Extracting text from image…", { id: "analyze" });
      let extractedText = "";
      try {
        extractedText = await extractTextFromImage(file);
      } catch {
        toast.error("Couldn't read image, add description manually.", { id: "analyze" });
        // Continue with empty text — user description may be enough
      }

      // Step 2 — AI analysis
      toast.loading("Running AI threat analysis…", { id: "analyze" });
      let result;
      try {
        result = await analyzeHarassment(extractedText, description);
      } catch {
        toast.error("AI service unavailable, please try again.", { id: "analyze" });
        setLoading(false);
        return;
      }

      // Step 3 — Background Save to Firestore (Fire and forget, don't wait for it)
      addDoc(collection(db, "reports"), {
        userId: user?.uid ?? "anonymous",
        imageUrl: "",
        extractedText,
        result,
        createdAt: serverTimestamp(),
      }).catch((err) => console.error("Firestore background save failed:", err));

      toast.success("Analysis complete!", { id: "analyze" });

      // Step 4 — Pass result to /result via sessionStorage
      sessionStorage.setItem("saveher_result", JSON.stringify(result));
      router.push("/result");
    } catch (err) {
      console.error("[Upload] handleAnalyze error:", err);
      toast.error("Analysis failed. Please try again.", { id: "analyze" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>

<nav className="fixed top-0 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)]">
<div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
<div className="text-xl font-extrabold tracking-tighter text-white">SaveHer AI</div>
<div className="hidden md:flex space-x-8 font-['Inter'] font-semibold text-sm tracking-tight items-center">
<Link className="text-white/60 hover:text-white transition-colors duration-300" href="/">Features</Link>
<Link className="text-white/60 hover:text-white transition-colors duration-300" href="/how-it-works">How it works</Link>
<Link className="text-white border-b-2 border-[#7c6af7] pb-1" href="/complaint">Report</Link>
</div>
<Link href="/profile"><button className="bg-[#7c6af7] text-white px-6 py-2 rounded-lg font-extrabold active:scale-95 duration-200 text-sm tracking-tight">
                Get Protected
            </button></Link>
</div>
</nav>

<main className="flex-grow pt-32 pb-20 px-6 relative flex flex-col items-center justify-center">

<div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#7c6af7]/10 rounded-full blur-[120px] -z-10"></div>
<div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-tertiary-container/5 rounded-full blur-[100px] -z-10"></div>
<div className="max-w-2xl w-full text-center mb-12">
<div className="inline-flex items-center space-x-2 mb-6">
<span className="w-2 h-2 rounded-full bg-primary pulse-pip"></span>
<span className="font-['Inter'] font-semibold text-xs text-white/40 uppercase tracking-widest">Neural Analysis Active</span>
</div>
<h1 className="font-headline font-extrabold text-4xl md:text-5xl text-white mb-6 tracking-tighter leading-tight">
                Analyze Potential Threats
            </h1>
<p className="font-body text-white/60 text-lg leading-relaxed">
                Upload evidence or provide context. Our AI Sentinel will scan for digital footprints and potential safety risks in real-time.
            </p>
</div>

<div className="max-w-3xl w-full space-y-6">
<div className="glass-card rounded-[24px] p-8 md:p-12 shadow-2xl relative overflow-hidden">

  {/* Hidden native file input */}
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*,.pdf,.jpg,.jpeg,.png"
    className="hidden"
    onChange={handleFileChange}
  />

<div
  className={`upload-dashed w-full min-h-[320px] flex flex-col items-center justify-center p-8 transition-all duration-300 group cursor-pointer rounded-2xl ${
    isDragging
      ? "border-2 border-[#7c6af7] bg-[#7c6af7]/5 shadow-[0_0_30px_rgba(124,106,247,0.15)]"
      : ""
  }`}
  onClick={() => fileInputRef.current?.click()}
  onDragOver={handleDragOver}
  onDragEnter={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
{!file ? (
  /* ── Empty state ── */
  <>
    <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-6 group-hover:bg-primary-container transition-colors duration-300">
      <span className="material-symbols-outlined text-primary text-3xl">cloud_upload</span>
    </div>
    <h3 className="font-headline font-semibold text-xl text-white mb-2">
      {isDragging ? "Release to upload" : "Drop files to scan"}
    </h3>
    <p className="font-body text-white/40 text-sm mb-6">Upload images or threat documentation (PDF, JPG, PNG)</p>
    <button
      className="px-8 py-3 bg-surface-container-highest text-white font-semibold text-sm rounded-lg hover:bg-surface-bright transition-colors"
      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
    >
      Select Files
    </button>
  </>
) : (
  /* ── File selected preview ── */
  <div className="flex flex-col items-center gap-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
    {preview ? (
      /* Image thumbnail */
      <div className="relative">
        <img
          src={preview}
          alt="Preview"
          loading="lazy"
          className="w-40 h-40 object-cover rounded-xl border border-white/10 shadow-lg"
        />
        <button
          onClick={handleClearFile}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#ff544a] text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
        >
          ×
        </button>
      </div>
    ) : (
      /* PDF icon */
      <div className="relative">
        <div className="w-24 h-24 rounded-xl bg-surface-container-highest border border-primary/20 flex flex-col items-center justify-center gap-1">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">PDF</span>
        </div>
        <button
          onClick={handleClearFile}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#ff544a] text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
        >
          ×
        </button>
      </div>
    )}
    <div className="text-center">
      <p className="text-sm font-semibold text-white/80 truncate max-w-[200px]">{file.name}</p>
      <p className="text-xs text-white/40 mt-1">{formatSize(file.size)}</p>
    </div>
    <button
      className="px-6 py-2 bg-surface-container-highest text-white/60 font-semibold text-xs rounded-lg hover:bg-surface-bright hover:text-white transition-colors"
      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
    >
      Change File
    </button>
  </div>
)}
</div>

<div className="mt-8 space-y-4">
<label className="block font-['Inter'] font-semibold text-xs text-white/40 uppercase tracking-widest mb-2">Additional Description (Optional)</label>
<textarea
  className="w-full bg-surface-container-lowest border-none rounded-xl p-4 text-white placeholder-white/20 focus:ring-1 focus:ring-primary/40 min-h-[120px] transition-all resize-none outline-none"
  placeholder="Describe the situation or paste links for cross-referencing..."
  value={description}
  onChange={(e) => setDescription(e.target.value)}
></textarea>
</div>
</div>

<div className="flex flex-col items-center space-y-4">
<button
  onClick={handleAnalyze}
  disabled={loading}
  className="w-full md:w-auto min-w-[280px] h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-extrabold text-lg rounded-xl flex items-center justify-center space-x-3 active:scale-95 duration-200 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
>
  {loading ? (
    <>
      <span className="w-5 h-5 rounded-full border-2 border-on-primary-fixed/30 border-t-on-primary-fixed animate-spin" />
      <span>Analyzing…</span>
    </>
  ) : (
    <>
      <span className="material-symbols-outlined text-2xl" data-icon="bolt" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
      <span>Analyze Content</span>
    </>
  )}
</button>

<div className="flex items-center space-x-4 opacity-40">
<div className="flex space-x-1">
<div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.1s' }}></div>
<div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.2s' }}></div>
<div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.3s' }}></div>
</div>
<span className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest">
  {file ? "Ready to analyze" : "Waiting for input"}
</span>
</div>
</div>
</div>

<div className="mt-16 flex items-center space-x-8 bg-surface-container-low/50 px-8 py-4 rounded-full border border-white/5">
<div className="flex items-center space-x-3">
<span className="material-symbols-outlined text-primary text-lg" data-icon="encrypted">encrypted</span>
<span className="text-xs font-semibold text-white/60">End-to-End Encrypted</span>
</div>
<div className="w-[1px] h-4 bg-white/10"></div>
<div className="flex items-center space-x-3">
<span className="material-symbols-outlined text-primary text-lg" data-icon="shredder">shuffle</span>
<span className="text-xs font-semibold text-white/60">Auto-delete Post Analysis</span>
</div>
</div>
</main>

<div className="fixed top-0 right-0 w-full h-full pointer-events-none -z-20">
<div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px]">
<img className="w-full h-full object-cover opacity-20 mix-blend-screen" data-alt="Abstract ethereal violet smoke patterns floating in a deep black void with sharp crystalline highlights" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDN0KhhuJnePBV7DXSHRmslBy0ky9Z0mfThfpt8hxxLIokfCNcAdltCxcT6uYAox-xo1YXJskpvtDVxIOP0zgAKrkO0qEaxG5uhVjCQCaXGI6gUph0mElKB5kd8nko_fWNx6SgQJXUWDJku0hN-orilRUhCBYtDIim4g4aDbZ83pp3Y_GdtKnm88C9KYqaEc1izy9zN78oQxlnptSa2XhCSxo9tyNh5qcAbun-j2XJdP2fFewmbIS1URVzCZIBXA1nE71b1GL8hH00"/>
</div>
</div>

<footer className="w-full border-t border-white/5 bg-[#0a0a0f] mt-auto">
<div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full max-w-7xl mx-auto">
<div className="mb-8 md:mb-0">
<div className="text-lg font-black text-white/80 mb-2">SaveHer AI</div>
<div className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest">
                    © 2026 SaveHer AI. Protected by The Sentinel's Veil.
                </div>
</div>
<div className="flex flex-wrap justify-center gap-6 md:gap-12">
<Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-opacity duration-300" href="/">Privacy Policy</Link>
<Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-opacity duration-300" href="/">Terms of Service</Link>
<Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-opacity duration-300" href="/">Contact Support</Link>
<Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest text-[#7c6af7] transition-opacity duration-300" href="/sos">Emergency Protocol</Link>
</div>
</div>
</footer>

    </>
  );
}
