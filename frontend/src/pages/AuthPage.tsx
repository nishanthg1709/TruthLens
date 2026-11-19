import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { VISUAL_ASSETS } from '../constants/assets';
import { useAuth } from '../context/AuthContext';
import { SafeMediaImage } from '../components/ui/ForensicPrimitives';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';

export const AuthPage: React.FC = () => {
  const {
    user,
    authReady,
    signingIn,
    authError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    clearAuthError,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [roleTitle, setRoleTitle] = useState('Digital Forensics Analyst');
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/home';

  useEffect(() => {
    if (authReady && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [authReady, user, navigate, redirectTo]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetNotice(null);
    const ok =
      mode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail({
            email,
            password,
            displayName: displayName.trim() || email.split('@')[0] || 'Investigator',
            organization: organization.trim() || undefined,
            roleTitle: roleTitle.trim() || undefined,
          });
    if (ok) {
      navigate(redirectTo, { replace: true });
    }
  };

  const handleResetPassword = async () => {
    setResetNotice(null);
    const sent = await resetPassword(email);
    if (sent) {
      setResetNotice(`Password reset instructions have been sent to ${email.trim()}.`);
    }
  };

  const handleGoogleContinue = async () => {
    setResetNotice(null);
    const ok = await signInWithGoogle(
      mode === 'signup'
        ? {
            displayName: displayName.trim() || undefined,
            organization: organization.trim() || undefined,
            roleTitle: roleTitle.trim() || undefined,
          }
        : undefined
    );
    if (ok) {
      navigate(redirectTo, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-tl-bg text-tl-text grid grid-cols-1 lg:grid-cols-12">
      {/* Left Editorial Darkroom Column */}
      <div className="hidden lg:flex lg:col-span-6 relative flex-col justify-between p-12 border-r border-tl-border bg-[#07080A] overflow-hidden">
        <SafeMediaImage
          src={VISUAL_ASSETS.heroLab}
          alt="TruthLens optical inspection workbench"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0E] via-[#0B0C0E]/70 to-[#0B0C0E]/55" />

        <div className="relative z-10 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-[#F1F2F4] hover:opacity-90 transition-opacity"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-tl-cyan"
            >
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 1.5V5M12 19V22.5M1.5 12H5M19 12H22.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-lg font-semibold tracking-tight">TruthLens</span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#9EA4B0] hover:text-[#F1F2F4] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Landing</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h1 className="font-display text-3xl xl:text-4xl font-semibold tracking-tight text-[#F1F2F4] leading-tight text-balance">
            Authenticated chain of custody for every examination.
          </h1>
          <p className="text-sm text-[#A5ABB7] leading-relaxed">
            Your investigator account anchors case records, review annotations, and
            exported PDF reports—stored securely in your private cloud workspace.
          </p>

          <div className="border-t border-white/12 pt-5 space-y-2.5 text-xs text-[#A5ABB7]">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-tl-cyan shrink-0" />
              <span>Email & Password or Google Sign-In via Firebase Authentication</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-tl-cyan shrink-0" />
              <span>Owner-isolated Firestore case records with zero-trust rules</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-tl-cyan shrink-0" />
              <span>Local browser Web Crypto SHA-256 hashing before upload</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs font-mono text-[#7C828E]">
          TruthLens Workstation · INNOVEDGE 2026
        </div>
      </div>

      {/* Right Authentication Column */}
      <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-center justify-between lg:justify-end">
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2 text-tl-text font-display font-semibold"
          >
            <span>TruthLens</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-tl-muted hover:text-tl-text transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Landing Page</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: FORENSIC_EASE }}
          className="w-full max-w-md mx-auto my-auto py-8 space-y-6"
        >
          <div className="space-y-2">
            <div className="text-xs text-tl-muted">Investigator Access</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-tl-text">
              {mode === 'login' ? 'Sign in to TruthLens' : 'Create investigator account'}
            </h2>
            <p className="text-sm text-tl-muted leading-relaxed">
              {mode === 'login'
                ? 'Sign in with your email and password or Google account to open your forensic workspace.'
                : 'Register your investigator profile with email and password or continue with Google.'}
            </p>
          </div>

          {/* Interactive Sign In / Sign Up Mode Switcher */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 p-1 rounded-md border border-tl-border bg-tl-bg-secondary text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setResetNotice(null);
                clearAuthError();
              }}
              className={`py-2 rounded font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-tl-panel text-tl-text shadow-xs'
                  : 'text-tl-muted hover:text-tl-text'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup');
                setResetNotice(null);
                clearAuthError();
              }}
              className={`py-2 rounded font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-tl-panel text-tl-text shadow-xs'
                  : 'text-tl-muted hover:text-tl-text'
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="rounded-md border border-tl-alert/45 bg-tl-alert/10 p-3.5 flex items-start gap-2.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-tl-alert shrink-0 mt-0.5" />
              <div className="text-tl-text leading-relaxed">{authError}</div>
            </div>
          )}

          {resetNotice && (
            <div className="rounded-md border border-tl-success/45 bg-tl-success/10 p-3.5 flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-tl-success shrink-0 mt-0.5" />
              <div className="text-tl-text leading-relaxed">{resetNotice}</div>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-medium text-tl-text mb-1.5"
                >
                  Investigator Name
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dr. Meera Nair"
                  className="w-full rounded-md border border-tl-border bg-tl-panel px-3 py-2.5 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-tl-text mb-1.5"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@organization.org"
                className="w-full rounded-md border border-tl-border bg-tl-panel px-3 py-2.5 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-tl-text"
                >
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    disabled={signingIn}
                    onClick={handleResetPassword}
                    className="text-xs text-tl-muted hover:text-tl-text transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'}
                  className="w-full rounded-md border border-tl-border bg-tl-panel px-3 py-2.5 pr-10 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-tl-muted hover:text-tl-text transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div>
                  <label
                    htmlFor="auth-role"
                    className="block text-xs font-medium text-tl-text mb-1.5"
                  >
                    Role / Title
                  </label>
                  <input
                    id="auth-role"
                    type="text"
                    maxLength={100}
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="Digital Forensics Analyst"
                    className="w-full rounded-md border border-tl-border bg-tl-panel px-3 py-2.5 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="auth-org"
                    className="block text-xs font-medium text-tl-text mb-1.5"
                  >
                    Organization (Optional)
                  </label>
                  <input
                    id="auth-org"
                    type="text"
                    maxLength={120}
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Verification Desk / Lab"
                    className="w-full rounded-md border border-tl-border bg-tl-panel px-3 py-2.5 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
                  />
                </div>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={signingIn}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-tl-text text-tl-bg text-sm font-semibold hover:opacity-90 disabled:opacity-55 transition-opacity"
            >
              <span>
                {signingIn
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                    ? 'Sign In with Email'
                    : 'Create Account'}
              </span>
              {!signingIn && <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-tl-border" />
            <span className="px-3 text-[11px] uppercase tracking-wider text-tl-muted">
              or continue with
            </span>
            <div className="flex-1 border-t border-tl-border" />
          </div>

          <motion.button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleContinue}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-tl-border bg-tl-panel text-tl-text text-sm font-medium hover:border-tl-border-strong disabled:opacity-55 transition-colors"
          >
            {/* Google G mark */}
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.3a7.21 7.21 0 0 1 0-4.6V6.6H1.29a12 12 0 0 0 0 10.8l4-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.6l4 3.1c.94-2.84 3.59-4.95 6.71-4.95z"
              />
            </svg>
            <span>{mode === 'login' ? 'Continue with Google' : 'Sign Up with Google'}</span>
          </motion.button>

          <p className="text-xs text-tl-muted leading-relaxed">
            Secured by Firebase Authentication. Only authenticated account owners can read or
            write private case records in their cloud workspace.
          </p>
        </motion.div>

        <div className="text-[11px] text-tl-muted text-center lg:text-left">
          TruthLens provides analytical indicators and limitations, never automated verdicts.
        </div>
      </div>
    </div>
  );
};
