import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ForensicProvider } from './context/ForensicContext';
import { AppLayout } from './layouts/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';

const NewInvestigationPage = lazy(() =>
  import('./pages/NewInvestigationPage').then((m) => ({ default: m.NewInvestigationPage }))
);
const InvestigationWorkspacePage = lazy(() =>
  import('./pages/InvestigationWorkspacePage').then((m) => ({
    default: m.InvestigationWorkspacePage,
  }))
);
const ImageForensicsPage = lazy(() =>
  import('./pages/ImageForensicsPage').then((m) => ({ default: m.ImageForensicsPage }))
);
const VideoForensicsPage = lazy(() =>
  import('./pages/VideoForensicsPage').then((m) => ({ default: m.VideoForensicsPage }))
);
const AudioForensicsPage = lazy(() =>
  import('./pages/AudioForensicsPage').then((m) => ({ default: m.AudioForensicsPage }))
);
const TextAnalysisPage = lazy(() =>
  import('./pages/TextAnalysisPage').then((m) => ({ default: m.TextAnalysisPage }))
);
const CrossModalPage = lazy(() =>
  import('./pages/CrossModalPage').then((m) => ({ default: m.CrossModalPage }))
);
const EvidenceComparisonPage = lazy(() =>
  import('./pages/EvidenceComparisonPage').then((m) => ({
    default: m.EvidenceComparisonPage,
  }))
);
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage }))
);
const EvidenceVaultPage = lazy(() =>
  import('./pages/EvidenceVaultPage').then((m) => ({ default: m.EvidenceVaultPage }))
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const MethodologyPage = lazy(() =>
  import('./pages/MethodologyPage').then((m) => ({ default: m.MethodologyPage }))
);
const SystemStatusPage = lazy(() =>
  import('./pages/SystemStatusPage').then((m) => ({ default: m.SystemStatusPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const PageSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="h-7 w-56 rounded forensic-shimmer border border-tl-border" />
    <div className="h-4 w-96 max-w-full rounded forensic-shimmer opacity-80" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      <div className="h-40 rounded-lg forensic-shimmer border border-tl-border" />
      <div className="h-40 rounded-lg forensic-shimmer border border-tl-border" />
      <div className="h-40 rounded-lg forensic-shimmer border border-tl-border" />
    </div>
  </div>
);

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-tl-bg text-tl-text flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="font-display text-lg font-semibold text-tl-text">TruthLens</div>
          <div className="text-xs font-mono text-tl-muted">Verifying investigator session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const ProtectedWorkspaceRoutes: React.FC = () => (
  <RequireAuth>
    <AppLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/home" element={<DashboardPage />} />
          <Route path="/new-investigation" element={<NewInvestigationPage />} />
          <Route path="/workspace" element={<InvestigationWorkspacePage />} />
          <Route path="/workspace/:id" element={<InvestigationWorkspacePage />} />
          <Route path="/image-forensics" element={<ImageForensicsPage />} />
          <Route path="/video-forensics" element={<VideoForensicsPage />} />
          <Route path="/audio-forensics" element={<AudioForensicsPage />} />
          <Route path="/text-analysis" element={<TextAnalysisPage />} />
          <Route path="/cross-modal" element={<CrossModalPage />} />
          <Route path="/comparison" element={<EvidenceComparisonPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/vault" element={<EvidenceVaultPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/system-status" element={<SystemStatusPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  </RequireAuth>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ForensicProvider>
          <BrowserRouter>
            <Routes>
              {/* Stage 1: Public Editorial Landing Page */}
              <Route path="/" element={<LandingPage />} />
              {/* Stage 2: Dedicated Login / Sign Up Page */}
              <Route path="/auth" element={<AuthPage />} />
              {/* Stage 3: Authenticated Featured Workspace & 15 Forensic Labs */}
              <Route path="/*" element={<ProtectedWorkspaceRoutes />} />
            </Routes>
          </BrowserRouter>
        </ForensicProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
