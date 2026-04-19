"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SEVERITY_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  High:    { badge: "bg-error-container/20 border-tertiary-container/30",  dot: "bg-tertiary shadow-[0_0_8px_#ffb4ab]",  label: "text-tertiary" },
  Medium:  { badge: "bg-[#f59e0b]/10 border-[#f59e0b]/20",                dot: "bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]", label: "text-[#f59e0b]" },
  Low:     { badge: "bg-[#22c55e]/10 border-[#22c55e]/15",                dot: "bg-[#22c55e] shadow-[0_0_8px_#22c55e]", label: "text-[#22c55e]" },
  Unknown: { badge: "bg-surface-container-high border-outline-variant/20", dot: "bg-white/40",                            label: "text-white/40" },
};

interface DemoResult {
  harassment_type: string;
  severity: string;
  suggested_action: string;
  summary: string;
  complaint_points: string[];
}

const FALLBACK: DemoResult = {
  harassment_type: "Threat",
  severity: "High",
  suggested_action: "Immediate Action",
  summary: "The message contains explicit threats of physical harm directed at the user, constituting a cognizable offence.",
  complaint_points: [
    "Explicit threat of physical violence",
    "Sent via social media platform",
    "Repeated harassment pattern",
  ],
};

export default function DemoResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<DemoResult>(FALLBACK);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("saveher_result");
      if (raw) setResult(JSON.parse(raw));
    } catch {
      // use fallback
    }
  }, []);

  const severity = result.severity ?? "Unknown";
  const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.Unknown;

  return (
    <>
      {/* ─── Demo banner ────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 bg-[#7c6af7] py-2 px-4">
        <span className="material-symbols-outlined text-sm text-white" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
        <span className="text-xs font-bold tracking-widest text-white uppercase">Demo Mode — Mock Analysis Result</span>
        <button
          onClick={() => router.push("/login")}
          className="ml-4 px-3 py-1 bg-white text-[#7c6af7] rounded text-[10px] font-extrabold uppercase tracking-widest hover:bg-white/90 transition-colors"
        >
          Sign In for Real Analysis →
        </button>
      </div>

      <header className="fixed top-8 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)]">
        <nav className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-white">SaveHer AI</Link>
          <div className="hidden md:flex gap-8 items-center">
            <Link className="font-semibold text-sm tracking-tight text-white/60 hover:text-white transition-colors duration-300" href="/">Features</Link>
            <Link className="font-semibold text-sm tracking-tight text-white border-b-2 border-[#7c6af7] pb-1" href="#">Demo Result</Link>
          </div>
          <Link href="/login">
            <button className="bg-gradient-to-br from-primary to-primary-container px-6 py-2.5 rounded-lg text-white font-extrabold text-sm active:scale-95 duration-200">
              Get Protected
            </button>
          </Link>
        </nav>
      </header>

      <main className="pt-36 pb-20 px-6 max-w-5xl mx-auto min-h-screen">

        {/* ── Severity header ── */}
        <div className="mt-4 flex flex-col items-center text-center">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 ${styles.badge}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`}></span>
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${styles.label}`}>
              {severity} Severity Alert
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6">
            {result.harassment_type}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl font-normal leading-relaxed opacity-60">
            {result.summary}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-16">

          {/* Summary card */}
          <div className="md:col-span-8 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-4">Summary of Analysis</h2>
              <p className="text-xl text-white font-normal leading-snug">{result.summary}</p>
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/10 flex gap-4 overflow-x-auto">
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Severity</span>
                <span className={`text-2xl font-extrabold ${styles.label}`}>{severity}</span>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Type</span>
                <span className="text-2xl font-extrabold text-white">{result.harassment_type}</span>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Action</span>
                <span className="text-2xl font-extrabold text-tertiary">{result.suggested_action}</span>
              </div>
            </div>
          </div>

          {/* Pattern card */}
          <div className="md:col-span-4 bg-surface-container-high rounded-xl overflow-hidden flex flex-col">
            <div className="h-48 bg-surface-container-highest relative">
              <img alt="Data visualization" className="w-full h-full object-cover mix-blend-screen opacity-50" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDR_VdykX6_0uslEV9BsoIOOM1maAXuOkvuiPX2sohm6n5rvGUcYBQoRIydJR-rcYOY1b03VSpZYa65yeF0Kh7FNdf4FMtLPeQUiHHFAnYQFZdQjYoEaDuAvUu0XY2U92r4GRjqEmnTIUNparjzejItrzXwSo2jAAYY-UlFGbQuK4iIEkohPaT8hAqOUNluETWsBHpHH60gd6m01NLDxAMXoMPPD1yUZAgG1pTRAjaqZhvAaF80_8PXZFvgvakuNpZjH4OrU2wGXtc"/>
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high to-transparent"></div>
            </div>
            <div className="p-6">
              <h3 className="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-3">Pattern Match</h3>
              <div className="space-y-4">
                <div className="h-1 bg-surface-container-lowest rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-full shadow-[0_0_10px_rgba(199,191,255,0.4)]"></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-white/80">Threat Signature</span>
                  <span className="text-sm font-bold text-primary">Matched</span>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence points */}
          <div className="md:col-span-5 bg-surface-container-low rounded-xl p-8 border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
              <h3 className="text-lg font-semibold text-white">Evidence Points</h3>
            </div>
            <div className="space-y-3">
              {result.complaint_points.map((point, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface-container-highest rounded-lg">
                  <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
                  <span className="text-sm font-semibold text-white">{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Generate complaint CTA */}
          <div className="md:col-span-7 bg-gradient-to-br from-primary-container/20 to-surface-container-low rounded-xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="z-10">
              <h3 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Want to take action?</h3>
              <p className="text-on-surface-variant/60 max-w-sm mb-8 text-sm">
                Sign in to generate a real legal complaint and save your evidence to your secure vault.
              </p>
              <Link href="/login">
                <button className="bg-gradient-to-br from-primary to-primary-container px-10 py-4 rounded-lg text-white font-extrabold text-lg shadow-[0_20px_50px_rgba(124,106,247,0.3)] active:scale-95 transition-all duration-200">
                  Sign In to Generate Complaint
                </button>
              </Link>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
          </div>

        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-[#0a0a0f]">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full max-w-7xl mx-auto">
          <Link href="/" className="text-lg font-black text-white/80 mb-6 md:mb-0">SaveHer AI</Link>
          <div className="font-normal text-xs text-white/40 uppercase tracking-widest">
            © 2026 SaveHer AI. Protected by The Sentinel&apos;s Veil.
          </div>
        </div>
      </footer>
    </>
  );
}
