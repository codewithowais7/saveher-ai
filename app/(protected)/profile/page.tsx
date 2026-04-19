"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove,
} from "firebase/firestore";
import type { EmergencyContact } from "@/lib/services/sos";

// ─── helper: derive initials ──────────────────────────────────────────────────
function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email ? email[0].toUpperCase() : "?";
}

// ─── active section type ──────────────────────────────────────────────────────
type ActiveSection = "personal" | "contacts" | "alerts";

export default function Page() {
  const { user, logout } = useAuth();

  // ── Section navigation ──────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ActiveSection>("contacts");
  const contactsRef = useRef<HTMLDivElement>(null);
  const personalRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>, section: ActiveSection) => {
    setActiveSection(section);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Personal info ───────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameLoading, setNameLoading] = useState(false);

  const handleSaveName = async () => {
    if (!auth.currentUser) return;
    setNameLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      toast.success("Name updated!");
    } catch {
      toast.error("Could not update name. Please try again.");
    } finally {
      setNameLoading(false);
    }
  };

  // ── Emergency contacts ────────────────────────────────────────────────────────
  const MAX_CONTACTS = 4;
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit-inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // ── Alert preferences ───────────────────────────────────────────────────────
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // ── Add-contact form ─────────────────────────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Load Firestore user doc ──────────────────────────────────────────────────
  const loadUserDoc = async () => {
    if (!user) return;
    setLoadingContacts(true);
    setLoadError(false);
    const timer = setTimeout(() => { setLoadingContacts(false); setLoadError(true); }, 5000);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      clearTimeout(timer);
      if (snap.exists()) {
        const data = snap.data();
        setContacts(Array.isArray(data.emergencyContacts) ? data.emergencyContacts : []);
        setEmailAlerts(data.alertPreferences?.email ?? false);
        setSmsAlerts(data.alertPreferences?.sms ?? false);
      } else {
        setContacts([]);
      }
    } catch {
      toast.error("Failed to load profile data.");
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadUserDoc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Add contact ─────────────────────────────────────────────────────────────
  const handleAddContact = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newName.trim()) { setFormError("Full name is required."); return; }
    if (!newRelationship.trim()) { setFormError("Relationship is required."); return; }
    let normalizedPhone = newPhone.trim().replace(/\s+/g, "");
    const digits = normalizedPhone.startsWith("+91") ? normalizedPhone.slice(3).replace(/\D/g, "") : normalizedPhone.replace(/\D/g, "");
    if (digits.length < 10) { setFormError("Phone must be 10 digits (e.g. 9876543210 or +91 9876543210)."); return; }
    normalizedPhone = "+91" + digits.slice(-10);
    if (contacts.length >= MAX_CONTACTS) { toast.error(`Maximum ${MAX_CONTACTS} contacts allowed.`); return; }
    if (!user) return;

    setSaving(true);
    try {
      const newContact: EmergencyContact = {
        id: Date.now().toString(),
        name: newName.trim(),
        relationship: newRelationship.trim(),
        phone: normalizedPhone,
        isPrimary: contacts.length === 0,
      };
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { emergencyContacts: [newContact] });
      } else {
        await updateDoc(userRef, { emergencyContacts: arrayUnion(newContact) });
      }
      toast.success("Contact added successfully!");
      setNewName(""); setNewRelationship(""); setNewPhone("");
      await loadUserDoc();
    } catch {
      toast.error("Could not save, check connection.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete contact ──────────────────────────────────────────────────────────
  const handleDelete = async (contact: EmergencyContact) => {
    if (!user) return;
    setDeletingId(contact.id);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        emergencyContacts: arrayRemove(contact),
      });
      toast.success(`${contact.name} removed.`);
      await loadUserDoc();
    } catch {
      toast.error("Could not save, check connection.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Start editing ───────────────────────────────────────────────────────────
  const startEdit = (contact: EmergencyContact) => {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditRelationship(contact.relationship);
    setEditPhone(contact.phone);
  };

  // ── Save inline edit ─────────────────────────────────────────────────────────
  const handleSaveEdit = async (original: EmergencyContact) => {
    if (!user) return;
    const cleanPhone = editPhone.replace(/\D/g, "");
    if (!editName.trim() || !editRelationship.trim() || cleanPhone.length < 10) {
      toast.error("Please fill all fields correctly.");
      return;
    }
    setEditLoading(true);
    try {
      const updated: EmergencyContact = {
        ...original,
        name: editName.trim(),
        relationship: editRelationship.trim(),
        phone: editPhone.trim(),
      };
      // Replace: remove old, add updated
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { emergencyContacts: arrayRemove(original) });
      await updateDoc(userRef, { emergencyContacts: arrayUnion(updated) });
      toast.success("Contact updated!");
      setEditingId(null);
      await loadUserDoc();
    } catch {
      toast.error("Could not save, check connection.");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Save alert preferences ─────────────────────────────────────────────────
  const saveAlerts = async (emailVal: boolean, smsVal: boolean) => {
    if (!user) return;
    setAlertsLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { alertPreferences: { email: emailVal, sms: smsVal } });
      } else {
        await updateDoc(userRef, { alertPreferences: { email: emailVal, sms: smsVal } });
      }
      toast.success("Alert preferences saved.");
    } catch {
      toast.error("Could not save, check connection.");
    } finally {
      setAlertsLoading(false);
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await logout(); toast.success("Signed out."); }
    catch { toast.error("Sign out failed."); }
  };

  const initials = getInitials(user?.displayName ?? null, user?.email ?? null);

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)]">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-white">SaveHer AI</Link>
          <div className="hidden md:flex items-center gap-8 font-semibold text-sm tracking-tight font-['Inter']">
            <Link className="text-white/60 hover:text-white transition-colors duration-300" href="/">Features</Link>
            <Link className="text-white/60 hover:text-white transition-colors duration-300" href="/how-it-works">How it works</Link>
            <Link className="text-white/60 hover:text-white transition-colors duration-300" href="/complaint">Report</Link>
            <Link className="text-white border-b-2 border-[#7c6af7] pb-1" href="/profile">Profile</Link>
          </div>
          <Link href="/profile">
            <button className="signature-gradient text-on-primary-fixed px-5 py-2 rounded-lg font-extrabold text-sm active:scale-95 duration-200">Get Protected</button>
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Left column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Profile card */}
            <div className="bg-surface-container-low rounded-xl p-8 flex flex-col items-center text-center ghost-border">
              <div className="w-32 h-32 rounded-full signature-gradient flex items-center justify-center text-on-primary-container text-4xl font-extrabold mb-6 shadow-[0_0_30px_rgba(199,191,255,0.2)]">
                {initials}
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-1">
                {user?.displayName ?? <span className="text-white/30 italic text-lg font-normal">Update your name</span>}
              </h1>
              <p className="text-on-surface-variant/60 font-medium mb-8 break-all text-sm">{user?.email ?? ""}</p>

              {/* Nav buttons */}
              <div className="w-full space-y-2">
                <button
                  onClick={() => scrollTo(personalRef, "personal")}
                  className={`w-full flex items-center justify-between p-4 rounded-lg text-white font-semibold text-sm transition-colors ${activeSection === "personal" ? "bg-surface-container-highest" : "bg-surface-container-high hover:bg-surface-container-highest"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">account_circle</span>
                    Personal Info
                  </div>
                  <span className="material-symbols-outlined text-white/20">chevron_right</span>
                </button>

                <button
                  onClick={() => scrollTo(contactsRef, "contacts")}
                  className={`w-full flex items-center justify-between p-4 rounded-lg text-white font-semibold text-sm transition-colors ${activeSection === "contacts" ? "bg-surface-container-highest" : "bg-surface-container-high hover:bg-surface-container-highest"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">shield</span>
                    Emergency Protocols
                  </div>
                  <span className="material-symbols-outlined text-white/20">chevron_right</span>
                </button>

                <button
                  onClick={() => scrollTo(alertsRef, "alerts")}
                  className={`w-full flex items-center justify-between p-4 rounded-lg text-white font-semibold text-sm transition-colors ${activeSection === "alerts" ? "bg-surface-container-highest" : "bg-surface-container-high hover:bg-surface-container-highest"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">notifications</span>
                    Alert Settings
                  </div>
                  <span className="material-symbols-outlined text-white/20">chevron_right</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-high rounded-lg text-tertiary font-semibold text-sm hover:bg-surface-container-highest transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary">logout</span>
                    Sign Out
                  </div>
                  <span className="material-symbols-outlined text-white/20">chevron_right</span>
                </button>
              </div>
            </div>

            {/* System status card */}
            <div className="bg-surface-container-low rounded-xl p-6 ghost-border">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${contacts.length > 0 ? "bg-emerald-500 shadow-emerald-500" : loadingContacts ? "bg-primary shadow-primary" : "bg-amber-500 shadow-amber-500"}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">System Status</span>
              </div>
              {loadingContacts ? (
                <p className="text-sm text-white/40">Loading contacts…</p>
              ) : loadError ? (
                <div>
                  <p className="text-sm text-amber-400 mb-2">Could not load contacts. Tap to retry.</p>
                  <button onClick={loadUserDoc} className="text-xs font-bold text-primary hover:text-white uppercase tracking-widest transition-colors">Retry</button>
                </div>
              ) : contacts.length > 0 ? (
                <p className="text-sm text-emerald-400 leading-relaxed">
                  ✅ {contacts.length} of {MAX_CONTACTS} contacts active. SOS ready.
                </p>
              ) : (
                <p className="text-sm text-amber-400 leading-relaxed">
                  ⚠️ No contacts added. Add contacts to enable SOS alerts.
                </p>
              )}
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-8 space-y-8">

            {/* ── SECTION: Personal Info ──────────────────────────────── */}
            <div ref={personalRef} className="scroll-mt-32">
              <section className="bg-surface-container-low rounded-xl p-8 ghost-border">
                <h2 className="text-lg font-semibold text-white mb-6">Personal Info</h2>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Full Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full bg-surface-container-highest border-none rounded-lg text-sm p-4 focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Email Address</label>
                    <input
                      type="email"
                      value={user?.email ?? ""}
                      readOnly
                      className="w-full bg-surface-container-highest border-none rounded-lg text-sm p-4 text-white/40 outline-none cursor-not-allowed"
                    />
                  </div>
                  <button
                    onClick={handleSaveName}
                    disabled={nameLoading}
                    className="signature-gradient px-6 py-3 rounded-lg text-on-primary-fixed font-extrabold text-sm shadow-lg active:scale-95 duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {nameLoading ? (
                      <><span className="w-4 h-4 rounded-full border-2 border-on-primary-fixed/30 border-t-on-primary-fixed animate-spin" />Saving…</>
                    ) : "Save Name"}
                  </button>
                </div>
              </section>
            </div>

            {/* ── SECTION: Emergency Contacts ─────────────────────────── */}
            <div ref={contactsRef} className="scroll-mt-32">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Emergency Contacts</h2>
                  <div className="flex items-center gap-2">
                    {!loadingContacts && Array.from({ length: MAX_CONTACTS }).map((_, i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < contacts.length ? "bg-primary" : "bg-surface-container-highest"}`} />
                    ))}
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 ml-1">
                      {loadingContacts ? "…" : `${contacts.length} / ${MAX_CONTACTS}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {loadingContacts ? (
                    [0, 1].map((i) => (
                      <div key={i} className="bg-surface-container-high rounded-xl p-5 ghost-border animate-pulse">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-surface-container-highest" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-surface-container-highest rounded w-3/4" />
                            <div className="h-2 bg-surface-container-highest rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : loadError ? (
                    <div className="md:col-span-2 text-center py-8">
                      <p className="text-amber-400 text-sm mb-3">Could not load contacts.</p>
                      <button onClick={loadUserDoc} className="text-xs font-bold text-primary uppercase tracking-widest hover:text-white transition-colors">Tap to retry</button>
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="md:col-span-2 bg-surface-container-high rounded-xl p-8 text-center ghost-border">
                      <span className="material-symbols-outlined text-4xl mb-3 block text-white/20">group_off</span>
                      <p className="text-white/40 text-sm">No emergency contacts yet.</p>
                      <p className="text-white/20 text-xs mt-1">Add your first contact below.</p>
                    </div>
                  ) : (
                    contacts.map((contact) => (
                      <div key={contact.id} className="bg-surface-container-high rounded-xl p-5 ghost-border">
                        {editingId === contact.id ? (
                          /* ── Inline edit mode ── */
                          <div className="space-y-3">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Full name"
                              className="w-full bg-surface-container-highest rounded-lg text-sm px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <input
                              value={editRelationship}
                              onChange={(e) => setEditRelationship(e.target.value)}
                              placeholder="Relationship"
                              className="w-full bg-surface-container-highest rounded-lg text-sm px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <input
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="Phone number"
                              className="w-full bg-surface-container-highest rounded-lg text-sm px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            <div className="flex gap-3 pt-1">
                              <button
                                onClick={() => handleSaveEdit(contact)}
                                disabled={editLoading}
                                className="flex-1 signature-gradient py-2 rounded-lg text-on-primary-fixed font-extrabold text-xs active:scale-95 duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
                              >
                                {editLoading ? <><span className="w-3 h-3 rounded-full border-2 border-on-primary-fixed/30 border-t-on-primary-fixed animate-spin" />Saving…</> : "Save"}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── View mode ── */
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-primary">person</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="font-semibold text-white truncate">{contact.name}</h3>
                                {contact.isPrimary && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-bold tracking-tighter whitespace-nowrap">Primary</span>
                                )}
                              </div>
                              <p className="text-xs text-on-surface-variant/60 mt-0.5">{contact.relationship}</p>
                              <p className="text-xs text-on-surface-variant/60">{contact.phone}</p>
                              <div className="flex gap-3 mt-3">
                                <button
                                  onClick={() => startEdit(contact)}
                                  className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                                >
                                  Edit
                                </button>
                                {deleteConfirmId === contact.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-white/40">Remove {contact.name}?</span>
                                    <button
                                      onClick={() => { setDeleteConfirmId(null); handleDelete(contact); }}
                                      disabled={deletingId === contact.id}
                                      className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                                    >Yes</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors">No</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmId(contact.id)}
                                    disabled={deletingId === contact.id}
                                    className="text-[10px] font-bold uppercase tracking-widest text-tertiary hover:text-red-500 transition-colors disabled:opacity-40 flex items-center gap-1"
                                  >
                                    {deletingId === contact.id ? <><span className="w-2.5 h-2.5 border border-tertiary border-t-transparent rounded-full animate-spin" />Removing…</> : "Remove"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* ── Add contact form ── */}
                {contacts.length >= MAX_CONTACTS ? (
                  <div className="bg-surface-container-low rounded-xl p-6 ghost-border flex items-center gap-4">
                    <span className="material-symbols-outlined text-amber-400">info</span>
                    <p className="text-sm text-amber-400">Maximum {MAX_CONTACTS} contacts reached. Remove one to add another.</p>
                  </div>
                ) : (
                <div className="bg-surface-container-low rounded-xl p-8 ghost-border">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Secure Contact Addition</h3>
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Slot {contacts.length + 1} of {MAX_CONTACTS}</span>
                  </div>
                  <form className="grid grid-cols-1 md:grid-cols-2 gap-5" onSubmit={handleAddContact}>
                    {formError && (
                      <div className="md:col-span-2 flex items-center gap-2 bg-[#ff544a]/10 border border-[#ff544a]/20 rounded-xl px-4 py-3">
                        <span className="material-symbols-outlined text-[#ff544a] text-sm">error</span>
                        <p className="text-sm text-[#ff544a]">{formError}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Full Name</label>
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-lg text-sm p-4 focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/10 outline-none"
                        placeholder="e.g. Priya Sharma"
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Relationship</label>
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-lg text-sm p-4 focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/10 outline-none"
                        placeholder="e.g. Sister, Mother, Friend"
                        type="text"
                        value={newRelationship}
                        onChange={(e) => setNewRelationship(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Phone Number</label>
                      <input
                        className="w-full bg-surface-container-highest border-none rounded-lg text-sm p-4 focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/10 outline-none"
                        placeholder="10-digit number e.g. 9876543210"
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2 pt-2 flex items-center justify-end gap-4">
                      <button
                        className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                        type="button"
                        onClick={() => { setNewName(""); setNewRelationship(""); setNewPhone(""); setFormError(""); }}
                      >
                        Discard
                      </button>
                      <button
                        className="signature-gradient px-8 py-3 rounded-lg text-on-primary-fixed font-extrabold text-sm shadow-lg active:scale-95 duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        type="submit"
                        disabled={saving || contacts.length >= MAX_CONTACTS}
                      >
                        {saving ? (
                          <><span className="w-4 h-4 rounded-full border-2 border-on-primary-fixed/30 border-t-on-primary-fixed animate-spin" />Saving…</>
                        ) : "Authorize Contact"}
                      </button>
                    </div>
                  </form>
                </div>
                )}
              </section>
            </div>

            {/* ── SECTION: Alert Settings ─────────────────────────────── */}
            <div ref={alertsRef} className="scroll-mt-32">
              <section className="bg-surface-container-low rounded-xl p-8 ghost-border">
                <h2 className="text-lg font-semibold text-white mb-6">Alert Settings</h2>
                <div className="space-y-4">
                  {/* Email alerts toggle */}
                  <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-white">Email Alerts</p>
                      <p className="text-xs text-white/40 mt-0.5">Receive incident summaries to your email</p>
                    </div>
                    <button
                      onClick={async () => {
                        const next = !emailAlerts;
                        setEmailAlerts(next);
                        await saveAlerts(next, smsAlerts);
                      }}
                      disabled={alertsLoading}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${emailAlerts ? "bg-primary" : "bg-surface-container-highest"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${emailAlerts ? "translate-x-5" : ""}`} />
                    </button>
                  </div>

                  {/* SMS alerts toggle */}
                  <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-white">SMS Alerts</p>
                      <p className="text-xs text-white/40 mt-0.5">Receive SMS notifications for SOS events</p>
                    </div>
                    <button
                      onClick={async () => {
                        const next = !smsAlerts;
                        setSmsAlerts(next);
                        await saveAlerts(emailAlerts, next);
                      }}
                      disabled={alertsLoading}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${smsAlerts ? "bg-primary" : "bg-surface-container-highest"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${smsAlerts ? "translate-x-5" : ""}`} />
                    </button>
                  </div>

                  {alertsLoading && (
                    <p className="text-xs text-white/30 flex items-center gap-2">
                      <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      Saving preferences…
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* ── Vault info card ─────────────────────────────────────── */}
            <div className="bg-glass rounded-xl p-6 ghost-border flex items-center gap-6">
              <div className="bg-tertiary/10 p-3 rounded-full flex-shrink-0">
                <span className="material-symbols-outlined text-tertiary">privacy_tip</span>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-1">Encrypted Vault Access</h4>
                <p className="text-xs text-on-surface-variant/60 leading-relaxed">
                  Your emergency contacts are stored securely in Firebase Firestore.
                  Only you can access them — authenticated via your account.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="bg-[#0a0a0f] w-full border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full max-w-7xl mx-auto">
          <div className="text-lg font-black text-white/80 mb-6 md:mb-0">SaveHer AI</div>
          <div className="flex flex-wrap justify-center gap-8 mb-8 md:mb-0">
            <Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-opacity duration-300" href="/">Privacy Policy</Link>
            <Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-opacity duration-300" href="/">Terms of Service</Link>
            <Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-opacity duration-300" href="/">Contact Support</Link>
            <Link className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest text-[#7c6af7]" href="/sos">Emergency Protocol</Link>
          </div>
          <div className="font-['Inter'] font-normal text-xs text-white/40 uppercase tracking-widest text-center md:text-right">
            © 2026 SaveHer AI. Protected by The Sentinel&apos;s Veil.
          </div>
        </div>
      </footer>
    </>
  );
}
