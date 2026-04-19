"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { generateComplaint, generateShortComplaint, type UserDetails } from "@/lib/services/complaint";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import type { HarassmentAnalysis } from "@/lib/services/ai";

// ── Indian states ────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli",
  "Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const PLATFORMS = ["Instagram","WhatsApp","Facebook","Twitter/X","Telegram","Snapchat","YouTube","Email","SMS","Other"];

const SEVERITY_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  Critical: { badge: "bg-tertiary/20 border-tertiary/40",                dot: "bg-tertiary shadow-[0_0_8px_#ff0000]",  label: "text-tertiary" },
  High:     { badge: "bg-error-container/20 border-tertiary-container/30", dot: "bg-tertiary shadow-[0_0_8px_#ffb4ab]",  label: "text-tertiary" },
  Medium:   { badge: "bg-[#f59e0b]/10 border-[#f59e0b]/20",               dot: "bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]", label: "text-[#f59e0b]" },
  Low:      { badge: "bg-[#22c55e]/10 border-[#22c55e]/15",               dot: "bg-[#22c55e] shadow-[0_0_8px_#22c55e]", label: "text-[#22c55e]" },
  Unknown:  { badge: "bg-surface-container-high border-outline-variant/20", dot: "bg-white/40",                           label: "text-white/40" },
};

const fieldCls = "w-full bg-[#1a1530] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-primary/40 transition-all [color-scheme:dark]";

/** Check if a UserDetails profile is complete enough to skip the modal */
function isProfileComplete(ud: Partial<UserDetails>): boolean {
  return !!(
    ud.fullName?.trim() &&
    ud.age?.trim() &&
    ud.phone?.trim() &&
    ud.address?.trim() &&
    ud.city?.trim() &&
    ud.state?.trim()
  );
}

