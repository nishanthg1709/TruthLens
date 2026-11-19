import React, { useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { getDefaultApiBaseUrl } from '../services/api';
import { ConfirmModal, StatusLabel } from '../components/ui/ForensicPrimitives';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    backendHealth,
    refreshBackendHealth,
    realInvestigationsCount,
    realEvidenceCount,
    clearLocalWorkspaceData,
    pushToast,
  } = useForensic();

  const [apiInput, setApiInput] = useState(settings.apiBaseUrl);
  const [testing, setTesting] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const handleSaveAndTestApi = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = apiInput.trim().replace(/\/+$/, '') || getDefaultApiBaseUrl();
    setApiInput(cleaned);
    updateSettings({ apiBaseUrl: cleaned });
    setTesting(true);
    const res = await refreshBackendHealth(cleaned);
    setTesting(false);
    pushToast({
      title: res.status === 'connected' ? 'Backend Connection Verified' : 'Backend Unreachable',
      description:
        res.status === 'connected'
          ? `Connected to ${cleaned} (${res.responseTimeMs} ms).`
          : res.errorMessage || `Unable to reach ${cleaned}/health.`,
      tone: res.status === 'connected' ? 'success' : 'alert',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
          Settings
        </h1>
        <p className="text-sm text-tl-muted mt-1">
          Configure workstation display preferences, FastAPI backend endpoint, local storage, and accessibility options.
        </p>
      </div>

      {/* 1. General */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
        <h2 className="font-display text-sm font-semibold text-tl-text">General</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between rounded border border-tl-border bg-tl-bg-secondary p-3.5">
            <div>
              <div className="font-medium text-tl-text">Color Theme</div>
              <div className="text-tl-muted mt-0.5">Dark Forensic Workstation is default</div>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded border border-tl-border bg-tl-panel">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateSettings({ theme: t })}
                  className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${
                    settings.theme === t
                      ? 'bg-tl-elevated text-tl-cyan'
                      : 'text-tl-muted hover:text-tl-text'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <div>
              <div className="font-medium text-tl-text">Interface Animations</div>
              <div className="text-tl-muted mt-0.5">Subtle transitions &amp; forensic scanline</div>
            </div>
            <input
              type="checkbox"
              checked={settings.animationsEnabled}
              onChange={(e) => updateSettings({ animationsEnabled: e.target.checked })}
              className="accent-[#37C8F5] w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <div>
              <div className="font-medium text-tl-text">Compact Workspace Density</div>
              <div className="text-tl-muted mt-0.5">Tighter padding for dense data review</div>
            </div>
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(e) => updateSettings({ compactMode: e.target.checked })}
              className="accent-[#37C8F5] w-4 h-4"
            />
          </label>
        </div>
      </section>

      {/* 2. Analysis Display Preferences */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-tl-text">
            Analysis &amp; Region Display Preferences
          </h2>
          <p className="text-xs text-tl-muted mt-0.5">
            Controls client-side visual presentation only. Backend forensic heuristics and limits are governed strictly by the FastAPI engine.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center justify-between gap-2 rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <span className="text-tl-text">Show 4×4 grid by default</span>
            <input
              type="checkbox"
              checked={settings.showGridOverlayByDefault}
              onChange={(e) => updateSettings({ showGridOverlayByDefault: e.target.checked })}
              className="accent-[#37C8F5]"
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <span className="text-tl-text">Display region IDs (r0_c0)</span>
            <input
              type="checkbox"
              checked={settings.showRegionIdsOnGrid}
              onChange={(e) => updateSettings({ showRegionIdsOnGrid: e.target.checked })}
              className="accent-[#37C8F5]"
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <span className="text-tl-text">Highlight flagged regions</span>
            <input
              type="checkbox"
              checked={settings.highlightFlaggedRegions}
              onChange={(e) => updateSettings({ highlightFlaggedRegions: e.target.checked })}
              className="accent-[#37C8F5]"
            />
          </label>
        </div>
      </section>

      {/* 3. API Configuration */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Forensic Engine API
            </h2>
            <p className="text-xs text-tl-muted mt-0.5">
              Reads default from <code className="font-mono text-tl-ice">VITE_API_BASE_URL</code> (development default: http://localhost:8000).
            </p>
          </div>
          <StatusLabel
            status={
              backendHealth.status === 'connected'
                ? 'Connected'
                : backendHealth.status === 'checking'
                  ? 'Checking'
                  : 'Disconnected'
            }
          />
        </div>

        <form onSubmit={handleSaveAndTestApi} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={apiInput}
            onChange={(e) => setApiInput(e.target.value)}
            aria-label="FastAPI backend base URL"
            placeholder="http://localhost:8000"
            className="flex-1 rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 font-mono text-xs text-tl-text focus:border-tl-cyan outline-none"
          />
          <button
            type="submit"
            disabled={testing}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Save & Test Connection'}</span>
          </button>
          <button
            type="button"
            disabled={testing}
            onClick={async () => {
              const def = getDefaultApiBaseUrl();
              setApiInput(def);
              updateSettings({ apiBaseUrl: def });
              setTesting(true);
              const res = await refreshBackendHealth(def);
              setTesting(false);
              pushToast({
                title: 'API URL Reset to Default',
                description:
                  res.status === 'connected'
                    ? `Reset to ${def} and verified connection (${res.responseTimeMs} ms).`
                    : `Reset to ${def}. Backend currently unreachable.`,
                tone: res.status === 'connected' ? 'success' : 'info',
              });
            }}
            className="px-3 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs text-tl-muted hover:text-tl-text disabled:opacity-50 whitespace-nowrap"
          >
            Reset Default
          </button>
        </form>
      </section>

      {/* 4. Local Storage */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-tl-text">Local Storage</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded border border-tl-border bg-tl-bg-secondary p-4 text-xs">
          <div className="space-y-1">
            <div className="font-mono text-tl-text">
              {realInvestigationsCount} local investigation(s) · {realEvidenceCount} evidence metadata record(s)
            </div>
            <p className="text-tl-muted">
              Workspace preferences and local evidence metadata are cached in browser localStorage, while authenticated case records sync to Firebase Firestore. Uploaded media binaries remain in session memory only and are never written to localStorage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClearModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-alert/50 bg-tl-alert/10 text-xs font-semibold text-tl-alert hover:bg-tl-alert/20 whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local Data</span>
          </button>
        </div>
      </section>

      {/* 5. Accessibility */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
        <h2 className="font-display text-sm font-semibold text-tl-text">Accessibility</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center justify-between gap-2 rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <span className="text-tl-text">Reduced Motion</span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
              className="accent-[#37C8F5]"
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded border border-tl-border bg-tl-bg-secondary p-3.5 cursor-pointer">
            <span className="text-tl-text">Higher Contrast Borders</span>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => updateSettings({ highContrast: e.target.checked })}
              className="accent-[#37C8F5]"
            />
          </label>

          <div className="flex items-center justify-between gap-2 rounded border border-tl-border bg-tl-bg-secondary p-3.5">
            <span className="text-tl-text">Text Scale</span>
            <select
              aria-label="Interface text scale"
              value={settings.textScale}
              onChange={(e) =>
                updateSettings({
                  textScale: e.target.value as typeof settings.textScale,
                })
              }
              className="rounded border border-tl-border bg-tl-panel px-2 py-1 text-xs text-tl-text outline-none"
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      </section>

      <ConfirmModal
        open={clearModalOpen}
        title="Clear All Local Workspace Data"
        description="This permanently removes all locally stored investigations, evidence metadata, notes, and activity logs from your browser. Demo Mode fixtures are unaffected."
        confirmLabel="Clear Local Data"
        destructive
        onCancel={() => setClearModalOpen(false)}
        onConfirm={() => {
          clearLocalWorkspaceData();
          setClearModalOpen(false);
        }}
      />
    </div>
  );
};
