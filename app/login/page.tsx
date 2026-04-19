"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, loginWithGoogle, sendReset } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot-password inline state
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  // ── Email / password login ────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!password) { setError("Please enter your password."); return; }

    setIsLoading(true);
    try {
      const user = await login(email, password);
      // Check email verification — Google users are always verified
      const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
      if (!isGoogle && !user.emailVerified) {
        toast("Please verify your email before signing in.", { icon: "📧" });
        router.replace("/verify-email");
        return;
      }
      toast.success("Welcome back to SaveHer AI");
      router.replace("/");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      if (raw.includes("wrong-password") || raw.includes("invalid-credential")) {
        setError("Incorrect password. Please try again.");
      } else if (raw.includes("user-not-found")) {
        setError("No account found with this email.");
      } else if (raw.includes("too-many-requests")) {
        setError("Too many attempts. Try again later.");
      } else {
        setError(raw || "Authentication failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google login ──────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success("Signed in with Google!");
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

  // ── Forgot password ───────────────────────────────────────────────
  const openForgot = () => {
    setShowForgot(true);
    setResetEmail(email); // pre-fill from login email field
    setResetSuccess(false);
    setResetError("");
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess(false);
    setResetLoading(true);
    try {
      await sendReset(resetEmail);
      setResetSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Reset failed";
      if (message.includes("user-not-found")) {
        setResetError("No account found with that email.");
      } else {
        setResetError(message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#7c6af7]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#ff544a]/5 rounded-full blur-[100px] pointer-events-none" />

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
              Sentinel Access Portal
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-8 md:p-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-white/40 mb-8">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#c7bfff] hover:text-white transition-colors font-semibold">
              Register
            </Link>
          </p>

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

          {/* ── Email / Password form ── */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 bg-[#ff544a]/10 border border-[#ff544a]/20 rounded-xl p-4">
                <span className="material-symbols-outlined text-[#ff544a] text-sm mt-0.5">error</span>
                <p className="text-sm text-[#ff544a] leading-relaxed">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-surface-container-highest border border-white/5 rounded-xl text-sm p-4 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30 transition-all"
              />
            </div>

            {/* Password with show/hide + Forgot link */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-[10px] text-[#c7bfff]/60 hover:text-[#c7bfff] transition-colors uppercase tracking-widest"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container-highest border border-white/5 rounded-xl text-sm p-4 pr-12 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/30 transition-all"
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
            </div>

            {/* ── Forgot password inline panel ── */}
            {showForgot && (
              <div className="bg-surface-container-highest border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white/70">Reset your password</p>
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
                  >
                    Back to login
                  </button>
                </div>
                <form onSubmit={handleResetPassword} className="flex gap-3">
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 bg-surface-container-low border border-white/10 rounded-lg text-sm px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary/40 text-white placeholder:text-white/20"
                  />
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2.5 bg-gradient-to-br from-primary/80 to-primary-container/80 text-white rounded-lg text-xs font-bold disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                  >
                    {resetLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Send Reset Link
                  </button>
                </form>
                {resetSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-4 py-3">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                    <p className="text-xs text-emerald-400">
                      Reset link sent to <span className="font-semibold">{resetEmail}</span>. Check inbox + spam folder.
                    </p>
                  </div>
                )}
                {resetError && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#ff544a] text-sm">error</span>
                    <p className="text-xs text-[#ff544a]">{resetError}</p>
                  </div>
                )}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] text-[#180065] font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-[#180065]/30 border-t-[#180065] animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">lock_open</span>
                  Login
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-white/20 uppercase tracking-widest mt-8">
          Protected by The Sentinel&apos;s Veil · End-to-End Encrypted
        </p>
      </div>
    </div>
  );
}