// ═══════════════════════════════════════════════════════════════════
// "Complete Your Profile" one-time modal
// ═══════════════════════════════════════════════════════════════════
function CompleteProfileModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<UserDetails>;
  onClose: () => void;
  onSave: (ud: UserDetails) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const todayDisplay = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const [ud, setUd] = useState<UserDetails>({
    fullName:     initial.fullName     ?? "",
    age:          initial.age          ?? "",
    email:        initial.email        ?? "",
    phone:        initial.phone        ?? "",
    address:      initial.address      ?? "",
    city:         initial.city         ?? "",
    state:        initial.state        ?? "",
    accusedName:  initial.accusedName  ?? "",
    platform:     initial.platform     ?? "Instagram",
    incidentDate: initial.incidentDate ?? today,
    incidentTime: initial.incidentTime ?? "",
    signatureText:initial.signatureText ?? initial.fullName ?? "",
  });
  const [detecting, setDetecting] = useState(false);
  const [err, setErr] = useState("");

  const set = (field: keyof UserDetails) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setUd((p) => ({ ...p, [field]: e.target.value }));

  const detectLocation = async () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const a = data.address ?? {};
          setUd((p) => ({
            ...p,
            city:  a.city ?? a.town ?? a.village ?? a.district ?? p.city,
            state: a.state ?? p.state,
          }));
          toast.success("Location detected!");
        } catch { toast.error("Could not detect location."); }
        finally { setDetecting(false); }
      },
      () => { toast.error("Location access denied."); setDetecting(false); }
    );
  };

  const handleSave = () => {
    setErr("");
    if (!ud.fullName.trim())                             { setErr("Full name is required."); return; }
    if (!ud.age || Number(ud.age) < 1 || Number(ud.age) > 120) { setErr("Please enter a valid age (1–120)."); return; }
    if (ud.phone.replace(/\D/g, "").length < 10)         { setErr("Enter a valid 10-digit phone number."); return; }
    if (!ud.address.trim())                              { setErr("Street address is required."); return; }
    if (!ud.city.trim())                                 { setErr("City / District is required."); return; }
    if (!ud.state)                                       { setErr("State is required."); return; }
    if (!ud.signatureText?.trim()) ud.signatureText = ud.fullName;
    onSave(ud);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center px-4 overflow-y-auto py-8">
      <div className="bg-[#13101e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl mx-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Complete Your Profile</h2>
            <p className="text-xs text-white/40 mt-0.5">Saved once — auto-filled for all future complaints</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {err && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-red-400 text-sm">error</span>
              <p className="text-sm text-red-400">{err}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Full Name *</label>
              <input className={fieldCls} value={ud.fullName} onChange={set("fullName")} placeholder="As per ID" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Age *</label>
              <input className={fieldCls} type="number" min="1" max="120" value={ud.age} onChange={set("age")} placeholder="e.g. 24" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone * (10 digits)</label>
              <input className={fieldCls} type="tel" value={ud.phone} onChange={set("phone")} placeholder="9876543210" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Street Address *</label>
              <textarea className={fieldCls + " resize-none"} rows={2} value={ud.address} onChange={set("address")} placeholder="House/Flat No., Street, Area, Locality" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">City / District *</label>
              <input className={fieldCls} value={ud.city} onChange={set("city")} placeholder="e.g. Mumbai" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">State *</label>
              <select className={fieldCls} value={ud.state} onChange={set("state")}>
                <option value="">-- Select State --</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <button type="button" onClick={detectLocation} disabled={detecting}
                className="flex items-center gap-1.5 text-primary text-xs font-bold hover:text-white transition-colors disabled:opacity-50">
                {detecting
                  ? <><span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />Detecting…</>
                  : <><span className="material-symbols-outlined text-sm">my_location</span>Detect My Location (auto-fill City &amp; State)</>}
              </button>
            </div>

            <div className="col-span-2 border-t border-white/5 pt-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Signature * (type your name)</label>
              <input className={fieldCls} value={ud.signatureText ?? ""} onChange={set("signatureText")} placeholder="Type full name as signature" />
              {ud.signatureText && (
                <p className="text-xs text-white/30 mt-1 italic pl-1">
                  Preview — Signed: <span className="text-white/50 font-semibold">{ud.signatureText}</span>&nbsp;&nbsp; Date: {todayDisplay}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 font-semibold text-sm hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg">
            <span className="material-symbols-outlined text-sm">gavel</span>
            Save &amp; Generate Complaint →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════
export default function Page() {
  const { user } = useAuth();
  const router = useRouter();

  const [result, setResult]     = useState<HarassmentAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [savedProfile, setSavedProfile] = useState<Partial<UserDetails>>({});
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Quick-fill state on the result page card
  const today = new Date().toISOString().split("T")[0];
  const [platform, setPlatform]         = useState("Instagram");
  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentTime, setIncidentTime] = useState("");
  const [accusedProfile, setAccusedProfile] = useState("");
  const [victimAge, setVictimAge]       = useState("");

  // Load result from session storage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("saveher_result");
      if (raw) setResult(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Load saved profile from Firestore
  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};
      setSavedProfile({
        fullName:      data.fullName ?? user.displayName ?? "",
        age:           data.age ?? "",
        email:         user.email ?? "",
        phone:         data.phone ?? "",
        address:       data.address ?? "",
        city:          data.city ?? "",
        state:         data.state ?? "",
        signatureText: data.signatureText ?? data.fullName ?? user.displayName ?? "",
      });
    } catch { /* silent */ }
    finally { setProfileLoaded(true); }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const severity = result?.severity ?? "Unknown";
  const styles   = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.Unknown;

  // Build a full UserDetails from saved profile + current form fields
  const buildUserDetails = (overrides: Partial<UserDetails> = {}): UserDetails => ({
    fullName:      savedProfile.fullName ?? "",
    age:           savedProfile.age ?? victimAge,
    email:         savedProfile.email ?? user?.email ?? "",
    phone:         savedProfile.phone ?? "",
    address:       savedProfile.address ?? "",
    city:          savedProfile.city ?? "",
    state:         savedProfile.state ?? "",
    accusedName:   overrides.accusedName ?? accusedProfile,
    platform:      overrides.platform ?? platform,
    incidentDate:  overrides.incidentDate ?? incidentDate,
    incidentTime:  overrides.incidentTime ?? incidentTime,
    signatureText: savedProfile.signatureText ?? savedProfile.fullName ?? "",
    ...overrides,
  });

  // Save profile to Firestore
  const saveProfile = async (ud: UserDetails) => {
    if (!user) return;
    const payload = {
      fullName:      ud.fullName,
      age:           ud.age,
      phone:         ud.phone,
      address:       ud.address,
      city:          ud.city,
      state:         ud.state,
      signatureText: ud.signatureText ?? ud.fullName,
    };
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      setSavedProfile({ ...savedProfile, ...payload, email: user.email ?? "" });
    } catch { /* non-critical */ }
  };

  // Core generation function
  const runGeneration = async (ud: UserDetails) => {
    if (!result) return;
    setGenerating(true);
    try {
      toast.loading("Drafting your complaint…", { id: "gen" });
      const [fullComplaint, shortComplaint] = await Promise.all([
        generateComplaint(result, ud),
        generateShortComplaint(result, ud),
      ]);
      toast.success("Complaint generated!", { id: "gen" });
      sessionStorage.setItem("saveher_complaint", fullComplaint);
      sessionStorage.setItem("saveher_short_complaint", shortComplaint);
      sessionStorage.setItem("saveher_applicable_laws", JSON.stringify(result.applicable_laws ?? []));
      sessionStorage.setItem("saveher_user_details", JSON.stringify(ud));
      sessionStorage.setItem("saveher_harassment_type", result.harassment_type ?? "Harassment");
      router.push("/complaint");
    } catch (err) {
      console.error("[Result] generation error:", err);
      toast.error("Failed to generate. Please try again.", { id: "gen" });
    } finally {
      setGenerating(false);
    }
  };

  // Click "Generate Complaint"
  const handleGenerateClick = () => {
    if (!result) { toast.error("No analysis result found. Please analyze a screenshot first."); return; }
    if (!profileLoaded) { toast.loading("Loading profile…"); return; }

    const ud = buildUserDetails({
      accusedName:  accusedProfile,
      platform,
      incidentDate,
      incidentTime,
      age: victimAge || savedProfile.age || "",
    });

    if (isProfileComplete(ud)) {
      // Profile complete — generate immediately
      runGeneration(ud);
    } else {
      // Show one-time profile modal
      setShowModal(true);
    }
  };

  // Modal submit
  const handleModalSave = async (ud: UserDetails) => {
    setShowModal(false);
    await saveProfile(ud);
    // Merge incident fields from current form state
    const final: UserDetails = {
      ...ud,
      accusedName:  ud.accusedName || accusedProfile,
      platform:     ud.platform || platform,
      incidentDate: ud.incidentDate || incidentDate,
      incidentTime: ud.incidentTime || incidentTime,
    };
    await runGeneration(final);
  };

  return (
    <>
      {showModal && (
        <CompleteProfileModal
          initial={{
            ...savedProfile,
            accusedName:  accusedProfile,
            platform,
            incidentDate,
            incidentTime,
            age: victimAge || savedProfile.age || "",
          }}
          onClose={() => setShowModal(false)}
          onSave={handleModalSave}
        />
      )}

      <header className="fixed top-0 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)]">
        <nav className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <div className="text-xl font-extrabold tracking-tighter text-white">SaveHer AI</div>
          <div className="hidden md:flex gap-8 items-center">
            <Link className="font-semibold text-sm tracking-tight text-white/60 hover:text-white transition-colors" href="/">Features</Link>
            <Link className="font-semibold text-sm tracking-tight text-white/60 hover:text-white transition-colors" href="/how-it-works">How it works</Link>
            <Link className="font-semibold text-sm tracking-tight text-white border-b-2 border-[#7c6af7] pb-1" href="/complaint">Report</Link>
          </div>
          <Link href="/profile"><button className="bg-gradient-to-br from-primary to-primary-container px-6 py-2.5 rounded-lg text-white font-extrabold text-sm active:scale-95 duration-200">Get Protected</button></Link>
        </nav>
      </header>

      <main className="pt-24 pb-20 px-6 max-w-5xl mx-auto min-h-screen">

        {/* Header / severity badge */}
        <div className="mt-12 flex flex-col items-center text-center">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 ${styles.badge}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${styles.label}`}>
              {severity} Severity {severity !== "Unknown" ? "Alert" : ""}
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6">
            {result?.harassment_type ?? "Analyzing…"}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl font-normal leading-relaxed opacity-60">
            {result?.summary ?? "Our AI has identified patterns in the uploaded content."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-16">

          {/* Summary card */}
          <div className="md:col-span-8 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-4">Summary of Analysis</h2>
              <p className="text-xl text-white font-normal leading-snug">
                {result?.summary ?? (<span className="opacity-40">No analysis loaded. Please <Link href="/upload" className="text-primary underline">upload evidence</Link> first.</span>)}
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/10 flex gap-4 overflow-x-auto">
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Severity</span>
                <span className={`text-2xl font-extrabold ${styles.label}`}>{severity}</span>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Type</span>
                <span className="text-2xl font-extrabold text-white">{result?.harassment_type ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Action</span>
                <span className="text-2xl font-extrabold text-tertiary">{result?.suggested_action ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Pattern card */}
          <div className="md:col-span-4 bg-surface-container-high rounded-xl overflow-hidden flex flex-col">
            <div className="h-48 bg-surface-container-highest relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Digital threat visualization" className="w-full h-full object-cover mix-blend-screen opacity-50"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDR_VdykX6_0uslEV9BsoIOOM1maAXuOkvuiPX2sohm6n5rvGUcYBQoRIydJR-rcYOY1b03VSpZYa65yeF0Kh7FNdf4FMtLPeQUiHHFAnYQFZdQjYoEaDuAvUu0XY2U92r4GRjqEmnTIUNparjzejItrzXwSo2jAAYY-UlFGbQuK4iIEkohPaT8hAqOUNluETWsBHpHH60gd6m01NLDxAMXoMPPD1yUZAgG1pTRAjaqZhvAaF80_8PXZFvgvakuNpZjH4OrU2wGXtc" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high to-transparent" />
            </div>
            <div className="p-6">
              <h3 className="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-3">Pattern Match</h3>
              <div className="space-y-4">
                <div className="h-1 bg-surface-container-lowest rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-full shadow-[0_0_10px_rgba(199,191,255,0.4)]" />
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
              <h3 className="text-lg font-semibold text-white">Suggested Protocol</h3>
            </div>
            <p className="text-on-surface-variant/60 text-sm leading-relaxed mb-6">
              {result?.suggested_action === "Immediate Action Required" || result?.suggested_action === "Immediate Action"
                ? "We recommend immediate containment. Stop all direct communication and initiate the legal documentation process."
                : result?.suggested_action === "File Police Complaint" || result?.suggested_action === "Report"
                ? "We recommend reporting this incident to the relevant platform and authorities."
                : result?.suggested_action === "Block"
                ? "Block the offender and preserve evidence before taking further steps."
                : "Monitor the situation closely. No immediate escalation required."}
            </p>
            {result?.complaint_points && result.complaint_points.length > 0 ? (
              <div className="space-y-3">
                {result.complaint_points.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 bg-surface-container-highest rounded-lg">
                    <span className="material-symbols-outlined text-sm text-primary mt-0.5 shrink-0">check_circle</span>
                    <span className="text-sm font-semibold text-white">{point}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-highest rounded-lg">
                  <span className="material-symbols-outlined text-sm text-tertiary">block</span>
                  <span className="text-sm font-semibold text-white">Auto-Block Profile</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-highest rounded-lg">
                  <span className="material-symbols-outlined text-sm text-primary">history_edu</span>
                  <span className="text-sm font-semibold text-white">Log Evidence Trail</span>
                </div>
              </div>
            )}
          </div>

          {/* Urgency + platform report */}
          {result?.urgency_note && (
            <div className="md:col-span-7 bg-surface-container-low rounded-xl p-8 border border-outline-variant/10 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest mb-3">Urgency Assessment</h3>
                <p className="text-white/80 text-sm leading-relaxed">{result.urgency_note}</p>
              </div>
              {result?.platform_report_steps && (
                <div>
                  <h3 className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest mb-3">How to Report on Platform</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{result.platform_report_steps}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Generate complaint CTA ── */}
          <div className="md:col-span-12 bg-gradient-to-br from-primary-container/20 to-surface-container-low rounded-xl p-8 relative overflow-hidden">
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
            <div className="z-10 relative">
              <h3 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Need to take action?</h3>
              <p className="text-on-surface-variant/60 mb-1 text-sm">
                Our AI drafts a court-ready FIR complaint (600+ words) + cybercrime.gov.in portal version — zero placeholders, zero brackets.
              </p>
              {profileLoaded && isProfileComplete(savedProfile) && (
                <p className="text-emerald-400 text-xs mb-6 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>check_circle</span>
                  Profile loaded from account — generating instantly.
                  <button onClick={() => setShowModal(true)} className="underline text-white/40 hover:text-white transition-colors ml-1">Edit details</button>
                </p>
              )}
              {(!profileLoaded || !isProfileComplete(savedProfile)) && (
                <p className="text-white/30 text-xs mb-6">Your details will be saved once for all future complaints.</p>
              )}

              {/* Quick incident context form */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Platform</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                    className="bg-surface-container-highest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-primary/40">
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Date of Incident</label>
                  <input type="date" value={incidentDate} max={today} onChange={(e) => setIncidentDate(e.target.value)}
                    className="bg-surface-container-highest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-primary/40 [color-scheme:dark]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Time (Optional)</label>
                  <input type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)}
                    className="bg-surface-container-highest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-primary/40 [color-scheme:dark]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Accused Handle (Optional)</label>
                  <input type="text" value={accusedProfile} onChange={(e) => setAccusedProfile(e.target.value)}
                    placeholder="@username or URL"
                    className="bg-surface-container-highest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-primary/40" />
                </div>
              </div>

              <button onClick={handleGenerateClick} disabled={generating || !result}
                className="bg-gradient-to-br from-primary to-primary-container px-10 py-4 rounded-lg text-white font-extrabold text-lg shadow-[0_20px_50px_rgba(124,106,247,0.3)] active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3">
                {generating ? (
                  <><span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Drafting your complaint…</>
                ) : (
                  <><span className="material-symbols-outlined text-xl">gavel</span>Generate Complaint</>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col md:flex-row gap-6 opacity-40">
          <div className="flex-1 p-6 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/5">
            <h4 className="text-[10px] uppercase font-bold tracking-widest mb-2">Legal Admissibility</h4>
            <p className="text-xs">Generated reports comply with digital evidence standards (ISO/IEC 27037:2012) for preliminary submission.</p>
          </div>
          <div className="flex-1 p-6 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/5">
            <h4 className="text-[10px] uppercase font-bold tracking-widest mb-2">Data Privacy</h4>
            <p className="text-xs">Analysis processed in a secure, zero-knowledge environment. Your profile is stored in your own Firebase account only.</p>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-[#0a0a0f]">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full max-w-7xl mx-auto">
          <div className="text-lg font-black text-white/80 mb-6 md:mb-0">SaveHer AI</div>
          <div className="flex flex-wrap justify-center gap-8 mb-8 md:mb-0">
            <Link className="font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-colors" href="/">Privacy Policy</Link>
            <Link className="font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-colors" href="/">Terms of Service</Link>
            <Link className="font-normal text-xs text-[#7c6af7] uppercase tracking-widest" href="/sos">Emergency Protocol</Link>
          </div>
          <div className="font-normal text-xs text-white/40 uppercase tracking-widest">© 2026 SaveHer AI. Protected by The Sentinel&apos;s Veil.</div>
        </div>
      </footer>
    </>
  );
}
