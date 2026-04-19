"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function RegisterPage() {
  const { register, sendVerification, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Per-field inline errors
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passError, setPassError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [globalError, setGlobalError] = useState("");

  const clearErrors = () => {
    setNameError("");
    setEmailError("");
    setPassError("");
    setConfirmError("");
    setGlobalError("");
  };

  const validate = (): boolean => {
    clearErrors();
    let valid = true;
    if (!fullName.trim()) { setNameError("Full name is required."); valid = false; }
    if (!email.trim()) { setEmailError("Email address is required."); valid = false; }
    if (password.length < 6) { setPassError("Password must be at least 6 characters."); valid = false; }
    if (password !== confirm) { setConfirmError("Passwords do not match."); valid = false; }
    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // 1. Create account
      const user = await register(email, password);

      // 2. Set display name
      await updateProfile(user, { displayName: fullName.trim() });

      // 3. Send verification email
      await sendVerification();

      // 4. Save user document to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: fullName.trim(),
        email: email.trim(),
        createdAt: new Date(),
        emergencyContacts: [],
      });

      toast.success("Account created — check your inbox for a verification link!");
      router.replace("/verify-email");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      if (message.includes("email-already-in-use")) {
        setEmailError("An account with this email already exists. Sign in instead.");
      } else if (message.includes("invalid-email")) {
        setEmailError("Please enter a valid email address.");
      } else {
        setGlobalError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google registration ──────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success("Account created with Google!");
      router.replace("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (!message.includes("popup-closed-by-user")) {
        toast.error("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden py-12">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#7c6af7]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#c7bfff]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-extrabold tracking-tighter text-[#c7bfff]">
              SaveHer AI
            </span>
          </Link>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/15">
            <span className="w-2 h-2 rounded-full bg-[#7c6af7] pulse-pip shadow-[0_0_8px_#7c6af7]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
              Create Secure Account
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-8 md:p-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
            Create your account
          </h1>
          <p className="text-sm text-white/40 mb-8">
            Already protected?{" "}
            <Link href="/login" className="text-[#c7bfff] hover:text-white transition-colors font-semibold">
              Sign in
            </Link>
          </p>

          {/* Global error */}
          {globalError && (
            <div className="flex items-start gap-3 bg-[#ff544a]/10 border border-[#ff544a]/20 rounded-xl p-4 mb-4">
              <span className="material-symbols-outlined text-[#ff544a] text-sm mt-0.5">error</span>
              <p className="text-sm text-[#ff544a] leading-relaxed">{globalError}</p>
            </div>
          )}

          {/* ── Google button ── */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full h-12 flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-semibold text-sm transition-all active:scale-95 duration-200 disabled:opacity-60 disabled:cursor-not-allowed mb-6"
          >
            {googleLoading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M43.6 20.5H42V20.4H24V27.6H35.3C33.65 32.05 29.4 35.2 24 35.2C17.28 35.2 11.8 29.72 11.8 23C11.8 16.28 17.28 10.8 24 10.8C27.09 10.8 29.9 11.97 32.03 13.89L37.12 8.8C33.73 5.64 29.1 3.6 24 3.6C13.28 3.6 4.6 12.28 4.6 23C4.6 33.72 13.28 42.4 24 42.4C34.72 42.4 43.4 33.72 43.4 23C43.4 22.15 43.47 21.31 43.6 20.5Z" fill="#FFC107"/>
                  <path d="M6.3 14.29L12.27 18.65C13.93 14.44 18.6 11.4 24 11.4C26.95 11.4 29.65 12.49 31.76 14.31L37.13 8.94C33.76 5.74 29.12 3.6 24 3.6C16.23 3.6 9.55 7.97 6.3 14.29Z" fill="#FF3D00"/>
                  <path d="M24 42.4C29.02 42.4 33.6 40.33 36.96 37.04L31.44 31.86C29.53 33.38 27.07 34.2 24 34.2C18.62 34.2 14.38 31.07 12.72 26.64L6.7 31.2C9.91 37.64 16.62 42.4 24 42.4Z" fill="#4CAF50"/>
                  <path d="M43.6 20.5H42V20.4H24V27.6H35.3C34.51 29.83 33.03 31.74 31.44 32.86L31.45 32.85L36.97 38.03C36.57 38.39 43.4 33.4 43.4 23C43.4 22.15 43.47 21.31 43.6 20.5Z" fill="#1976D2"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] uppercase tracking-widest text-white/30">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className={`w-full bg-surface-container-highest border rounded-xl text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30 transition-all ${nameError ? "border-[#ff544a]/40" : "border-white/5"}`}
              />
              {nameError && <p className="text-xs text-[#ff544a] ml-1">{nameError}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`w-full bg-surface-container-highest border rounded-xl text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30 transition-all ${emailError ? "border-[#ff544a]/40" : "border-white/5"}`}
              />
              {emailError && <p className="text-xs text-[#ff544a] ml-1">{emailError}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={`w-full bg-surface-container-highest border rounded-xl text-sm p-4 pr-12 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30 transition-all ${passError ? "border-[#ff544a]/40" : "border-white/5"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {passError && <p className="text-xs text-[#ff544a] ml-1">{passError}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="register-confirm"
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-surface-container-highest border rounded-xl text-sm p-4 pr-12 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30 transition-all ${confirmError ? "border-[#ff544a]/40" : "border-white/5"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showConfirm ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {confirmError && <p className="text-xs text-[#ff544a] ml-1">{confirmError}</p>}
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] text-[#180065] font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-[#180065]/30 border-t-[#180065] animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">shield</span>
                  Create Account
                </>
              )}
            </button>

            <p className="text-[10px] text-white/20 text-center leading-relaxed pt-2">
              By creating an account you agree to our{" "}
              <span className="text-white/40">Terms of Service</span> and{" "}
              <span className="text-white/40">Privacy Policy</span>.
            </p>
          </form>
        </div>

        <p className="text-center text-[10px] text-white/20 uppercase tracking-widest mt-8">
          Protected by The Sentinel&apos;s Veil · End-to-End Encrypted
        </p>
      </div>
    </div>
  );
}
