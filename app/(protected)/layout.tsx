import ProtectedRoute from "@/components/ProtectedRoute";
import { ReactNode } from "react";

/**
 * Layout for all protected routes.
 * Wraps children with ProtectedRoute — if unauthenticated, redirects to /login.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
