import { createBrowserRouter } from "react-router";
import { GlobalMonitor } from "./components/GlobalMonitor";
import { AtmosphereView } from "./components/AtmosphereView";
import { OceanView } from "./components/OceanView";
import { BiodiversityView } from "./components/BiodiversityView";
import { PollutionMap } from "./components/PollutionMap";
import { ForecastingAnalytics } from "./components/ForecastingAnalytics";
import { PollutionTimeMachine } from "./components/PollutionTimeMachine";
import { DataArchive } from "./components/DataArchive";
import { Root } from "./components/Root";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { ForgotPassword } from "./components/ForgotPassword";
import { ProtectedRoute } from "./components/ProtectedRoute";

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/dashboard",
    element: <Protected><Root /></Protected>,
    children: [
      { index: true, Component: GlobalMonitor },
      { path: "atmosphere", Component: AtmosphereView },
      { path: "ocean", Component: OceanView },
      { path: "biodiversity", Component: BiodiversityView },
      { path: "pollution-map", Component: PollutionMap },
      { path: "forecasting", Component: ForecastingAnalytics },
      { path: "time-machine", Component: PollutionTimeMachine },
      { path: "data-archive", Component: DataArchive },
    ],
  },
]);
