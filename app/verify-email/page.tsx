"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, sendVerification, reloadUser, logout } = useAuth();
  const router = useRouter();

  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [checkLoading, setCheckLoading] = useState(false);
  const [notVerifiedMsg, setNotVerifiedMsg] = useState(false);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Resend verification email ────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0) return;
    setResendLoading(true);
    setResendError("");
    try {
      await sendVerification();
      toast.success("Verification email resent! Check your inbox.");
      startCooldown();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend email";
      // Surface the exact Firebase error
      if (msg.includes("too-many-requests")) {
        setResendError("Too many requests. Please wait a few minutes before resending.");
      } else {
        setResendError(msg);
      }
    } finally {
      setResendLoading(false);
    }
  };

  // ── Check if user has verified ────────────────────────────────────
  const handleCheckVerified = async () => {
    setCheckLoading(true);
    setNotVerifiedMsg(false);
    try {
      await reloadUser();
      if (user?.emailVerified) {
        toast.success("Email verified! Welcome to SaveHer AI.");
        router.replace("/");
      } else {
        setNotVerifiedMsg(true);
      }
    } catch {
      toast.error("Could not check verification status. Please try again.");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#7c6af7]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-extrabold tracking-tighter text-[#c7bfff]">SaveHer AI</span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-8 md:p-10 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              mark_email_unread
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-3">
            Verify Your Email
          </h1>

          {/* ── Helpful delivery message ── */}
          <div className="bg-surface-container-highest border border-white/10 rounded-xl p-5 mb-6 text-left space-y-2">
            <p className="text-sm text-white/60 leading-relaxed">
              Email sent to{" "}
              <span className="font-semibold text-[#c7bfff] break-all">
                {user?.email ?? "your email address"}
              </span>
              .
            </p>
            <p className="text-xs text-white/40">If not received within 2 minutes:</p>
            <ul className="text-xs text-white/40 space-y-1 ml-3">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-px">•</span>
                Check your <span className="text-white/60 font-medium">spam / junk</span> folder
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-px">•</span>
                Search for <span className="font-mono text-white/60 text-[11px]">noreply@</span> in your inbox
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-px">•</span>
                Click <span className="text-white/60 font-medium">Resend</span> below
              </li>
            </ul>
          </div>

          {/* Not verified warning */}
          {notVerifiedMsg && (
            <div className="flex items-start gap-3 bg-[#ff544a]/10 border border-[#ff544a]/20 rounded-xl p-4 mb-5 text-left">
              <span className="material-symbols-outlined text-[#ff544a] text-sm mt-0.5">error</span>
              <p className="text-sm text-[#ff544a] leading-relaxed">
                Still not verified. Please click the link in your email first.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {/* Primary CTA — check verification */}
            <button
              onClick={handleCheckVerified}
              disabled={checkLoading}
              className="w-full h-12 bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] text-[#180065] font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-[#180065]/30 border-t-[#180065] animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  I&apos;ve verified, continue
                </>
              )}
            </button>

            {/* Resend with cooldown */}
            <button
              onClick={handleResend}
              disabled={resendLoading || cooldown > 0}
              className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resendLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending…
                </>
              ) : cooldown > 0 ? (
                <>
                  <span className="material-symbols-outlined text-lg opacity-40">schedule</span>
                  Resend in {cooldown}s…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Resend verification email
                </>
              )}
            </button>

            {/* Exact Firebase error from resend */}
            {resendError && (
              <div className="flex items-start gap-2 bg-[#ff544a]/10 border border-[#ff544a]/20 rounded-xl px-4 py-3 text-left">
                <span className="material-symbols-outlined text-[#ff544a] text-sm mt-0.5">error</span>
                <p className="text-xs text-[#ff544a] leading-relaxed">{resendError}</p>
              </div>
            )}

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-2 uppercase tracking-widest"
            >
              Sign out &amp; use different account
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/20 uppercase tracking-widest mt-8">
          Protected by The Sentinel&apos;s Veil · End-to-End Encrypted
        </p>
      </div>
    </div>
  );
}
