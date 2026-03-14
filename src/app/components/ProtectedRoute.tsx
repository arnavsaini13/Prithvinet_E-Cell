import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center prithvi-atmosphere-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--prithvi-electric-cyan)', borderTopColor: 'transparent' }} />
          <p className="text-sm font-mono prithvi-text-electric">AUTHENTICATING...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Role-based routing — enforce correct portal per role
  if (user) {
    const isCitizen = user.role === "citizen";
    // Citizens trying to access the monitoring dashboard → send to citizen portal
    if (isCitizen && location.pathname.startsWith("/dashboard")) {
      return <Navigate to="/citizen-portal" replace />;
    }
    // Non-citizens trying to access citizen portal → send to monitoring dashboard
    if (!isCitizen && location.pathname.startsWith("/citizen-portal")) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
