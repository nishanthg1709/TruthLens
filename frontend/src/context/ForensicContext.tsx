import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { BACKEND_LIMITS } from '../constants/assets';
import {
  DEMO_ACTIVITY_FEED,
  DEMO_EVIDENCE,
  DEMO_INVESTIGATIONS,
} from '../data/demoData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { getDefaultApiBaseUrl } from '../services/api';
import { checkBackendHealth } from '../services/healthService';
import {
  ActivityFeedItem,
  AppSettings,
  BackendHealthState,
  EvidenceItem,
  ImageForensicResult,
  Investigation,
  InvestigatorNote,
  ToastMessage,
} from '../types/forensics';
import { generateId } from '../utils/cryptoAndValidation';

const STORAGE_KEYS = {
  INVESTIGATIONS: 'truthlens_investigations_v1',
  EVIDENCE: 'truthlens_evidence_v1',
  ACTIVITY: 'truthlens_activity_v1',
  SETTINGS: 'truthlens_settings_v1',
  DEMO_MODE: 'truthlens_demo_mode_v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  animationsEnabled: true,
  compactMode: false,
  reducedMotion: false,
  highContrast: false,
  textScale: 'standard',
  apiBaseUrl: getDefaultApiBaseUrl(),
  showGridOverlayByDefault: false,
  showRegionIdsOnGrid: true,
  highlightFlaggedRegions: true,
};

interface ForensicContextValue {
  // Mode & Health
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  backendHealth: BackendHealthState;
  refreshBackendHealth: (overrideUrl?: string) => Promise<BackendHealthState>;

  // Active data (strictly separated between real and demo)
  investigations: Investigation[];
  evidence: EvidenceItem[];
  activityFeed: ActivityFeedItem[];
  realInvestigationsCount: number;
  realEvidenceCount: number;

  // Selection
  activeInvestigationId: string | null;
  setActiveInvestigationId: (id: string | null) => void;
  selectedEvidenceId: string | null;
  setSelectedEvidenceId: (id: string | null) => void;

  // Session File Map (keeps raw File objects in memory for API uploads without bloating localStorage)
  sessionFiles: Record<string, File>;
  registerSessionFile: (evidenceId: string, file: File) => void;

  // Mutations (operate on real workspace data)
  createInvestigation: (
    input: Omit<Investigation, 'id' | 'createdAt' | 'updatedAt' | 'evidenceIds' | 'status'>,
    attachedEvidence?: Array<Omit<EvidenceItem, 'investigationId'>>
  ) => Investigation;
  updateInvestigationStatus: (id: string, status: Investigation['status']) => void;
  duplicateInvestigation: (id: string) => Investigation | null;
  deleteInvestigation: (id: string) => void;
  markReportGenerated: (investigationId: string) => void;

  addEvidenceItem: (item: EvidenceItem, rawFile?: File) => void;
  attachAnalysisResult: (evidenceId: string, result: ImageForensicResult) => void;
  updateEvidenceStatus: (evidenceId: string, status: EvidenceItem['analysisStatus']) => void;
  addEvidenceNote: (
    evidenceId: string,
    note: Omit<InvestigatorNote, 'id' | 'createdAt'>
  ) => void;
  assignEvidenceToInvestigation: (evidenceIds: string[], investigationId: string) => void;
  removeEvidenceItem: (evidenceId: string) => void;

  // Settings & Local Storage
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  clearLocalWorkspaceData: () => void;

  // Global search & notifications
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ForensicContext = createContext<ForensicContextValue | null>(null);

function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or storage unavailable — fail gracefully without crashing
  }
}

const ALLOWED_CATEGORIES: Investigation['category'][] = [
  'Media Verification',
  'Disinformation Review',
  'Deepfake Investigation',
  'Document & Provenance',
  'Incident Response',
  'Academic Research',
];

