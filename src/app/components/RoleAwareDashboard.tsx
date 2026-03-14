import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { GlobalMonitor } from "./GlobalMonitor";
import { RegionalDashboard } from "./RegionalDashboard";

/** Renders different dashboard based on the logged-in user's role. */
export function RoleAwareDashboard() {
  const { role } = useAuth();
  if (role === "industry_user") return <Navigate to="/dashboard/warnings" replace />;
  return role === "regional_officer" ? <RegionalDashboard /> : <GlobalMonitor />;
}
