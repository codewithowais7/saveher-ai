"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wrap any page to require authentication AND email verification.
 * - Redirects to /login if unauthenticated.
 * - Redirects to /verify-email if authenticated but email not verified
 *   AND the user did NOT sign in with Google (Google users are always verified).
 *
 * Uses window.location.replace for redirects to guarantee navigation works
 * regardless of Next.js router state (avoids silent router.replace failures
 * in static-export mode).
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.replace("/login");
      return;
    }
    // Check if signed in with Google — Google accounts are always email-verified
    const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
    if (!isGoogle && !user.emailVerified) {
      window.location.replace("/verify-email");
    }
  }, [user, loading]);

  // Show spinner while auth state is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#c7bfff] animate-spin" />
      </div>
    );
  }

  const isGoogle = user?.providerData.some((p) => p.providerId === "google.com");
  if (!user || (!isGoogle && !user.emailVerified)) return null;

  return <>{children}</>;
}
