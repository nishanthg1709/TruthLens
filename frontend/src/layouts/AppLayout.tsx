import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  AudioWaveform,
  BookOpen,
  ChevronDown,
  Columns2,
  Command,
  FilePlus2,
  FileText,
  Film,
  FolderKanban,
  HardDrive,
  History,
  Image as ImageIcon,
  LogOut,
  Menu,
  Moon,
  Network,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Type,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useForensic } from '../context/ForensicContext';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';
import { ConfirmModal, StatusLabel } from '../components/ui/ForensicPrimitives';

type PrimarySection = 'home' | 'labs' | 'cases' | 'records' | 'system';

interface RouteDestination {
  label: string;
  shortLabel: string;
  to: string;
  section: PrimarySection;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  devStatus?: 'Under Development' | 'Not Yet Available';
}

const ALL_DESTINATIONS: RouteDestination[] = [
  {
    label: 'Workspace Home',
    shortLabel: 'Home',
    to: '/home',
    section: 'home',
    icon: Command,
    keywords: 'home start overview workbench drop image',
  },
  {
    label: 'Image Forensics Lab',
    shortLabel: 'Image Lab',
    to: '/image-forensics',
    section: 'labs',
    icon: ImageIcon,
    keywords: 'image photo exif ela noise fft 4x4 grid forensics',
  },
  {
    label: 'Video Forensics Lab',
    shortLabel: 'Video',
    to: '/video-forensics',
    section: 'labs',
    icon: Film,
    keywords: 'video frame temporal integrity manipulation',
    devStatus: 'Under Development',
  },
  {
    label: 'Audio Forensics Lab',
    shortLabel: 'Audio',
    to: '/audio-forensics',
    section: 'labs',
    icon: AudioWaveform,
    keywords: 'audio waveform synthetic speech manipulation integrity',
    devStatus: 'Under Development',
  },
  {
    label: 'Text & Context Analysis',
    shortLabel: 'Text & Context',
    to: '/text-analysis',
    section: 'labs',
    icon: Type,
    keywords: 'text diff claims statements context',
  },
  {
    label: 'Cross-Modal Analysis',
    shortLabel: 'Cross-Modal',
    to: '/cross-modal',
    section: 'labs',
    icon: Network,
    keywords: 'cross modal correlation multimodal verification',
    devStatus: 'Not Yet Available',
  },
  {
    label: 'Evidence Comparison',
    shortLabel: 'Comparison',
    to: '/comparison',
    section: 'labs',
    icon: Columns2,
    keywords: 'compare side by side overlay difference hash',
  },
  {
    label: 'Active Case Workspace',
    shortLabel: 'Workspace',
    to: '/workspace',
    section: 'cases',
    icon: FolderKanban,
    keywords: 'workspace case investigation notes custody',
  },
  {
    label: 'New Investigation',
    shortLabel: 'New Case',
    to: '/new-investigation',
    section: 'cases',
    icon: FilePlus2,
    keywords: 'create new case investigation intake',
  },
  {
    label: 'Case History',
    shortLabel: 'History',
    to: '/history',
    section: 'cases',
    icon: History,
    keywords: 'history archive cases list duplicate',
  },
  {
    label: 'Evidence Vault',
    shortLabel: 'Evidence Vault',
    to: '/vault',
    section: 'records',
    icon: HardDrive,
    keywords: 'vault repository files sha256 hashes',
  },
  {
    label: 'Forensic Report Studio',
    shortLabel: 'Report Studio',
    to: '/reports',
    section: 'records',
    icon: FileText,
    keywords: 'report pdf json export dossier',
  },
  {
    label: 'Methodology & Limitations',
    shortLabel: 'Methodology',
    to: '/methodology',
    section: 'system',
    icon: BookOpen,
    keywords: 'methodology science domains limitations documentation',
  },
  {
    label: 'Engine Status',
    shortLabel: 'Engine Status',
    to: '/system-status',
    section: 'system',
    icon: Activity,
    keywords: 'system status health fastapi backend api',
  },
  {
    label: 'Preferences',
    shortLabel: 'Preferences',
    to: '/settings',
    section: 'system',
    icon: Settings,
    keywords: 'settings theme api url storage accessibility',
  },
];

const PRIMARY_NAV: Array<{
  id: PrimarySection;
  label: string;
  to: string;
}> = [
  { id: 'home', label: 'Home', to: '/home' },
  { id: 'labs', label: 'Forensic Labs', to: '/image-forensics' },
  { id: 'cases', label: 'Cases', to: '/workspace' },
  { id: 'records', label: 'Vault & Reports', to: '/vault' },
  { id: 'system', label: 'Methodology', to: '/methodology' },
];

