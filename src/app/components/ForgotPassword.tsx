import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { EarthBackground } from "./EarthBackground";
import { Mail, Shield, ArrowLeft, CheckCircle } from "lucide-react";

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate password reset email
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1500);
  };

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
                PASSWORD RECOVERY
              </h2>
              <p className="text-sm mt-2 opacity-60 prithvi-text-forest">
                Reset your environmental intelligence access credentials
              </p>
            </motion.div>
          </div>

          {/* Form panel */}
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
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <p className="text-sm mb-6 prithvi-text-electric opacity-80">
                    Enter your registered email address and we'll send you instructions to reset your password.
                  </p>
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

                {/* Submit button */}
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
                      SENDING...
                    </span>
                  ) : (
                    'SEND RESET LINK'
                  )}
                </motion.button>

                {/* Back to login */}
                <div className="text-center pt-4 border-t border-opacity-20" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm font-mono prithvi-text-electric hover:prithvi-text-aurora transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Link>
                </div>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full prithvi-gradient-earth prithvi-glow-aurora flex items-center justify-center border prithvi-border-aurora">
                    <CheckCircle className="w-8 h-8 prithvi-text-aurora" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-mono mb-2 prithvi-text-aurora">
                    RESET LINK SENT
                  </h3>
                  <p className="text-sm prithvi-text-electric opacity-80">
                    We've sent password reset instructions to
                  </p>
                  <p className="text-sm font-mono mt-2 prithvi-text-aurora">
                    {email}
                  </p>
                </div>

                <div className="p-4 rounded-lg border-l-4 prithvi-glow-aurora" 
                     style={{ 
                       background: 'var(--prithvi-glass)', 
                       borderLeftColor: 'var(--prithvi-aurora-green)' 
                     }}>
                  <p className="text-xs font-mono prithvi-text-electric">
                    Check your email and follow the link to reset your password. The link expires in 24 hours.
                  </p>
                </div>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-mono prithvi-text-electric hover:prithvi-text-aurora transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </motion.div>
            )}
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
