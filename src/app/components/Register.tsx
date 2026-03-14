import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EarthBackground } from "./EarthBackground";
import { Lock, Mail, User, Shield, Leaf, Eye, EyeOff, CheckCircle, MapPin, ChevronRight, Factory, Building2 } from "lucide-react";
import { authApi } from "../../api/client";

// Indian regions matching the 6 monitoring stations (value = DB region, label = display name)
const REGIONS = [
  { value: "Delhi",     label: "Delhi Central Station" },
  { value: "Mumbai",    label: "Mumbai Coastal Station" },
  { value: "Bangalore", label: "Bangalore Tech Park" },
  { value: "Chennai",   label: "Chennai Industrial Zone" },
  { value: "Kolkata",   label: "Kolkata River Station" },
  { value: "Raipur",    label: "Raipur Industrial Station" },
];

type RolePick = "citizen" | "regional_officer" | "industry_user";

export function Register() {
  const navigate = useNavigate();

  const [rolePick, setRolePick] = useState<RolePick | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [region, setRegion] = useState("");
  const [industryName, setIndustryName] = useState("");
  const [industryLocation, setIndustryLocation] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingSuccess, setPendingSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (rolePick === "regional_officer" && !region.trim()) { setError("Please select your region."); return; }
    if (rolePick === "industry_user") {
      if (!industryName.trim()) { setError("Please enter your industry name."); return; }
      if (!industryLocation.trim()) { setError("Please enter your industry location."); return; }
      if (!region.trim()) { setError("Please select your region."); return; }
    }

    setIsLoading(true);
    setError("");
    try {
      await authApi.register({
        name,
        email,
        password,
        role: rolePick!,
        region: (rolePick === "regional_officer" || rolePick === "industry_user") ? region : undefined,
        industry_name: rolePick === "industry_user" ? industryName : undefined,
        industry_location: rolePick === "industry_user" ? industryLocation : undefined,
      });

      if (rolePick === "citizen") {
        navigate("/login");
      } else {
        setPendingSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pending success screen ──
  if (pendingSuccess) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <EarthBackground />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div
              className="rounded-2xl border p-8 text-center backdrop-blur-xl"
              style={{ background: "var(--prithvi-panel-bg)", borderColor: "var(--prithvi-border-bright)" }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(0,255,136,0.12)", border: "2px solid var(--prithvi-aurora-green)" }}
              >
                <CheckCircle className="w-8 h-8 prithvi-text-aurora" />
              </motion.div>
              <h2 className="text-xl font-bold font-mono mb-2 prithvi-text-aurora">
                Application Submitted!
              </h2>
              {rolePick === "industry_user" ? (
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--prithvi-atmospheric-teal)" }}>
                  Your Industry User registration for{" "}
                  <strong className="prithvi-text-electric">{industryName}</strong> ({region}) is pending admin review.
                  You'll be able to log in once an admin approves your account.
                </p>
              ) : (
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--prithvi-atmospheric-teal)" }}>
                  Your Regional Officer registration for{" "}
                  <strong className="prithvi-text-electric">{region}</strong> is pending admin review.
                  You'll be able to log in once an admin approves your account.
                </p>
              )}
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ background: "var(--prithvi-aurora-green)", color: "#000" }}
              >
                Back to Login <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const inputStyle = {
    borderColor: "var(--prithvi-border-dim)",
    background: "var(--prithvi-glass)",
  };
  const inputClass = "w-full pl-11 pr-4 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none";
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = "var(--prithvi-electric-cyan)");
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = "var(--prithvi-border-dim)");

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <EarthBackground />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-7">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg prithvi-gradient-earth prithvi-glow-aurora flex items-center justify-center border prithvi-border-aurora">
                  <Shield className="w-7 h-7 prithvi-text-aurora" />
                </div>
                <h1 className="text-4xl font-bold font-mono prithvi-holo-text">PrithviNet</h1>
              </div>
              <h2 className="text-lg font-mono tracking-wider prithvi-text-electric">
                {rolePick === null
                  ? "CREATE ACCOUNT"
                  : rolePick === "citizen"
                  ? "CITIZEN SIGN UP"
                  : rolePick === "regional_officer"
                  ? "REGIONAL OFFICER APPLICATION"
                  : "INDUSTRY USER APPLICATION"}
              </h2>
              <p className="text-sm mt-1 opacity-60 prithvi-text-forest">
                Join India's environmental guardian network
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="backdrop-blur-xl rounded-2xl border p-7"
            style={{ background: "var(--prithvi-panel-bg)", borderColor: "var(--prithvi-border-bright)" }}
          >
            <AnimatePresence mode="wait">

              {/* ── Step 1: Role picker ── */}
              {rolePick === null && (
                <motion.div
                  key="picker"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <p className="text-xs font-mono tracking-wider mb-4 text-center prithvi-text-electric opacity-70">
                    SELECT ACCOUNT TYPE
                  </p>

                  {/* Citizen */}
                  <button
                    onClick={() => setRolePick("citizen")}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all group"
                    style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--prithvi-aurora-green)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--prithvi-border-dim)")}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(0,255,136,0.12)", border: "1px solid var(--prithvi-aurora-green)" }}>
                      <Leaf className="w-5 h-5 prithvi-text-aurora" />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono font-semibold text-sm prithvi-text-aurora">Citizen</div>
                      <div className="text-xs opacity-60 prithvi-text-electric mt-0.5">
                        Report violations · Join the community
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 prithvi-text-electric opacity-40 group-hover:opacity-80 transition-opacity" />
                  </button>

                  {/* Regional Officer */}
                  <button
                    onClick={() => setRolePick("regional_officer")}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all group"
                    style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--prithvi-electric-cyan)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--prithvi-border-dim)")}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(0,200,255,0.12)", border: "1px solid var(--prithvi-electric-cyan)" }}>
                      <Shield className="w-5 h-5" style={{ color: "var(--prithvi-electric-cyan)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono font-semibold text-sm" style={{ color: "var(--prithvi-electric-cyan)" }}>
                        Regional Officer
                      </div>
                      <div className="text-xs opacity-60 prithvi-text-electric mt-0.5">
                        Monitor regional data · Requires admin approval
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 prithvi-text-electric opacity-40 group-hover:opacity-80 transition-opacity" />
                  </button>

                  {/* Industry User */}
                  <button
                    onClick={() => setRolePick("industry_user")}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all group"
                    style={{ background: "var(--prithvi-glass)", borderColor: "var(--prithvi-border-dim)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--prithvi-warm-amber)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--prithvi-border-dim)")}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(255,167,38,0.12)", border: "1px solid var(--prithvi-warm-amber)" }}>
                      <Factory className="w-5 h-5" style={{ color: "var(--prithvi-warm-amber)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono font-semibold text-sm" style={{ color: "var(--prithvi-warm-amber)" }}>
                        Industry User
                      </div>
                      <div className="text-xs opacity-60 prithvi-text-electric mt-0.5">
                        Compliance data · Sector-specific access · Requires admin approval
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 prithvi-text-electric opacity-40 group-hover:opacity-80 transition-opacity" />
                  </button>

                  <div className="text-center pt-3 border-t" style={{ borderColor: "var(--prithvi-border-dim)" }}>
                    <span className="text-sm prithvi-text-electric opacity-60">Already have an account? </span>
                    <Link to="/login" className="text-sm font-mono prithvi-text-aurora hover:opacity-80 transition-opacity">
                      Sign In
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Registration form ── */}
              {rolePick !== null && (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => { setRolePick(null); setError(""); }}
                    className="text-xs font-mono opacity-50 hover:opacity-80 transition-opacity prithvi-text-electric"
                  >
                    ← Change account type
                  </button>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-mono tracking-wider mb-1.5 prithvi-text-electric">FULL NAME</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                      <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Your full name" required
                        className={inputClass} style={{ ...inputStyle }} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-mono tracking-wider mb-1.5 prithvi-text-electric">EMAIL ADDRESS</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com" required
                        className={inputClass} style={{ ...inputStyle }} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>

                  {/* Industry fields — industry_user only */}
                  {rolePick === "industry_user" && (
                    <>
                      <div>
                        <label className="block text-xs font-mono tracking-wider mb-1.5" style={{ color: "var(--prithvi-warm-amber)" }}>
                          INDUSTRY NAME
                        </label>
                        <div className="relative">
                          <Factory className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--prithvi-warm-amber)" }} />
                          <input type="text" value={industryName} onChange={e => setIndustryName(e.target.value)}
                            placeholder="e.g. Steel Plant, Cement Factory" required
                            className={inputClass} style={{ ...inputStyle }} onFocus={onFocus} onBlur={onBlur} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-mono tracking-wider mb-1.5" style={{ color: "var(--prithvi-warm-amber)" }}>
                          INDUSTRY LOCATION
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" style={{ color: "var(--prithvi-warm-amber)" }} />
                          <input type="text" value={industryLocation} onChange={e => setIndustryLocation(e.target.value)}
                            placeholder="e.g. MIDC, Pune" required
                            className={inputClass} style={{ ...inputStyle }} onFocus={onFocus} onBlur={onBlur} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Region — regional_officer or industry_user */}
                  {(rolePick === "regional_officer" || rolePick === "industry_user") && (
                    <div>
                      <label className="block text-xs font-mono tracking-wider mb-1.5"
                             style={{ color: rolePick === "industry_user" ? "var(--prithvi-warm-amber)" : "var(--prithvi-electric-cyan)" }}>
                        {rolePick === "industry_user" ? "REGION (MONITORING ZONE)" : "YOUR REGION"}
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"
                                style={{ color: rolePick === "industry_user" ? "var(--prithvi-warm-amber)" : "var(--prithvi-electric-cyan)" }} />
                        <select value={region} onChange={e => setRegion(e.target.value)} required
                          className="w-full pl-11 pr-4 py-3 rounded-lg border font-mono text-sm transition-all outline-none appearance-none"
                          style={{
                            ...inputStyle,
                            color: region
                              ? (rolePick === "industry_user" ? "var(--prithvi-warm-amber)" : "var(--prithvi-electric-cyan)")
                              : "var(--prithvi-atmospheric-teal)",
                          }}
                          onFocus={onFocus} onBlur={onBlur}
                        >
                          <option value="" disabled style={{ background: "#0d1f10" }}>Select region…</option>
                          {REGIONS.map(r => (
                            <option key={r.value} value={r.value} style={{ background: "#0d1f10", color: "var(--prithvi-electric-cyan)" }}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-mono tracking-wider mb-1.5 prithvi-text-electric">PASSWORD</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                      <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 6 characters" required
                        className="w-full pl-11 pr-11 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none"
                        style={{ ...inputStyle }} onFocus={onFocus} onBlur={onBlur} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 prithvi-text-electric">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-mono tracking-wider mb-1.5 prithvi-text-electric">CONFIRM PASSWORD</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                      <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password" required
                        className="w-full pl-11 pr-11 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none"
                        style={{ ...inputStyle }} onFocus={onFocus} onBlur={onBlur} />
                      {confirmPassword && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {password === confirmPassword
                            ? <CheckCircle className="w-4 h-4 prithvi-text-aurora" />
                            : <Lock className="w-4 h-4 opacity-20 prithvi-text-electric" />}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Approval notice */}
                  {(rolePick === "regional_officer" || rolePick === "industry_user") && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-mono"
                         style={{
                           background: rolePick === "industry_user" ? "rgba(255,167,38,0.07)" : "rgba(0,200,255,0.07)",
                           borderLeft: `3px solid ${rolePick === "industry_user" ? "var(--prithvi-warm-amber)" : "var(--prithvi-electric-cyan)"}`,
                           color: "var(--prithvi-atmospheric-teal)",
                         }}>
                      {rolePick === "industry_user"
                        ? <Factory className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--prithvi-warm-amber)" }} />
                        : <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--prithvi-electric-cyan)" }} />}
                      Your application will be reviewed by an admin before you can log in.
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-lg border text-xs font-mono text-center"
                         style={{ background: "rgba(211,47,47,0.1)", borderColor: "var(--prithvi-critical-red)", color: "var(--prithvi-critical-red)" }}>
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 rounded-lg font-mono font-bold tracking-wider text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: rolePick === "citizen"
                        ? "var(--prithvi-aurora-green)"
                        : rolePick === "industry_user"
                        ? "var(--prithvi-warm-amber)"
                        : "var(--prithvi-electric-cyan)",
                      color: "#000",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <motion.div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                        CREATING ACCOUNT...
                      </>
                    ) : rolePick === "citizen" ? (
                      <><Leaf className="w-4 h-4" /> JOIN AS CITIZEN</>
                    ) : rolePick === "industry_user" ? (
                      <><Factory className="w-4 h-4" /> SUBMIT APPLICATION</>
                    ) : (
                      <><Shield className="w-4 h-4" /> SUBMIT APPLICATION</>
                    )}
                  </motion.button>

                  <div className="text-center pt-2 border-t" style={{ borderColor: "var(--prithvi-border-dim)" }}>
                    <span className="text-sm prithvi-text-electric opacity-60">Already have an account? </span>
                    <Link to="/login" className="text-sm font-mono prithvi-text-aurora hover:opacity-80 transition-opacity">
                      Sign In
                    </Link>
                  </div>
                </motion.form>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