function getActiveSection(pathname: string): PrimarySection {
  if (pathname === '/home') return 'home';
  if (
    pathname.startsWith('/image-forensics') ||
    pathname.startsWith('/video-forensics') ||
    pathname.startsWith('/audio-forensics') ||
    pathname.startsWith('/text-analysis') ||
    pathname.startsWith('/cross-modal') ||
    pathname.startsWith('/comparison')
  ) {
    return 'labs';
  }
  if (
    pathname.startsWith('/workspace') ||
    pathname.startsWith('/new-investigation') ||
    pathname.startsWith('/history')
  ) {
    return 'cases';
  }
  if (pathname.startsWith('/vault') || pathname.startsWith('/reports')) {
    return 'records';
  }
  return 'system';
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    demoMode,
    setDemoMode,
    backendHealth,
    investigations,
    evidence,
    setActiveInvestigationId,
    setSelectedEvidenceId,
    toasts,
    dismissToast,
    settings,
    updateSettings,
  } = useForensic();

  const { profile, user, signOutUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = useMemo(() => getActiveSection(location.pathname), [location.pathname]);
  const isHome = location.pathname === '/home';

  const investigatorName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Investigator';
  const investigatorEmail = profile?.email || user?.email || '';
  const investigatorInitials = useMemo(() => {
    const parts = investigatorName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return investigatorName.slice(0, 2).toUpperCase();
  }, [investigatorName]);

  const requestSignOut = () => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    setCommandOpen(false);
    setLogoutConfirmOpen(true);
  };

  const confirmSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOutUser();
      setLogoutConfirmOpen(false);
      navigate('/auth', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const subNavItems = useMemo(() => {
    if (activeSection === 'home') return [];
    if (activeSection === 'cases' || activeSection === 'records') {
      return ALL_DESTINATIONS.filter((d) => d.section === 'cases' || d.section === 'records');
    }
    return ALL_DESTINATIONS.filter((d) => d.section === activeSection);
  }, [activeSection]);

  const backendLabel =
    backendHealth.status === 'connected'
      ? 'Connected'
      : backendHealth.status === 'checking'
        ? 'Checking'
        : 'Disconnected';

  // Global Cmd/Ctrl + K Command Palette shortcut & Escape handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setProfileMenuOpen(false);
        setCommandOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCommandOpen(false);
        setMobileMenuOpen(false);
        setProfileMenuOpen(false);
        setLogoutConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (commandOpen) {
      setCommandQuery('');
      window.setTimeout(() => commandInputRef.current?.focus(), 40);
    }
  }, [commandOpen]);

  const filteredDestinations = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return ALL_DESTINATIONS;
    return ALL_DESTINATIONS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.keywords.toLowerCase().includes(q)
    );
  }, [commandQuery]);

  const filteredCases = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return investigations.slice(0, 3);
    return investigations
      .filter(
        (inv) =>
          inv.title.toLowerCase().includes(q) ||
          inv.caseReference.toLowerCase().includes(q) ||
          inv.id.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [commandQuery, investigations]);

  const filteredEvidence = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return [];
    return evidence
      .filter(
        (ev) =>
          ev.fileName.toLowerCase().includes(q) ||
          (ev.sha256 || '').toLowerCase().includes(q) ||
          ev.id.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [commandQuery, evidence]);

  const handlePrimaryCta = () => {
    if (location.pathname.startsWith('/image-forensics')) {
      navigate('/new-investigation');
    } else {
      navigate('/image-forensics');
    }
  };

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <MotionConfig
      reducedMotion={settings.reducedMotion || !settings.animationsEnabled ? 'always' : 'user'}
    >
      <div className="min-h-screen flex flex-col bg-tl-bg text-tl-text">
        {/* Global Demo Mode Notice Banner — only visible when Demo Mode is explicitly active */}
        <AnimatePresence initial={false}>
          {demoMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: FORENSIC_EASE }}
              className="overflow-hidden bg-tl-caution/12 border-b border-tl-caution/35"
            >
              <div className="max-w-[1440px] mx-auto px-5 lg:px-10 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-tl-caution font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono tracking-tight">
                    DEMO DATA — NOT A REAL FORENSIC ANALYSIS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoMode(false)}
                  className="text-xs font-medium text-tl-text hover:text-tl-cyan underline underline-offset-4 whitespace-nowrap"
                >
                  Return to Live Workspace
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Strict 3-Zone Top Application Bar */}
        <header className="sticky top-0 z-30 bg-tl-bg/92 backdrop-blur-md border-b border-tl-border">
          <div className="max-w-[1440px] mx-auto h-16 px-5 lg:px-10 flex items-center justify-between gap-8">
            {/* Zone 1: Single crisp Brand Wordmark */}
            <NavLink
              to="/home"
              className="inline-flex items-center gap-2.5 text-tl-text hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-tl-cyan shrink-0"
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
              <span className="font-display text-lg font-semibold tracking-tight leading-none">
                TruthLens
              </span>
            </NavLink>

            {/* Zone 2: 5 Clean Single-Line Navigation Links */}
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-7 text-sm font-medium"
            >
              {PRIMARY_NAV.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    className={`relative py-5 transition-colors whitespace-nowrap shrink-0 ${
                      isActive ? 'text-tl-text' : 'text-tl-muted hover:text-tl-text'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="primary-nav-indicator"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-[2px] bg-tl-cyan"
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Zone 3: Primary Action + Profile Menu (+ Mobile Menu Button) */}
            <div className="flex items-center gap-2.5 shrink-0">
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePrimaryCta}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <span>
                  {location.pathname.startsWith('/image-forensics') ? 'New Case' : 'Inspect Image'}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </motion.button>

              {/* Profile / Avatar Dropdown Menu */}
              <div ref={profileMenuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  aria-label="Investigator account menu"
                  className={`inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-md border transition-colors ${
                    profileMenuOpen
                      ? 'border-tl-border-strong bg-tl-elevated text-tl-text'
                      : 'border-tl-border bg-tl-panel/80 text-tl-text hover:border-tl-border-strong hover:bg-tl-elevated/70'
                  }`}
                >
                  {profile?.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt={investigatorName}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded object-cover border border-tl-border"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded bg-tl-bg-secondary border border-tl-border flex items-center justify-center font-mono text-[10px] font-semibold text-tl-cyan">
                      {investigatorInitials}
                    </span>
                  )}
                  <span className="text-xs font-medium max-w-[110px] truncate hidden lg:inline">
                    {investigatorName}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-tl-muted transition-transform duration-150 ${
                      profileMenuOpen ? 'rotate-180 text-tl-text' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      role="menu"
                      aria-label="Account options"
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.14, ease: FORENSIC_EASE }}
                      className="absolute right-0 mt-2 w-64 rounded-lg border border-tl-border bg-tl-panel shadow-2xl overflow-hidden z-40"
                    >
                      <div className="px-3.5 py-3 border-b border-tl-border bg-tl-bg-secondary/60">
                        <div className="text-xs font-semibold text-tl-text truncate">
                          {investigatorName}
                        </div>
                        {investigatorEmail && (
                          <div className="text-[11px] font-mono text-tl-muted truncate mt-0.5">
                            {investigatorEmail}
                          </div>
                        )}
                        {(profile?.roleTitle || profile?.organization) && (
                          <div className="text-[11px] text-tl-muted truncate mt-1">
                            {[profile.roleTitle, profile.organization].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>

                      <div className="p-1.5 space-y-0.5 text-xs">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-tl-text hover:bg-tl-elevated transition-colors text-left"
                        >
                          <Settings className="w-3.5 h-3.5 text-tl-muted shrink-0" />
                          <span>Preferences</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            toggleTheme();
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-tl-text hover:bg-tl-elevated transition-colors text-left"
                        >
                          {settings.theme === 'dark' ? (
                            <Sun className="w-3.5 h-3.5 text-tl-muted shrink-0" />
                          ) : (
                            <Moon className="w-3.5 h-3.5 text-tl-muted shrink-0" />
                          )}
                          <span>{settings.theme === 'dark' ? 'Paper Mode' : 'Darkroom Mode'}</span>
                        </button>
                      </div>

                      <div className="p-1.5 border-t border-tl-border">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={requestSignOut}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-tl-muted hover:text-tl-alert hover:bg-tl-alert/10 transition-colors text-left"
                        >
                          <LogOut className="w-3.5 h-3.5 shrink-0" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="md:hidden p-2 rounded-md border border-tl-border bg-tl-panel text-tl-text hover:border-tl-border-strong transition-colors"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contextual Secondary Lab / Workspace Sub-Bar (only shown on inner application routes) */}
          {!isHome && subNavItems.length > 0 && (
            <div className="border-t border-tl-border/80 bg-tl-bg-secondary/75">
              <div className="max-w-[1440px] mx-auto px-5 lg:px-10 h-11 flex items-center justify-between gap-4 overflow-x-auto">
                <div className="flex items-center gap-1 shrink-0">
                  {subNavItems.map((sub) => {
                    const isSubActive =
                      sub.to === '/workspace'
                        ? location.pathname === '/workspace' ||
                          location.pathname.startsWith('/workspace/')
                        : location.pathname === sub.to;
                    return (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        title={sub.devStatus ? `${sub.label} — ${sub.devStatus}` : sub.label}
                        className={`relative px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                          isSubActive
                            ? 'text-tl-text'
                            : 'text-tl-muted hover:text-tl-text'
                        }`}
                      >
                        {isSubActive && (
                          <motion.span
                            layoutId="sub-nav-active"
                            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                            aria-hidden="true"
                            className="absolute inset-0 rounded bg-tl-panel border border-tl-border"
                          />
                        )}
                        <span className="relative z-10">{sub.shortLabel}</span>
                        {sub.devStatus && (
                          <span
                            aria-label={sub.devStatus}
                            className="relative z-10 text-[9px] font-mono text-tl-muted/80"
                          >
                            {sub.devStatus === 'Under Development' ? '◌' : '○'}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>

                {/* Quiet utility controls inside inner workspaces */}
                <div className="hidden lg:flex items-center gap-4 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setDemoMode(!demoMode)}
                    className={`font-mono text-[11px] transition-colors whitespace-nowrap ${
                      demoMode ? 'text-tl-caution' : 'text-tl-muted hover:text-tl-text'
                    }`}
                  >
                    {demoMode ? 'Demo Fixtures: On' : 'Mode: Live'}
                  </button>
                  <span className="text-tl-border" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={() => navigate('/system-status')}
                    className="hover:opacity-80 transition-opacity whitespace-nowrap"
                  >
                    <StatusLabel status={backendLabel} />
                  </button>
                  <span className="text-tl-border" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-tl-muted hover:text-tl-text transition-colors whitespace-nowrap"
                  >
                    <Search className="w-3 h-3" />
                    <span>Jump</span>
                    <kbd className="px-1 py-0.5 rounded border border-tl-border bg-tl-panel text-[10px]">
                      ⌘K
                    </kbd>
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Mobile Full Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/65 backdrop-blur-[2px]"
              />
              <motion.aside
                initial={{ x: 290 }}
                animate={{ x: 0 }}
                exit={{ x: 290 }}
                transition={{ duration: 0.22, ease: FORENSIC_EASE }}
                className="relative z-10 w-[290px] max-w-[85vw] h-full bg-tl-bg-secondary border-l border-tl-border flex flex-col"
              >
                <div className="h-16 px-5 border-b border-tl-border flex items-center justify-between">
                  <span className="font-display text-base font-semibold text-tl-text">
                    TruthLens
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close navigation menu"
                    className="p-1.5 rounded text-tl-muted hover:text-tl-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {(
                    [
                      ['Forensic Labs', ALL_DESTINATIONS.filter((d) => d.section === 'labs')],
                      [
                        'Cases & Records',
                        ALL_DESTINATIONS.filter(
                          (d) => d.section === 'cases' || d.section === 'records'
                        ),
                      ],
                      ['Documentation & System', ALL_DESTINATIONS.filter((d) => d.section === 'system')],
                    ] as const
                  ).map(([groupTitle, items]) => (
                    <div key={groupTitle} className="space-y-1">
                      <div className="px-2 pb-1 text-[11px] font-medium text-tl-muted">
                        {groupTitle}
                      </div>
                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setMobileMenuOpen(false)}
                              title={item.devStatus ? `${item.label} — ${item.devStatus}` : item.label}
                              className={({ isActive }) =>
                                `flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                                  isActive
                                    ? 'bg-tl-panel text-tl-cyan border border-tl-border'
                                    : 'text-tl-muted hover:text-tl-text'
                                }`
                              }
                            >
                              <span className="flex items-center gap-2.5 min-w-0">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </span>
                              {item.devStatus && (
                                <span className="text-[10px] font-mono text-tl-muted/80 shrink-0">
                                  {item.devStatus === 'Under Development' ? 'Dev' : 'Soon'}
                                </span>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Mobile Sidebar Bottom User Profile & Logout Section */}
                  <div className="p-4 border-t border-tl-border bg-tl-bg/40 space-y-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {profile?.photoURL ? (
                        <img
                          src={profile.photoURL}
                          alt={investigatorName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded object-cover border border-tl-border shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded bg-tl-panel border border-tl-border flex items-center justify-center font-mono text-[11px] font-semibold text-tl-cyan shrink-0">
                          {investigatorInitials}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-tl-text truncate">
                          {investigatorName}
                        </div>
                        {investigatorEmail && (
                          <div className="text-[11px] font-mono text-tl-muted truncate">
                            {investigatorEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setDemoMode(!demoMode)}
                        className="px-2.5 py-1.5 rounded border border-tl-border bg-tl-panel text-tl-text hover:border-tl-border-strong transition-colors"
                      >
                        {demoMode ? 'Exit Demo' : 'Demo Mode'}
                      </button>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label="Toggle color theme"
                        className="p-2 rounded border border-tl-border bg-tl-panel text-tl-muted hover:text-tl-text transition-colors"
                      >
                        {settings.theme === 'dark' ? (
                          <Sun className="w-4 h-4" />
                        ) : (
                          <Moon className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={requestSignOut}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-muted hover:text-tl-alert hover:border-tl-alert/45 hover:bg-tl-alert/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main Application Canvas */}
        <main
          className={`flex-1 w-full max-w-[1440px] mx-auto ${
            isHome
              ? 'px-5 lg:px-10 py-8 lg:py-12'
              : settings.compactMode
                ? 'px-4 lg:px-8 py-4 lg:py-6'
                : 'px-5 lg:px-10 py-6 lg:py-8'
          }`}
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: FORENSIC_EASE }}
          >
            {children}
          </motion.div>
        </main>

        {/* Quiet Editorial Footer */}
        <footer className="border-t border-tl-border mt-auto">
          <div className="max-w-[1440px] mx-auto px-5 lg:px-10 py-7 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-tl-muted">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display font-semibold text-sm text-tl-text">TruthLens</span>
              <span aria-hidden="true">·</span>
              <span>{profile?.displayName || user?.email || 'Investigator Session'}</span>
              {profile?.organization && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{profile.organization}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <NavLink to="/image-forensics" className="hover:text-tl-text transition-colors">
                Image Lab
              </NavLink>
              <NavLink to="/vault" className="hover:text-tl-text transition-colors">
                Evidence Vault
              </NavLink>
              <NavLink to="/reports" className="hover:text-tl-text transition-colors">
                Reports
              </NavLink>
              <NavLink to="/methodology" className="hover:text-tl-text transition-colors">
                Methodology
              </NavLink>
              <NavLink to="/system-status" className="hover:text-tl-text transition-colors">
                Engine Status
              </NavLink>
              <NavLink to="/settings" className="hover:text-tl-text transition-colors">
                Preferences
              </NavLink>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 hover:text-tl-text transition-colors"
                aria-label="Toggle archival light or dark theme"
              >
                {settings.theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5" />
                    <span>Paper Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    <span>Darkroom</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] hover:text-tl-text transition-colors"
              >
                <span>Quick Jump</span>
                <kbd className="px-1.5 py-0.5 rounded border border-tl-border bg-tl-bg-secondary text-[10px]">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={requestSignOut}
                className="inline-flex items-center gap-1.5 hover:text-tl-alert transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </footer>

        {/* Global Command Palette (⌘K) */}
        <AnimatePresence>
          {commandOpen && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Quick navigation command palette"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setCommandOpen(false)}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4"
            >
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16, ease: FORENSIC_EASE }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl rounded-lg border border-tl-border bg-tl-panel shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-tl-border flex items-center gap-3">
                  <Search className="w-4 h-4 text-tl-muted shrink-0" />
                  <input
                    ref={commandInputRef}
                    type="text"
                    value={commandQuery}
                    onChange={(e) => setCommandQuery(e.target.value)}
                    placeholder="Jump to a forensic lab, case reference, or SHA-256 hash..."
                    className="flex-1 bg-transparent text-sm text-tl-text placeholder:text-tl-muted outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCommandOpen(false)}
                    className="text-[11px] font-mono text-tl-muted hover:text-tl-text px-1.5 py-0.5 rounded border border-tl-border"
                  >
                    ESC
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto divide-y divide-tl-border/60">
                  {/* Workspaces & Labs */}
                  <div className="p-2">
                    <div className="px-2.5 py-1.5 text-[11px] font-medium text-tl-muted">
                      Workspaces &amp; Labs
                    </div>
                    {filteredDestinations.length === 0 ? (
                      <div className="px-2.5 py-3 text-xs text-tl-muted">
                        No matching workspace found.
                      </div>
                    ) : (
                      filteredDestinations.map((dest) => {
                        const Icon = dest.icon;
                        return (
                          <button
                            key={dest.to}
                            type="button"
                            onClick={() => {
                              navigate(dest.to);
                              setCommandOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs text-tl-text hover:bg-tl-elevated transition-colors"
                          >
                            <span className="inline-flex items-center gap-2.5">
                              <Icon className="w-3.5 h-3.5 text-tl-cyan shrink-0" />
                              <span className="font-medium">{dest.label}</span>
                            </span>
                            <span className="font-mono text-[10px] text-tl-muted">
                              {dest.devStatus ? dest.devStatus : dest.to}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Matching Cases */}
                  {filteredCases.length > 0 && (
                    <div className="p-2">
                      <div className="px-2.5 py-1.5 text-[11px] font-medium text-tl-muted">
                        Investigations ({demoMode ? 'Demo' : 'Live'})
                      </div>
                      {filteredCases.map((inv) => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => {
                            setActiveInvestigationId(inv.id);
                            navigate(`/workspace/${inv.id}`);
                            setCommandOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs hover:bg-tl-elevated transition-colors"
                        >
                          <span className="truncate text-tl-text font-medium">{inv.title}</span>
                          <span className="font-mono text-[10px] text-tl-muted shrink-0 ml-3">
                            {inv.caseReference}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Matching Evidence */}
                  {filteredEvidence.length > 0 && (
                    <div className="p-2">
                      <div className="px-2.5 py-1.5 text-[11px] font-medium text-tl-muted">
                        Evidence Matches
                      </div>
                      {filteredEvidence.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            setSelectedEvidenceId(ev.id);
                            navigate(ev.mediaType === 'image' ? '/image-forensics' : '/workspace');
                            setCommandOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs hover:bg-tl-elevated transition-colors"
                        >
                          <span className="truncate text-tl-text">{ev.fileName}</span>
                          <span className="font-mono text-[10px] text-tl-muted shrink-0 ml-3">
                            {ev.sha256 ? `${ev.sha256.slice(0, 10)}…` : ev.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="p-2 flex flex-wrap items-center justify-between gap-2 bg-tl-bg-secondary/60 px-3.5 py-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setDemoMode(!demoMode);
                        setCommandOpen(false);
                      }}
                      className="text-tl-text hover:text-tl-cyan transition-colors"
                    >
                      {demoMode ? 'Switch to Live Workspace' : 'Load Demo Sample Dataset'}
                    </button>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          toggleTheme();
                          setCommandOpen(false);
                        }}
                        className="text-tl-muted hover:text-tl-text transition-colors"
                      >
                        {settings.theme === 'dark' ? 'Paper Mode' : 'Darkroom Mode'}
                      </button>
                      <button
                        type="button"
                        onClick={requestSignOut}
                        className="inline-flex items-center gap-1 text-tl-muted hover:text-tl-alert transition-colors"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logout Confirmation Dialog */}
        <ConfirmModal
          open={logoutConfirmOpen}
          title="Log out of TruthLens?"
          description="Your authenticated investigator session will end and you will be redirected to the login page. Your cloud case records remain safely stored in your account."
          confirmLabel={loggingOut ? 'Logging out...' : 'Log Out'}
          cancelLabel="Cancel"
          destructive
          onConfirm={() => void confirmSignOut()}
          onCancel={() => {
            if (!loggingOut) setLogoutConfirmOpen(false);
          }}
        />

        {/* Toast Stack */}
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
        >
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 18, scale: 0.96 }}
                transition={{ duration: 0.2, ease: FORENSIC_EASE }}
                className="pointer-events-auto rounded-md border border-tl-border bg-tl-panel p-3.5 shadow-xl flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold ${
                      toast.tone === 'success'
                        ? 'text-tl-success'
                        : toast.tone === 'caution'
                          ? 'text-tl-caution'
                          : toast.tone === 'alert'
                            ? 'text-tl-alert'
                            : 'text-tl-cyan'
                    }`}
                  >
                    {toast.title}
                  </div>
                  {toast.description && (
                    <p className="text-xs text-tl-muted mt-0.5 leading-relaxed">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="text-tl-muted hover:text-tl-text shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
};
