import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EarthBackground } from "./EarthBackground";
import { Lock, Mail, User, Leaf, Eye, EyeOff, CheckCircle } from "lucide-react";
import { authApi } from "../../api/client";

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await authApi.register({ name, email, password, role: "citizen" });
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                     style={{ borderColor: "#00ff88", background: "#00ff8815" }}>
                  <Leaf className="w-6 h-6" style={{ color: "#00ff88" }} />
                </div>
                <h1 className="text-4xl font-bold font-mono prithvi-holo-text">PrithviNet</h1>
              </div>
              <h2 className="text-lg font-mono tracking-widest prithvi-text-electric">
                CITIZEN PORTAL — SIGN UP
              </h2>
              <p className="text-sm mt-2 opacity-60 prithvi-text-forest">
                Join India's environmental guardian network
              </p>
            </motion.div>
          </div>

          {/* Form panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="backdrop-blur-xl rounded-2xl border p-8"
            style={{ background: "var(--prithvi-panel-bg)", borderColor: "var(--prithvi-border-bright)" }}
          >
            <form onSubmit={handleRegister} className="space-y-5">

              {/* Name */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  FULL NAME
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none"
                    style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}
                    onFocus={e => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                    onBlur={e => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none"
                    style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}
                    onFocus={e => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                    onBlur={e => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full pl-11 pr-11 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none"
                    style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}
                    onFocus={e => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                    onBlur={e => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 prithvi-text-electric"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-50" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full pl-11 pr-11 py-3 rounded-lg border font-mono text-sm transition-all prithvi-text-electric bg-transparent outline-none"
                    style={{ borderColor: "var(--prithvi-border-dim)", background: "var(--prithvi-glass)" }}
                    onFocus={e => (e.target.style.borderColor = "var(--prithvi-electric-cyan)")}
                    onBlur={e => (e.target.style.borderColor = "var(--prithvi-border-dim)")}
                  />
                  {confirmPassword && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {password === confirmPassword
                        ? <CheckCircle className="w-4 h-4" style={{ color: "var(--prithvi-aurora-green)" }} />
                        : <Lock className="w-4 h-4 opacity-20 prithvi-text-electric" />}
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="p-3 rounded-lg border text-xs font-mono text-center"
                  style={{
                    background: "rgba(211,47,47,0.1)",
                    borderColor: "var(--prithvi-critical-red)",
                    color: "var(--prithvi-critical-red)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-lg font-mono font-bold tracking-wider text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#00ff88", color: "#000" }}
              >
                {isLoading ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    CREATING ACCOUNT...
                  </>
                ) : (
                  <>
                    <Leaf className="w-4 h-4" />
                    JOIN AS CITIZEN
                  </>
                )}
              </motion.button>

              {/* Login link */}
              <div className="text-center pt-3 border-t" style={{ borderColor: "var(--prithvi-border-dim)" }}>
                <span className="text-sm prithvi-text-electric opacity-60">Already have an account? </span>
                <Link to="/login" className="text-sm font-mono prithvi-text-aurora hover:opacity-80 transition-opacity">
                  Sign In
                </Link>
              </div>
            </form>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 text-center text-xs font-mono opacity-40 prithvi-text-electric"
          >
            Your account will have Citizen access • Report violations instantly
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
