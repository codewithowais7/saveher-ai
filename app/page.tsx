"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { extractTextFromImage } from "@/lib/services/ocr";
import { analyzeHarassment } from "@/lib/services/ai";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

/** Format bytes to human-readable size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Emergency contact type for homepage profile section ─────────────────────
type EContact = { id: string; name: string; relationship: string; phone: string; isPrimary: boolean; };

// Hardcoded demo result for hackathon demo mode
const DEMO_RESULT = {
  harassment_type: "Threat" as const,
  severity: "High" as const,
  suggested_action: "Immediate Action" as const,
  summary:
    "The message contains explicit threats of physical harm directed at the user, constituting a cognizable offence.",
  complaint_points: [
    "Explicit threat of physical violence",
    "Sent via social media platform",
    "Repeated harassment pattern",
  ],
};

export default function Page() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  const handleDemo = () => {
    sessionStorage.setItem('saveher_result', JSON.stringify(DEMO_RESULT));
    router.push('/demo-result');
  };

  // ── Upload State ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState("");
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);

  // ── Profile / contacts state ───────────────────────────────────────────────
  const [contacts, setContacts] = useState<EContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [newCName, setNewCName] = useState("");
  const [newCRelationship, setNewCRelationship] = useState("");
  const [newCPhone, setNewCPhone] = useState("");
  const [contactFormErr, setContactFormErr] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [deletingCId, setDeletingCId] = useState<string | null>(null);

  // ── Demo widget state ─────────────────────────────────────────────────────
  const DEMO_MESSAGES = [
    "System detected pattern-based targeted harassment. Evidence locked.",
    "Analyzing uploaded screenshot for abusive content...",
    "IT Act violation identified. Complaint draft ready.",
    "Threat level assessed. Immediate action recommended.",
  ];
  const [barWidth, setBarWidth] = useState(0);
  const [demoMsgIdx, setDemoMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);

  const acceptFile = useCallback((selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  }, []);

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please select an image file first.");
      return;
    }
    setLoadingAnalyze(true);
    try {
      toast.loading("Extracting text from image…", { id: "analyze" });
      let extractedText = "";
      try {
        extractedText = await extractTextFromImage(file);
      } catch {
        toast.error("Couldn't read image, add description manually.", { id: "analyze" });
      }

      toast.loading("Running AI threat analysis…", { id: "analyze" });
      let result;
      try {
        result = await analyzeHarassment(extractedText, description);
      } catch {
        toast.error("AI service unavailable, please try again.", { id: "analyze" });
        setLoadingAnalyze(false);
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
      sessionStorage.setItem("saveher_result", JSON.stringify(result));
      router.push("/result");
    } catch (err) {
      console.error("[Upload] handleAnalyze error:", err);
      toast.error("Analysis failed. Please try again.", { id: "analyze" });
    } finally {
      setLoadingAnalyze(false);
    }
  };

  useEffect(() => {
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                setActiveTab(entry.target.getAttribute('id') || '');
            }
        });
    }, observerOptions);

    document.querySelectorAll('section[id]').forEach((section) => {
        observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: any, targetId: string) => {
    e.preventDefault();
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        setActiveTab(targetId.substring(1));
    }
  };

  // ── Profile / contacts helpers ─────────────────────────────────────────────
  const getProfileInitials = (name: string | null, email: string | null) => {
    if (name) {
      const p = name.trim().split(" ");
      return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
    }
    return email ? email[0].toUpperCase() : "?";
  };

  const loadContacts = useCallback(async () => {
    if (!user) { setLoadingContacts(false); return; }
    setLoadingContacts(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      setContacts(snap.exists() && Array.isArray(snap.data().emergencyContacts) ? snap.data().emergencyContacts : []);
    } catch { toast.error("Failed to load contacts."); }
    finally { setLoadingContacts(false); }
  }, [user]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // ── Demo widget animations ────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(92), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setDemoMsgIdx((i) => (i + 1) % DEMO_MESSAGES.length);
        setMsgVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CTA helpers ───────────────────────────────────────────────────────────
  const goProtected = () => {
    if (user) router.push("/upload");
    else router.push("/register");
  };
  const goDraft = () => {
    if (!user) { toast.error("Please login to access complaint features"); router.push("/login"); }
    else { toast("Upload a screenshot to generate your real complaint"); router.push("/upload"); }
  };

  const handleAddContactHome = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFormErr("");
    if (!newCName.trim()) { setContactFormErr("Full name is required."); return; }
    if (!newCRelationship.trim()) { setContactFormErr("Relationship is required."); return; }
    const clean = newCPhone.replace(/\D/g, "");
    if (clean.length < 10) { setContactFormErr("Phone must be at least 10 digits."); return; }
    if (contacts.length >= 5) { toast.error("Maximum 5 emergency contacts allowed."); return; }
    if (!user) { toast.error("Sign in to add contacts."); return; }
    setSavingContact(true);
    try {
      const nc: EContact = { id: Date.now().toString(), name: newCName.trim(), relationship: newCRelationship.trim(), phone: newCPhone.trim(), isPrimary: contacts.length === 0 };
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) { await setDoc(ref, { emergencyContacts: [nc] }); }
      else { await updateDoc(ref, { emergencyContacts: arrayUnion(nc) }); }
      toast.success("Contact saved successfully!");
      setNewCName(""); setNewCRelationship(""); setNewCPhone("");
      await loadContacts();
    } catch { toast.error("Could not save contact."); }
    finally { setSavingContact(false); }
  };

  const handleDeleteContactHome = async (c: EContact) => {
    if (!user) return;
    setDeletingCId(c.id);
    try {
      await updateDoc(doc(db, "users", user.uid), { emergencyContacts: arrayRemove(c) });
      toast.success(`${c.name} removed.`);
      await loadContacts();
    } catch { toast.error("Could not remove contact."); }
    finally { setDeletingCId(null); }
  };

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary/30 w-full max-w-[100vw] overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)]">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <a className="text-xl font-extrabold tracking-tighter text-[#c7bfff] cursor-pointer" onClick={(e) => handleScroll(e, '#overview')}>SaveHer AI</a>
          <div className="hidden md:flex gap-8 items-center font-['Inter'] font-semibold text-sm tracking-tight">
            <a onClick={(e) => handleScroll(e, '#overview')} className={`cursor-pointer transition-colors duration-300 pb-1 ${activeTab === 'overview' ? 'text-[#c7bfff] border-b-2 border-[#7c6af7]' : 'text-white/60 hover:text-white'}`}>Overview</a>
            <a onClick={(e) => handleScroll(e, '#features')} className={`cursor-pointer transition-colors duration-300 pb-1 ${activeTab === 'features' ? 'text-[#c7bfff] border-b-2 border-[#7c6af7]' : 'text-white/60 hover:text-white'}`}>Features</a>
            <a onClick={(e) => handleScroll(e, '#how-it-works')} className={`cursor-pointer transition-colors duration-300 pb-1 ${activeTab === 'how-it-works' ? 'text-[#c7bfff] border-b-2 border-[#7c6af7]' : 'text-white/60 hover:text-white'}`}>How it works</a>
            <a onClick={(e) => handleScroll(e, '#report')} className={`cursor-pointer transition-colors duration-300 pb-1 ${activeTab === 'report' ? 'text-[#c7bfff] border-b-2 border-[#7c6af7]' : 'text-white/60 hover:text-white'}`}>Report</a>
            <a onClick={(e) => handleScroll(e, '#profile')} className={`cursor-pointer transition-colors duration-300 pb-1 ${activeTab === 'profile' ? 'text-[#c7bfff] border-b-2 border-[#7c6af7]' : 'text-white/60 hover:text-white'}`}>Profile</a>
          </div>
          <button onClick={goProtected} className="bg-[#7c6af7] text-white px-5 py-2.5 rounded-lg font-extrabold text-sm active:scale-95 duration-200 shadow-lg shadow-primary/20 transition-transform">
            Get Protected
          </button>
        </div>
      </nav>

      <main className="w-full">
        {/* Overview (Hero) Section */}
        <section className="relative pt-32 pb-24 lg:pb-40 px-8 w-full overflow-hidden scroll-mt-20" id="overview">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[600px]">
            <div className="z-10 flex flex-col justify-center order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/15 mb-6 w-max">
                <span className="w-2 h-2 rounded-full bg-[#7c6af7] pulse-pip shadow-[0_0_8px_#7c6af7]"></span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">AI-Powered Safety Platform</span>
              </div>
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-tighter text-white leading-[1.1] mb-8">
                Your shield against <br/>
                <span className="bg-gradient-to-r from-[#7c6af7] to-[#c7bfff] bg-clip-text text-transparent">online harassment</span>
              </h1>
              <p className="text-lg text-white/40 max-w-md mb-10 leading-relaxed">
                Advanced neural monitoring and automated legal documentation for a safer digital footprint. Immediate analysis, zero friction.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] text-on-primary-fixed px-8 py-4 rounded-lg font-extrabold text-sm active:scale-95 duration-200 cursor-pointer inline-block" onClick={() => router.push('/upload')}>
                  Analyze Harassment
                </button>
                <a className="border border-outline-variant/20 text-white/60 px-8 py-4 rounded-lg font-semibold text-sm hover:text-white hover:bg-white/5 transition-all cursor-pointer inline-block" onClick={(e) => handleScroll(e, '#how-it-works')}>
                  See how it works
                </a>
                <a href="/sos" className="bg-tertiary-container text-white px-8 py-4 rounded-lg font-extrabold text-sm active:scale-95 duration-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white pulse-pip"></span>
                  SOS Emergency
                </a>
              </div>
              {/* Demo Mode — skip upload, show mock result instantly */}
              <button
                onClick={handleDemo}
                className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-xs font-semibold tracking-widest uppercase mt-2 group"
              >
                <span className="material-symbols-outlined text-sm group-hover:text-primary transition-colors">play_circle</span>
                Try Demo — See AI result instantly
              </button>
            </div>

            {/* Fixed Right Column Layout Applied Here */}
            <div className="relative w-full flex flex-col gap-6 justify-center items-center z-10 order-2">
              <div className="absolute inset-0 bg-[#7c6af7]/10 blur-[120px] rounded-full -z-10"></div>
              
              <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-2xl w-full max-w-xs md:max-w-sm z-20">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Analysis Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#22c55e]"></span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Live Demo</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-[2000ms] ease-in-out"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-white/60">THREAT LEVEL</span>
                    <span className="text-primary">SEVERE ({barWidth}%)</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/5 min-h-[52px] flex items-center">
                    <p
                      className="text-[12px] text-white/80 font-medium transition-opacity duration-300"
                      style={{ opacity: msgVisible ? 1 : 0 }}
                    >
                      {DEMO_MESSAGES[demoMsgIdx]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-2xl w-full max-w-xs md:max-w-sm z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">description</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-white">IT Act Draft</h4>
                    <p className="text-[10px] text-white/40">Ready for submission</p>
                  </div>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  This is to bring to your notice that on{" "}
                  <span className="text-white/80 font-semibold">[DATE]</span>, the complainant received threatening messages via Instagram constituting offences under{" "}
                  <span className="text-primary font-bold">IT Act 2000 §66A</span> and{" "}
                  <span className="text-primary font-bold">IPC §354D</span>. The content includes explicit threats and targeted harassment. Evidence has been preserved…
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={goDraft}
                    className="flex-1 h-8 border border-primary/30 text-primary rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
                  >
                    Copy Draft
                  </button>
                  <button
                    onClick={goDraft}
                    className="flex-1 h-8 border border-white/10 text-white/40 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <img alt="Abstract digital network visualization" className="absolute w-[150%] h-[150%] object-cover rounded-3xl opacity-20 grayscale mix-blend-screen -z-20 pointer-events-none" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnYhSy2hCStyN9xMw7z38E3e_e0qJZnz8qnkd6JIGAhrwQHuws6RJdt6B2sl-bpDni1aQZMYLdDneXKIeqZ7rcZaqfQcV32uI7W-aABO9k9OxmRp0kEE3nNiMdoICU8dGrj_CDI6KwVDyWAqeFGKIK5pCjAEUb3mIVcalQ7cxsu_pG80-lK2ifaaNcNHDvT33-2xAZ4i48hGqSlz42G7qLHdajXCG3QYqQdR5LW1waRps4dbYVVVy-oQ68XaeFAChPeNA6aQu6kHk" />
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="w-full bg-surface-container-low py-12 border-y border-white/5">
          <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-center md:justify-between gap-12">
            <div className="text-center md:text-left">
              <div className="text-3xl font-extrabold text-white mb-1">2.4s</div>
              <div className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">avg analysis speed</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-extrabold text-white mb-1">100%</div>
              <div className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">privacy guaranteed</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-extrabold text-white mb-1">IT Act</div>
              <div className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">compliant reporting</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-extrabold text-white mb-1">24/7</div>
              <div className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">active monitoring</div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-32 bg-background scroll-mt-20" id="features">
          <div className="max-w-7xl mx-auto px-8">
            <div className="mb-20 text-center">
              <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">Engineered for Absolute Protection</h2>
              <p className="text-white/40 max-w-xl mx-auto">Our multi-layered approach combines linguistic AI with legal intelligence to provide a fortress around your online identity.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="group bg-surface-container-low p-10 rounded-2xl border border-white/[0.03] hover:bg-surface-container-high transition-all duration-500">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#7c6af7] text-3xl">psychology</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Linguistic Neural Shield</h3>
                <p className="text-white/40 text-sm leading-relaxed">Proprietary LLMs trained to detect subtle forms of micro-aggression, gaslighting, and organized harassment patterns across 12 languages.</p>
              </div>
              <div className="group bg-surface-container-low p-10 rounded-2xl border border-white/[0.03] hover:bg-surface-container-high transition-all duration-500">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#7c6af7] text-3xl">gavel</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Auto-Legal Drafting</h3>
                <p className="text-white/40 text-sm leading-relaxed">Instant generation of legally binding complaints formatted precisely for cyber-cell submission and platform-specific takedown requests.</p>
              </div>
              <div className="group bg-surface-container-low p-10 rounded-2xl border border-white/[0.03] hover:bg-surface-container-high transition-all duration-500">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#7c6af7] text-3xl">privacy_tip</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Encrypted Evidence Vault</h3>
                <p className="text-white/40 text-sm leading-relaxed">All detected instances are timestamped and cryptographically locked on local storage, ensuring your data never leaves your control without consent.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="w-full py-32 bg-[#0e0e13] scroll-mt-20 border-y border-white/5" id="how-it-works">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-24">
              <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-surface-container-high border border-outline-variant/20">
                <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">The Protocol</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-8 text-white">
                How It <span className="gradient-text bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] bg-clip-text text-transparent">Works</span>
              </h2>
              <p className="max-w-2xl mx-auto text-xl text-white/60 font-medium leading-relaxed">
                The Veil remains unbroken. Our neural architecture operates in total silence, 
                detecting, analyzing, and neutralizing threats before they reach your digital perimeter.
              </p>
            </div>
            <div className="max-w-5xl mx-auto relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#7c6af7]/0 via-[#7c6af7]/40 to-[#7c6af7]/0 hidden md:block transform -translate-x-1/2"></div>
              <div className="space-y-32">
                <div className="relative flex flex-col md:flex-row items-center justify-between group">
                  <div className="md:w-[45%] text-right order-2 md:order-1 mt-8 md:mt-0">
                    <h3 className="text-3xl font-extrabold text-white mb-4">Detection</h3>
                    <p className="text-white/60 leading-relaxed">Continuous AI monitoring across social architectures. Our sensors identify harassment patterns, linguistic aggressive markers, and systematic stalking behavior in real-time.</p>
                  </div>
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-1 md:order-2">
                    <span className="material-symbols-outlined text-primary text-xl">radar</span>
                  </div>
                  <div className="md:w-[45%] order-3 overflow-hidden rounded-xl border border-white/5">
                    <img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvqUH3_MZiU91WKD49q-N9zUnbgfhrQi-BI6kSyLEJt15komPJc6FtAtqCAQXiohbk4X3hm9LHudYBbgUTemlVCJ1gpClK_FuGGZyFy4JiaQYMeoOFXNqoruCjZ4KF27w3DE7u6RA9i1thSDnr9rVW0cYLqVcXAzWL2ZuONpAEP67tX5_LdKPS7QMae5OqEo80gBtoSBZ4jVb_gKSNgXj_7NUodVFoiifxNQ5m03te9U2owxB_YtnrlhdUfv6r-oDJ24JhoQ99sKY"/>
                  </div>
                </div>

                <div className="relative flex flex-col md:flex-row items-center justify-between group">
                  <div className="md:w-[45%] order-3 md:order-1 overflow-hidden rounded-xl border border-white/5">
                    <img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxQqkrY7jPBEQrGibeVpFNHX87vkJKYcoAlBzw4fPjhMMrs1F3X3WrbzU-tCJsX9uIGUjdL3-mtlvUzAL-dgGVUPHMtHjVGPS38IxwRTe72ARw0zqKvEadduxj5ciRj0C3q2PF1OWP1c4TtWY27wThCmKJIWXbkj-XwAEgLfkYEtP3MkTG_ciUZrj4LqoYd7ZKkE30nAhzEyvYk4CPbJ1M3MSB27rTVyE25gXPh4OBxxrsiT6DJ-KkZQ2wzwQe2VuGJKQZy4mJwck"/>
                  </div>
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-2">
                    <span className="material-symbols-outlined text-primary text-xl">psychology</span>
                  </div>
                  <div className="md:w-[45%] text-left mt-8 md:mt-0 order-1 md:order-3">
                    <h3 className="text-3xl font-extrabold text-white mb-4">Analysis</h3>
                    <p className="text-white/60 leading-relaxed">The Neural Engine evaluates threat escalation levels. It categorizes content based on psychological impact and severity, separating noise from targeted digital violence.</p>
                  </div>
                </div>

                <div className="relative flex flex-col md:flex-row items-center justify-between group">
                  <div className="md:w-[45%] text-right order-2 md:order-1 mt-8 md:mt-0">
                    <h3 className="text-3xl font-extrabold text-white mb-4">Documentation</h3>
                    <p className="text-white/60 leading-relaxed">Automatic generation of legally compliant dossier. Our system maps evidence directly to relevant sections of the IT Act, preparing professional complaint drafts for judicial submission.</p>
                  </div>
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-1 md:order-2">
                    <span className="material-symbols-outlined text-primary text-xl">gavel</span>
                  </div>
                  <div className="md:w-[45%] order-3 overflow-hidden rounded-xl border border-white/5">
                    <img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDGYTo2J3RxjJ5ZHLeWnusrQ-HCVJD2jEUgKHTRFNO4UXtByO1oOH5ros7qbTschVB6DSc45fq_7MBmwvlkQy_Oe_4H9mOmiPtFbL8haMMIZMLpavdyM7k6PCVXWA48L80cTyD3RQER3RSrc9Wi8j3CobbThpJi69qd0RbZ7RoH_fjvx2qxE67k4myVy50hF8KshILyb0eXTYtJz-SVOSo-GRa5I0849X4IXdcTFBtaRP3lRCaZywdGVja2MlE_fVVH4s3mMk1c130"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Report Section */}
        <section className="w-full py-32 bg-background relative overflow-hidden scroll-mt-20" id="report">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#7c6af7]/10 rounded-full blur-[120px] -z-10"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#ff544a]/5 rounded-full blur-[100px] -z-10"></div>
          <div className="max-w-7xl mx-auto px-8 flex flex-col items-center">
            <div className="max-w-2xl w-full text-center mb-12">
              <div className="inline-flex items-center space-x-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-primary pulse-pip"></span>
                <span className="font-['Inter'] font-semibold text-xs text-white/40 uppercase tracking-widest">Neural Analysis Active</span>
              </div>
              <h2 className="font-headline font-extrabold text-4xl md:text-5xl text-white mb-6 tracking-tighter leading-tight">
                Analyze Potential Threats
              </h2>
              <p className="font-body text-white/60 text-lg leading-relaxed">
                Upload evidence or provide context. Our AI Sentinel will scan for digital footprints and potential safety risks in real-time.
              </p>
            </div>
            
            <div className="max-w-3xl w-full space-y-6">
              <div className="glass-panel rounded-[24px] p-8 md:p-12 shadow-2xl relative overflow-hidden border border-white/10">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                />

                <div
                  className={`upload-dashed w-full min-h-[320px] flex flex-col items-center justify-center p-8 transition-all duration-300 group cursor-pointer rounded-2xl ${
                    isDragging
                      ? "border-2 border-[#7c6af7] bg-[#7c6af7]/5 shadow-[0_0_30px_rgba(124,106,247,0.15)]"
                      : "border-2 border-dashed border-[#474554] hover:border-[#7c6af7]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {!file ? (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-6 group-hover:bg-[#8e7fff] transition-colors duration-300">
                        <span className="material-symbols-outlined text-primary text-3xl group-hover:text-white transition-colors">cloud_upload</span>
                      </div>
                      <h3 className="font-headline font-semibold text-xl text-white mb-2">
                        {isDragging ? "Release to upload" : "Drop files to scan"}
                      </h3>
                      <p className="font-body text-white/40 text-sm mb-8">Upload images or threat documentation (PDF, JPG, PNG)</p>
                      <button
                        className="px-8 py-3 bg-surface-container-highest text-white font-semibold text-sm rounded-lg hover:bg-surface-bright transition-colors"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        Select Files
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                      {preview ? (
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
                  disabled={loadingAnalyze}
                  className="min-w-[280px] h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-extrabold text-lg rounded-xl flex items-center justify-center space-x-3 active:scale-95 duration-200 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingAnalyze ? (
                    <>
                      <span className="w-5 h-5 rounded-full border-2 border-on-primary-fixed/30 border-t-on-primary-fixed animate-spin" />
                      <span>Analyzing…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-2xl">bolt</span>
                      <span>Analyze Content</span>
                    </>
                  )}
                </button>
                <div className="flex items-center space-x-4 opacity-40">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                  </div>
                  <span className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest">
                    {file ? "Ready to analyze" : "Waiting for input"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-16 flex items-center space-x-8 bg-surface-container-low/50 px-8 py-4 rounded-full border border-white/5">
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-lg">encrypted</span>
                <span className="text-xs font-semibold text-white/60">End-to-End Encrypted</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10"></div>
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-lg">shuffle</span>
                <span className="text-xs font-semibold text-white/60">Auto-delete Post Analysis</span>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Section (Newly Adappted into Unified) */}
        <section className="w-full py-32 bg-[#0e0e13] scroll-mt-20 border-t border-white/5" id="profile">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Profile Card Left */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-surface-container-low rounded-2xl p-8 flex flex-col items-center text-center border border-white/10 shadow-2xl">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] flex items-center justify-center text-[#25008c] text-4xl font-extrabold mb-6 shadow-[0_0_30px_rgba(199,191,255,0.2)]">
                    {getProfileInitials(user?.displayName ?? null, user?.email ?? null)}
                  </div>
                  <h1 className="text-2xl font-extrabold text-white mb-1">
                    {user?.displayName ?? <span className="text-white/30 italic text-lg font-normal">Update your name</span>}
                  </h1>
                  <p className="text-white/60 font-medium mb-8 break-all text-sm">{user?.email ?? ""}</p>
                  <div className="w-full space-y-3">
                    <Link href="/profile" className="w-full flex items-center justify-between p-4 bg-surface-container-high rounded-xl text-white font-semibold text-sm hover:bg-surface-container-highest transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">account_circle</span>
                        Personal Info
                      </div>
                      <span className="material-symbols-outlined text-white/20">chevron_right</span>
                    </Link>
                    <button className="w-full flex items-center justify-between p-4 bg-surface-container-highest rounded-xl text-white font-semibold text-sm">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">shield</span>
                        Emergency Protocols
                      </div>
                      <span className="material-symbols-outlined text-white/20">chevron_right</span>
                    </button>
                    <Link href="/profile" className="w-full flex items-center justify-between p-4 bg-surface-container-high rounded-xl text-white font-semibold text-sm hover:bg-surface-container-highest transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">notifications</span>
                        Alert Settings
                      </div>
                      <span className="material-symbols-outlined text-white/20">chevron_right</span>
                    </Link>
                  </div>
                </div>
                
                <div className="bg-surface-container-low rounded-xl p-6 border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#c7bfff]"></div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">System Status</span>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    The Sentinel&apos;s Veil is active.{" "}
                    {loadingContacts ? "Loading contacts…" : `Account active · ${contacts.length} contact${contacts.length !== 1 ? "s" : ""} saved.`}
                  </p>
                </div>
              </div>
              
              {/* Contacts & Form Right */}
              <div className="lg:col-span-8 space-y-10">
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Emergency Contacts</h2>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      {loadingContacts ? "…" : `${contacts.length} OF 5 SLOTS FILLED`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {loadingContacts ? (
                      [0, 1].map(i => (
                        <div key={i} className="bg-surface-container-high rounded-2xl p-6 border border-white/5 animate-pulse">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-surface-container-highest" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 bg-surface-container-highest rounded w-3/4" />
                              <div className="h-2 bg-surface-container-highest rounded w-1/2" />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : contacts.length === 0 ? (
                      <div className="md:col-span-2 text-center py-12 text-white/40 text-sm">
                        <span className="material-symbols-outlined text-4xl mb-3 block opacity-20">group_off</span>
                        No emergency contacts yet. Add one below.
                      </div>
                    ) : (
                      contacts.map(contact => (
                        <div key={contact.id} className="bg-surface-container-high rounded-2xl p-6 border border-white/5 flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">person</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-bold text-white truncate">{contact.name}</h3>
                              {contact.isPrimary && (
                                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-black tracking-tighter whitespace-nowrap">Primary</span>
                              )}
                            </div>
                            <p className="text-sm text-white/60 mb-1">{contact.relationship}</p>
                            <p className="text-sm text-white/60 mb-4">{contact.phone}</p>
                            <div className="flex gap-4">
                              <button
                                onClick={() => handleDeleteContactHome(contact)}
                                disabled={deletingCId === contact.id}
                                className="text-[10px] font-bold uppercase tracking-widest text-tertiary hover:text-red-500 transition-colors disabled:opacity-40 flex items-center gap-1"
                              >
                                {deletingCId === contact.id ? <><span className="w-2.5 h-2.5 border border-tertiary border-t-transparent rounded-full animate-spin" />Removing…</> : "Remove"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
                
                <section className="bg-surface-container-low rounded-2xl p-8 md:p-10 border border-white/5">
                  <h2 className="text-xl font-extrabold text-white mb-8">Secure Contact Addition</h2>
                  <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleAddContactHome}>
                    {contactFormErr && (
                      <div className="md:col-span-2 flex items-center gap-2 bg-[#ff544a]/10 border border-[#ff544a]/20 rounded-xl px-4 py-3">
                        <span className="material-symbols-outlined text-[#ff544a] text-sm">error</span>
                        <p className="text-sm text-[#ff544a]">{contactFormErr}</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Full Name *</label>
                      <input value={newCName} onChange={e => setNewCName(e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30" placeholder="e.g. Priya Sharma" type="text"/>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Relationship *</label>
                      <input value={newCRelationship} onChange={e => setNewCRelationship(e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30" placeholder="e.g. Sister, Mother" type="text"/>
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Phone Number * (10 digits)</label>
                      <input value={newCPhone} onChange={e => setNewCPhone(e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30" placeholder="e.g. 9876543210 or +91 98765 43210" type="tel"/>
                    </div>
                    <div className="md:col-span-2 pt-4 flex items-center justify-end gap-6">
                      <button
                        className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                        type="button"
                        onClick={() => { setNewCName(""); setNewCRelationship(""); setNewCPhone(""); setContactFormErr(""); }}
                      >
                        Discard
                      </button>
                      <button
                        className="bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] px-10 py-4 rounded-xl text-[#180065] font-black text-sm shadow-lg shadow-primary/20 active:scale-95 duration-200 disabled:opacity-60 flex items-center gap-2"
                        type="submit"
                        disabled={savingContact || contacts.length >= 5}
                      >
                        {savingContact ? (<><span className="w-4 h-4 rounded-full border-2 border-[#180065]/30 border-t-[#180065] animate-spin" />Saving…</>) : "Authorize Contact"}
                      </button>
                    </div>
                  </form>
                </section>
                
                <div className="bg-surface-container-low/50 rounded-2xl p-6 border border-white/5 flex items-center gap-6">
                  <div className="bg-tertiary/10 p-4 rounded-xl">
                    <span className="material-symbols-outlined text-[#ffb4ab]">privacy_tip</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm mb-1">Encrypted Vault Access</h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Your emergency contacts are securely stored in Firebase. Only you can view or edit your contacts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="max-w-7xl mx-auto px-8 pb-32">
          <div className="relative bg-gradient-to-br from-[#1b1b20] to-[#0a0a0f] rounded-[32px] p-12 md:p-24 overflow-hidden text-center border border-white/5">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#7c6af7]/5 blur-[100px]"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#ff544a]/5 blur-[80px]"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-8 tracking-tighter">Your digital peace of mind starts here.</h2>
              <p className="text-lg text-white/40 mb-12">Join 10,000+ users who have regained control over their social media experience.</p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <button onClick={(e) => handleScroll(e, '#profile')} className="w-full md:w-auto bg-white text-background px-10 py-5 rounded-xl font-extrabold text-base hover:bg-[#c7bfff] transition-colors duration-300">
                  Create Private Account
                </button>
                <button className="w-full md:w-auto text-white/80 font-semibold flex items-center gap-2 group">
                  Contact Support 
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-white/5 bg-[#0a0a0f] py-12 px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="text-lg font-bold text-white/80">SaveHer AI</div>
            <p className="font-['Inter'] text-sm text-white/40">© 2026 SaveHer AI. Engineered for the Veil.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 font-['Inter'] text-sm">
            <Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">Privacy Policy</Link>
            <Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">Terms of Service</Link>
            <Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">Security Audit</Link>
            <Link className="text-[#7c6af7] font-semibold hover:text-[#c7bfff] transition-colors" href="/sos">Emergency Protocol</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
