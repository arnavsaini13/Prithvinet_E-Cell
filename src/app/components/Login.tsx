import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EarthBackground } from "./EarthBackground";
import { Lock, Mail, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const roles = [
  { id: 'admin', name: 'Admin', description: 'Full system access' },
  { id: 'industry', name: 'Industry User', description: 'Sector-specific data' },
  { id: 'citizen', name: 'Citizen', description: 'Public environmental data' },
];

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      // Citizens go to their own portal — all other roles go to the monitoring dashboard
      const role = localStorage.getItem("prithvinet_role");
      navigate(role === "citizen" ? "/citizen-portal" : "/dashboard");
    } catch (err: any) {
      if (err.message === "pending_approval") {
        setIsPending(true);
        setError('');
      } else {
        setIsPending(false);
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <EarthBackground />
      
      {/* Content overlay */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          {/* Logo and header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg prithvi-gradient-earth prithvi-glow-aurora flex items-center justify-center border prithvi-border-aurora">
                  <Shield className="w-7 h-7 prithvi-text-aurora" />
                </div>
                <h1 className="text-4xl font-bold font-mono prithvi-holo-text">
                  PrithviNet
                </h1>
              </div>
              <h2 className="text-xl font-mono tracking-wider prithvi-text-electric">
                ENVIRONMENTAL INTELLIGENCE ACCESS
              </h2>
              <p className="text-sm mt-2 opacity-60 prithvi-text-forest">
                India environmental monitoring and analysis system
              </p>
            </motion.div>
          </div>

          {/* Login form panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="backdrop-blur-xl rounded-2xl border p-8 prithvi-card-layered prithvi-inner-glow prithvi-elevation-3"
            style={{
              background: 'var(--prithvi-panel-bg)',
              borderColor: 'var(--prithvi-border-bright)',
            }}
          >
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Role selector */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  ACCESS ROLE
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    className="w-full px-4 py-3 rounded-lg border prithvi-input-field font-mono text-sm flex items-center justify-between transition-all"
                    style={{
                      background: 'var(--prithvi-glass)',
                      borderColor: isRoleDropdownOpen ? 'var(--prithvi-border-bright)' : 'var(--prithvi-border-dim)',
                    }}
                  >
                    <div className="text-left">
                      <div className="prithvi-text-aurora font-medium">
                        {selectedRoleData?.name}
                      </div>
                      <div className="text-xs opacity-60 prithvi-text-electric mt-0.5">
                        {selectedRoleData?.description}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 prithvi-text-electric transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  {isRoleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-0 right-0 mt-2 rounded-lg border backdrop-blur-xl overflow-hidden z-20 prithvi-elevation-2"
                      style={{
                        background: 'var(--prithvi-panel-bg-solid)',
                        borderColor: 'var(--prithvi-border-bright)',
                      }}
                    >
                      {roles.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            setSelectedRole(role.id);
                            setIsRoleDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-opacity-50 transition-all border-b border-opacity-20 ${
                            selectedRole === role.id ? 'prithvi-glow-aurora' : ''
                          }`}
                          style={{
                            background: selectedRole === role.id ? 'var(--prithvi-glass)' : 'transparent',
                            borderColor: 'var(--prithvi-border-dim)',
                          }}
                        >
                          <div className={selectedRole === role.id ? 'prithvi-text-aurora' : 'prithvi-text-electric'}>
                            {role.name}
                          </div>
                          <div className="text-xs opacity-60 prithvi-text-forest mt-0.5">
                            {role.description}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Email input */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-60" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@prithvinet.earth"
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-lg border prithvi-input-field font-mono text-sm transition-all"
                    style={{
                      background: 'var(--prithvi-glass)',
                      borderColor: 'var(--prithvi-border-dim)',
                    }}
                  />
                </div>
              </div>

              {/* Password input */}
              <div>
                <label className="block text-xs font-mono tracking-wider mb-2 prithvi-text-electric">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 prithvi-text-electric opacity-60" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-lg border prithvi-input-field font-mono text-sm transition-all"
                    style={{
                      background: 'var(--prithvi-glass)',
                      borderColor: 'var(--prithvi-border-dim)',
                    }}
                  />
                </div>
              </div>

              {/* Forgot password link */}
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-mono prithvi-text-electric hover:prithvi-text-aurora transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Pending approval notice */}
              {isPending && (
                <div className="p-3 rounded-lg border text-xs font-mono text-center"
                     style={{ background: 'rgba(245,124,0,0.1)', borderColor: '#f57c00', color: '#ffb74d' }}>
                  ⏳ Your account is pending admin approval. You'll be able to log in once approved.
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg border text-xs font-mono text-center"
                     style={{ background: 'rgba(211, 47, 47, 0.1)', borderColor: 'var(--prithvi-critical-red)', color: 'var(--prithvi-critical-red)' }}>
                  {error}
                </div>
              )}

              {/* Login button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-lg font-mono tracking-wider prithvi-gradient-earth prithvi-glow-aurora border prithvi-border-aurora transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    AUTHENTICATING...
                  </span>
                ) : (
                  'ENTER SYSTEM'
                )}
              </motion.button>

              {/* Register link */}
              <div className="text-center pt-4 border-t border-opacity-20" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                <span className="text-sm prithvi-text-electric opacity-60">
                  New to PrithviNet?{' '}
                </span>
                <Link
                  to="/register"
                  className="text-sm font-mono prithvi-text-aurora hover:opacity-80 transition-opacity"
                >
                  Request Access
                </Link>
              </div>
            </form>
          </motion.div>

          {/* Footer info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-xs font-mono opacity-50 prithvi-text-electric"
          >
            Secure connection • 256-bit encryption • ISO 27001 certified
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