function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export const ForensicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, authReady } = useAuth();

  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...safeReadStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {}),
  }));

  const [demoMode, setDemoModeState] = useState<boolean>(() =>
    safeReadStorage<boolean>(STORAGE_KEYS.DEMO_MODE, true)
  );

  const [realInvestigations, setRealInvestigations] = useState<Investigation[]>(() =>
    safeReadStorage<Investigation[]>(STORAGE_KEYS.INVESTIGATIONS, [])
  );

  const [realEvidence, setRealEvidence] = useState<EvidenceItem[]>(() =>
    safeReadStorage<EvidenceItem[]>(STORAGE_KEYS.EVIDENCE, [])
  );

  const [realActivity, setRealActivity] = useState<ActivityFeedItem[]>(() =>
    safeReadStorage<ActivityFeedItem[]>(STORAGE_KEYS.ACTIVITY, [])
  );

  const [sessionFiles, setSessionFiles] = useState<Record<string, File>>({});
  const [activeInvestigationId, setActiveInvestigationId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [backendHealth, setBackendHealth] = useState<BackendHealthState>({
    status: 'checking',
    apiBaseUrl: settings.apiBaseUrl,
    lastCheckedAt: null,
    lastSuccessAt: null,
    responseTimeMs: null,
    version: null,
    supportedFormats: [...BACKEND_LIMITS.SUPPORTED_IMAGE_LABELS],
    limits: {
      maxFileSizeMb: BACKEND_LIMITS.MAX_FILE_SIZE_MB,
      maxDimensionPx: BACKEND_LIMITS.MAX_DIMENSION_PX,
      maxMegapixels: BACKEND_LIMITS.MAX_MEGAPIXELS,
    },
    errorMessage: null,
    endpointsConfirmed: { health: false, analyze: false },
  });

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = generateId('TST');
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshBackendHealth = useCallback(
    async (overrideUrl?: string) => {
      const targetUrl = overrideUrl || settings.apiBaseUrl;
      setBackendHealth((prev) => ({ ...prev, status: 'checking', apiBaseUrl: targetUrl }));
      const next = await checkBackendHealth(targetUrl, backendHealth.lastSuccessAt);
      setBackendHealth(next);
      return next;
    },
    [settings.apiBaseUrl, backendHealth.lastSuccessAt]
  );

  // Initial backend health check on mount and when API base URL changes
  useEffect(() => {
    let active = true;
    checkBackendHealth(settings.apiBaseUrl, null).then((res) => {
      if (active) setBackendHealth(res);
    });
    return () => {
      active = false;
    };
  }, [settings.apiBaseUrl]);

  // Apply theme, reduced motion, contrast, and text scale to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.classList.toggle('reduced-motion', settings.reducedMotion || !settings.animationsEnabled);
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.remove('text-scale-large', 'text-scale-compact');
    if (settings.textScale === 'large') root.classList.add('text-scale-large');
    if (settings.textScale === 'compact') root.classList.add('text-scale-compact');
    safeWriteStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  // Persist real workspace records (strip transient blob preview URLs before serializing)
  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.INVESTIGATIONS, realInvestigations);
  }, [realInvestigations]);

  useEffect(() => {
    const serializable = realEvidence.map((e) => ({
      ...e,
      previewUrl: e.previewUrl?.startsWith('blob:') ? undefined : e.previewUrl,
    }));
    safeWriteStorage(STORAGE_KEYS.EVIDENCE, serializable);
  }, [realEvidence]);

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.ACTIVITY, realActivity.slice(0, 80));
  }, [realActivity]);

  // Clear transient in-memory uploaded binaries when user logs out
  useEffect(() => {
    if (authReady && !user) {
      setSessionFiles({});
      setActiveInvestigationId(null);
      setSelectedEvidenceId(null);
    }
  }, [authReady, user]);

  // Real-time Firestore listener for authenticated investigator's cloud cases
  useEffect(() => {
    if (!authReady || !user || !profile) return;
    const casesPath = `users/${user.uid}/cases`;
    const q = query(
      collection(db, 'users', user.uid, 'cases'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudCases: Investigation[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdIso =
            d.createdAt && typeof d.createdAt.toDate === 'function'
              ? d.createdAt.toDate().toISOString()
              : new Date().toISOString();
          const updatedIso =
            d.updatedAt && typeof d.updatedAt.toDate === 'function'
              ? d.updatedAt.toDate().toISOString()
              : createdIso;
          const cat = ALLOWED_CATEGORIES.includes(d.category)
            ? (d.category as Investigation['category'])
            : 'Media Verification';
          const status = (
            ['Active', 'In Review', 'Completed', 'Archived'].includes(d.status)
              ? d.status
              : 'Active'
          ) as Investigation['status'];
          return {
            id: String(d.id || docSnap.id),
            caseReference: String(d.caseReference || docSnap.id),
            title: String(d.title || 'Untitled Investigation'),
            description: String(d.summary || ''),
            category: cat,
            investigator: String(d.investigator || profile.displayName || 'Investigator'),
            status,
            selectedModules: ['Image Forensics'],
            contextualNotes: '',
            createdAt: createdIso,
            updatedAt: updatedIso,
            evidenceIds: [],
            reportGeneratedAt: null,
            isDemoData: false,
          };
        });

        setRealInvestigations((localPrev) => {
          const localById = new Map(localPrev.map((i) => [i.id, i]));
          const merged = cloudCases.map((c) => {
            const existingLocal = localById.get(c.id);
            return existingLocal
              ? {
                  ...c,
                  evidenceIds: existingLocal.evidenceIds,
                  reportGeneratedAt: existingLocal.reportGeneratedAt,
                  selectedModules: existingLocal.selectedModules,
                  contextualNotes: existingLocal.contextualNotes,
                }
              : c;
          });
          // Keep any local-only unsynced cases so nothing disappears
          const cloudIds = new Set(cloudCases.map((c) => c.id));
          const localOnly = localPrev.filter((i) => !cloudIds.has(i.id));
          return [...merged, ...localOnly].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          );
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, casesPath);
        } catch (err) {
          console.error('Firestore cases listener error:', err);
          pushToast({
            title: 'Cloud Case Sync Unavailable',
            description:
              'Unable to subscribe to cloud cases. Local browser workspace remains available.',
            tone: 'caution',
          });
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user, profile, pushToast]);

  const syncCaseToFirestore = useCallback(
    async (inv: Investigation) => {
      if (!user || !profile) return;
      const casePath = `users/${user.uid}/cases/${inv.id}`;
      try {
        const safeCategory = ALLOWED_CATEGORIES.includes(inv.category)
          ? inv.category
          : 'Media Verification';
        await setDoc(doc(db, 'users', user.uid, 'cases', inv.id), {
          id: clampStr(inv.id, 128),
          ownerId: user.uid,
          caseReference: clampStr(inv.caseReference || inv.id, 64) || inv.id,
          title: clampStr(inv.title || 'Untitled Investigation', 180) || 'Untitled Investigation',
          category: safeCategory,
          investigator:
            clampStr(inv.investigator || profile.displayName || 'Investigator', 120) ||
            'Investigator',
          status: inv.status,
          summary: clampStr(inv.description || '', 1500),
          evidenceCount: Math.max(0, Math.min(1000, inv.evidenceIds.length)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.CREATE, casePath);
        } catch (err) {
          console.error(err);
        }
      }
    },
    [user, profile]
  );

  const setDemoMode = useCallback(
    (enabled: boolean) => {
      setDemoModeState(enabled);
      safeWriteStorage(STORAGE_KEYS.DEMO_MODE, enabled);
      setActiveInvestigationId(null);
      setSelectedEvidenceId(null);
      pushToast({
        title: enabled ? 'Demo Mode Enabled' : 'Live Workspace Mode Enabled',
        description: enabled
          ? 'Viewing clearly labeled sample fixtures. Real workspace data remains separated.'
          : 'Showing only real local workspace investigations and live backend responses.',
        tone: enabled ? 'caution' : 'info',
      });
    },
    [pushToast]
  );

  const registerSessionFile = useCallback((evidenceId: string, file: File) => {
    setSessionFiles((prev) => ({ ...prev, [evidenceId]: file }));
  }, []);

  const appendActivity = useCallback((item: Omit<ActivityFeedItem, 'id' | 'timestamp' | 'isDemoData'>) => {
    setRealActivity((prev) => [
      {
        ...item,
        id: generateId('ACT'),
        timestamp: new Date().toISOString(),
        isDemoData: false,
      },
      ...prev,
    ]);
  }, []);

  const createInvestigation: ForensicContextValue['createInvestigation'] = useCallback(
    (input, attachedEvidence = []) => {
      if (demoMode) {
        setDemoModeState(false);
        safeWriteStorage(STORAGE_KEYS.DEMO_MODE, false);
      }
      const now = new Date().toISOString();
      const invId = generateId('INV');
      const evidenceIds = attachedEvidence.map((e) => e.id);

      const newInv: Investigation = {
        ...input,
        id: invId,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
        evidenceIds,
        reportGeneratedAt: null,
        isDemoData: false,
      };

      setRealInvestigations((prev) => [newInv, ...prev]);
      void syncCaseToFirestore(newInv);

      if (attachedEvidence.length > 0) {
        const linkedItems: EvidenceItem[] = attachedEvidence.map((ev) => ({
          ...ev,
          investigationId: invId,
          isDemoData: false,
        }));
        setRealEvidence((prev) => [...linkedItems, ...prev]);
      }

      appendActivity({
        type: 'investigation_created',
        title: 'Investigation created',
        detail: `${newInv.title} (${newInv.caseReference}) with ${evidenceIds.length} evidence item(s).`,
        investigationId: invId,
      });

      setActiveInvestigationId(invId);
      if (evidenceIds[0]) setSelectedEvidenceId(evidenceIds[0]);

      pushToast({
        title: 'Investigation Created',
        description: user
          ? `${newInv.caseReference} saved to your cloud workspace.`
          : `${newInv.caseReference} saved to local workspace storage.`,
        tone: 'success',
      });

      return newInv;
    },
    [demoMode, appendActivity, pushToast, syncCaseToFirestore, user]
  );

  const updateInvestigationStatus = useCallback(
    (id: string, status: Investigation['status']) => {
      const target = realInvestigations.find((i) => i.id === id);
      if (target?.status === 'Archived') {
        pushToast({
          title: 'Archived Case Locked',
          description: 'Archived cases are locked to preserve chain-of-custody integrity.',
          tone: 'caution',
        });
        return;
      }
      setRealInvestigations((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, status, updatedAt: new Date().toISOString() } : inv
        )
      );
      if (user && profile) {
        const casePath = `users/${user.uid}/cases/${id}`;
        void updateDoc(doc(db, 'users', user.uid, 'cases', id), {
          status,
          updatedAt: serverTimestamp(),
        }).catch((error) => {
          try {
            handleFirestoreError(error, OperationType.UPDATE, casePath);
          } catch (err) {
            console.error(err);
          }
        });
      }
    },
    [realInvestigations, pushToast, user, profile]
  );

  const duplicateInvestigation = useCallback(
    (id: string) => {
      const source = (demoMode ? DEMO_INVESTIGATIONS : realInvestigations).find((i) => i.id === id);
      if (!source) return null;
      if (demoMode) {
        setDemoModeState(false);
        safeWriteStorage(STORAGE_KEYS.DEMO_MODE, false);
      }
      const now = new Date().toISOString();
      const copy: Investigation = {
        ...source,
        id: generateId('INV'),
        caseReference: `${source.caseReference}-COPY`,
        title: `${source.title} (Copy)`,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
        evidenceIds: [],
        reportGeneratedAt: null,
        isDemoData: false,
      };
      setRealInvestigations((prev) => [copy, ...prev]);
      void syncCaseToFirestore(copy);
      pushToast({
        title: 'Investigation Duplicated',
        description: `Created ${copy.caseReference} in your workspace.`,
        tone: 'info',
      });
      return copy;
    },
    [demoMode, realInvestigations, pushToast, syncCaseToFirestore]
  );

  const deleteInvestigation = useCallback(
    (id: string) => {
      setRealInvestigations((prev) => prev.filter((i) => i.id !== id));
      setRealEvidence((prev) =>
        prev.map((e) => (e.investigationId === id ? { ...e, investigationId: null } : e))
      );
      if (activeInvestigationId === id) setActiveInvestigationId(null);
      if (user && profile) {
        const casePath = `users/${user.uid}/cases/${id}`;
        void deleteDoc(doc(db, 'users', user.uid, 'cases', id)).catch((error) => {
          try {
            handleFirestoreError(error, OperationType.DELETE, casePath);
          } catch (err) {
            console.error(err);
          }
        });
      }
      pushToast({
        title: 'Investigation Deleted',
        description: 'Removed investigation record from your workspace.',
        tone: 'caution',
      });
    },
    [activeInvestigationId, pushToast, user, profile]
  );

  const markReportGenerated = useCallback(
    (investigationId: string) => {
      const now = new Date().toISOString();
      setRealInvestigations((prev) =>
        prev.map((i) =>
          i.id === investigationId ? { ...i, reportGeneratedAt: now, updatedAt: now } : i
        )
      );
      appendActivity({
        type: 'report_generated',
        title: 'Forensic report exported',
        detail: `Report generated for investigation ${investigationId}.`,
        investigationId,
      });
    },
    [appendActivity]
  );

  const addEvidenceItem = useCallback(
    (item: EvidenceItem, rawFile?: File) => {
      if (demoMode) {
        setDemoModeState(false);
        safeWriteStorage(STORAGE_KEYS.DEMO_MODE, false);
      }
      const cleanItem: EvidenceItem = { ...item, isDemoData: false };
      setRealEvidence((prev) => [cleanItem, ...prev]);
      if (rawFile) {
        setSessionFiles((prev) => ({ ...prev, [cleanItem.id]: rawFile }));
      }
      if (cleanItem.investigationId) {
        setRealInvestigations((prev) =>
          prev.map((inv) =>
            inv.id === cleanItem.investigationId
              ? {
                  ...inv,
                  evidenceIds: Array.from(new Set([cleanItem.id, ...inv.evidenceIds])),
                  updatedAt: new Date().toISOString(),
                }
              : inv
          )
        );
      }
      appendActivity({
        type: 'evidence_uploaded',
        title: 'Evidence added to workspace',
        detail: `${cleanItem.fileName} (${cleanItem.mediaType.toUpperCase()})`,
        investigationId: cleanItem.investigationId || undefined,
        evidenceId: cleanItem.id,
      });
    },
    [demoMode, appendActivity]
  );

  const attachAnalysisResult = useCallback(
    (evidenceId: string, result: ImageForensicResult) => {
      setRealEvidence((prev) =>
        prev.map((item) => {
          if (item.id !== evidenceId) return item;
          const nextStatus =
            result.regionsRequiringReview > 0 ? 'Requires Review' : 'Analyzed';
          return {
            ...item,
            analysisStatus: nextStatus,
            analysisResult: result,
            custodyLog: [
              ...item.custodyLog,
              {
                id: generateId('COC'),
                timestamp: result.analyzedAt,
                action: 'Forensic analysis response received',
                actor: result.engineVersion,
                origin: 'forensic_backend',
                details: `Analysis ID ${result.analysisId} — ${result.independentDomainsAvailable} independent domain(s), ${result.regionsRequiringReview} region(s) flagged for review.`,
              },
            ],
          };
        })
      );
      appendActivity({
        type: 'analysis_completed',
        title: 'Forensic analysis completed',
        detail: `Evidence ${evidenceId} analyzed via FastAPI engine (${result.analysisId}).`,
        evidenceId,
      });
    },
    [appendActivity]
  );

  const updateEvidenceStatus = useCallback(
    (evidenceId: string, status: EvidenceItem['analysisStatus']) => {
      setRealEvidence((prev) =>
        prev.map((item) => (item.id === evidenceId ? { ...item, analysisStatus: status } : item))
      );
    },
    []
  );

  const addEvidenceNote = useCallback(
    (evidenceId: string, note: Omit<InvestigatorNote, 'id' | 'createdAt'>) => {
      const now = new Date().toISOString();
      const fullNote: InvestigatorNote = {
        ...note,
        id: generateId('NOTE'),
        createdAt: now,
      };
      setRealEvidence((prev) =>
        prev.map((item) =>
          item.id === evidenceId
            ? {
                ...item,
                notes: [fullNote, ...item.notes],
                custodyLog: [
                  ...item.custodyLog,
                  {
                    id: generateId('COC'),
                    timestamp: now,
                    action: `Investigator note added (${note.category})`,
                    actor: note.author,
                    origin: 'investigator',
                    details: note.content.slice(0, 120),
                  },
                ],
              }
            : item
        )
      );
      appendActivity({
        type: 'human_review_added',
        title: 'Human review note recorded',
        detail: `${note.category}: ${note.content.slice(0, 80)}`,
        evidenceId,
      });
      pushToast({
        title: 'Review Note Saved',
        description: 'Added to evidence review log.',
        tone: 'success',
      });
    },
    [appendActivity, pushToast]
  );

  const assignEvidenceToInvestigation = useCallback(
    (evidenceIds: string[], investigationId: string) => {
      setRealEvidence((prev) =>
        prev.map((e) => (evidenceIds.includes(e.id) ? { ...e, investigationId } : e))
      );
      setRealInvestigations((prev) =>
        prev.map((inv) =>
          inv.id === investigationId
            ? {
                ...inv,
                evidenceIds: Array.from(new Set([...inv.evidenceIds, ...evidenceIds])),
                updatedAt: new Date().toISOString(),
              }
            : inv
        )
      );
      pushToast({
        title: 'Evidence Assigned',
        description: `Linked ${evidenceIds.length} item(s) to investigation.`,
        tone: 'success',
      });
    },
    [pushToast]
  );

  const removeEvidenceItem = useCallback(
    (evidenceId: string) => {
      setRealEvidence((prev) => {
        const target = prev.find((e) => e.id === evidenceId);
        if (target?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(target.previewUrl);
        }
        return prev.filter((e) => e.id !== evidenceId);
      });
      setSessionFiles((prev) => {
        if (!(evidenceId in prev)) return prev;
        const next = { ...prev };
        delete next[evidenceId];
        return next;
      });
      setRealInvestigations((prev) =>
        prev.map((inv) => ({
          ...inv,
          evidenceIds: inv.evidenceIds.filter((id) => id !== evidenceId),
        }))
      );
      if (selectedEvidenceId === evidenceId) setSelectedEvidenceId(null);
      pushToast({
        title: 'Evidence Removed',
        description: 'Evidence item removed from local workspace.',
        tone: 'caution',
      });
    },
    [selectedEvidenceId, pushToast]
  );

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearLocalWorkspaceData = useCallback(() => {
    setRealEvidence((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
    setRealInvestigations([]);
    setRealActivity([]);
    setSessionFiles({});
    setActiveInvestigationId(null);
    setSelectedEvidenceId(null);
    try {
      window.localStorage.removeItem(STORAGE_KEYS.INVESTIGATIONS);
      window.localStorage.removeItem(STORAGE_KEYS.EVIDENCE);
      window.localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
    } catch {
      // Ignore
    }
    pushToast({
      title: 'Local Workspace Cleared',
      description: 'All local browser investigations, evidence metadata, and logs were removed.',
      tone: 'caution',
    });
  }, [pushToast]);

  // Strict segregation: Demo Mode shows ONLY demo fixtures; Live Mode shows ONLY real workspace data.
  const investigations = useMemo(
    () => (demoMode ? DEMO_INVESTIGATIONS : realInvestigations),
    [demoMode, realInvestigations]
  );
  const evidence = useMemo(
    () => (demoMode ? DEMO_EVIDENCE : realEvidence),
    [demoMode, realEvidence]
  );
  const activityFeed = useMemo(
    () => (demoMode ? DEMO_ACTIVITY_FEED : realActivity),
    [demoMode, realActivity]
  );

  const value: ForensicContextValue = {
    demoMode,
    setDemoMode,
    backendHealth,
    refreshBackendHealth,
    investigations,
    evidence,
    activityFeed,
    realInvestigationsCount: realInvestigations.length,
    realEvidenceCount: realEvidence.length,
    activeInvestigationId,
    setActiveInvestigationId,
    selectedEvidenceId,
    setSelectedEvidenceId,
    sessionFiles,
    registerSessionFile,
    createInvestigation,
    updateInvestigationStatus,
    duplicateInvestigation,
    deleteInvestigation,
    markReportGenerated,
    addEvidenceItem,
    attachAnalysisResult,
    updateEvidenceStatus,
    addEvidenceNote,
    assignEvidenceToInvestigation,
    removeEvidenceItem,
    settings,
    updateSettings,
    clearLocalWorkspaceData,
    globalSearchQuery,
    setGlobalSearchQuery,
    toasts,
    pushToast,
    dismissToast,
  };

  return <ForensicContext.Provider value={value}>{children}</ForensicContext.Provider>;
};

export function useForensic(): ForensicContextValue {
  const ctx = useContext(ForensicContext);
  if (!ctx) {
    throw new Error('useForensic must be used within ForensicProvider');
  }
  return ctx;
}
