import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Copy,
  FolderOpen,
  Search,
  Trash2,
} from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { Investigation, InvestigationStatus } from '../types/forensics';
import { formatShortDate, formatTimestamp } from '../utils/cryptoAndValidation';
import {
  ConfirmModal,
  EmptyStatePanel,
  NoticeCallout,
  StatusLabel,
} from '../components/ui/ForensicPrimitives';

export const HistoryPage: React.FC = () => {
  const {
    investigations,
    demoMode,
    setActiveInvestigationId,
    updateInvestigationStatus,
    duplicateInvestigation,
    deleteInvestigation,
    globalSearchQuery,
  } = useForensic();
  const navigate = useNavigate();

  const [query, setQuery] = useState(globalSearchQuery);
  const [statusFilter, setStatusFilter] = useState<'All' | InvestigationStatus>('All');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title' | 'evidence'>('updated');
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setQuery(globalSearchQuery);
  }, [globalSearchQuery]);

  const selectedInv: Investigation | null = useMemo(
    () => (selectedInvId ? investigations.find((i) => i.id === selectedInvId) || null : null),
    [investigations, selectedInvId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...investigations]
      .filter((inv) => {
        if (statusFilter !== 'All' && inv.status !== statusFilter) return false;
        if (!q) return true;
        return (
          inv.title.toLowerCase().includes(q) ||
          inv.id.toLowerCase().includes(q) ||
          inv.caseReference.toLowerCase().includes(q) ||
          inv.investigator.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'evidence') return b.evidenceIds.length - a.evidenceIds.length;
        if (sortBy === 'created') return b.createdAt.localeCompare(a.createdAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [investigations, query, statusFilter, sortBy]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
            Investigation History
          </h1>
          <p className="text-sm text-tl-muted mt-1">
            Search, sort, duplicate, archive, or inspect historical forensic investigation records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/new-investigation')}
          className="px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 whitespace-nowrap"
        >
          New Investigation
        </button>
      </div>

      <NoticeCallout tone="info" title="Case Record Persistence">
        Case records for signed-in investigators sync with Firebase Firestore and are cached locally in browser storage. Original media binaries stay in session memory only.
      </NoticeCallout>

      {/* Filter & Sort Controls */}
      <div className="rounded-lg border border-tl-border bg-tl-panel p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-tl-muted absolute left-3 top-2.5" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, case reference, title, or investigator..."
            className="w-full pl-8 pr-3 py-1.5 rounded border border-tl-border bg-tl-bg-secondary text-xs text-tl-text outline-none focus:border-tl-cyan"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(['All', 'Active', 'In Review', 'Completed', 'Archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-tl-elevated text-tl-cyan border border-tl-cyan/40'
                    : 'text-tl-muted hover:text-tl-text border border-transparent'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            aria-label="Sort investigations"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-xs text-tl-text outline-none"
          >
            <option value="updated">Sort: Last Modified</option>
            <option value="created">Sort: Date Created</option>
            <option value="title">Sort: Title (A–Z)</option>
            <option value="evidence">Sort: Evidence Count</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyStatePanel
          title="No matching investigations found."
          description="Adjust your search filter or create a new forensic investigation to populate your local case archive."
          icon={<FolderOpen className="w-5 h-5" />}
          primaryAction={{
            label: 'New Investigation',
            onClick: () => navigate('/new-investigation'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 rounded-lg border border-tl-border bg-tl-panel overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-tl-border bg-tl-bg-secondary/60 text-tl-muted">
                  <th className="py-2.5 px-4 font-mono">ID</th>
                  <th className="py-2.5 px-4">Title &amp; Reference</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4 text-right">Evidence</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Report</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tl-border/70">
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvId(inv.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedInv?.id === inv.id
                        ? 'bg-tl-elevated/80'
                        : 'hover:bg-tl-elevated/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-tl-ice whitespace-nowrap">
                      {inv.id}
                    </td>
                    <td className="py-3 px-4 max-w-[230px]">
                      <div className="font-medium text-tl-text truncate">{inv.title}</div>
                      <div className="font-mono text-[10px] text-tl-muted truncate">
                        {inv.caseReference} · {inv.investigator}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-tl-muted whitespace-nowrap tabular-nums">
                      {formatShortDate(inv.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-mono text-tl-text text-right tabular-nums">
                      {inv.evidenceIds.length}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusLabel status={inv.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                      {inv.reportGeneratedAt ? (
                        <span className="text-tl-success">Generated</span>
                      ) : (
                        <span className="text-tl-muted">Pending</span>
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveInvestigationId(inv.id);
                            navigate(`/workspace/${inv.id}`);
                          }}
                          className="px-2 py-1 rounded border border-tl-border bg-tl-elevated text-tl-text hover:border-tl-cyan hover:text-tl-cyan"
                        >
                          Open
                        </button>
                        {!demoMode && (
                          <>
                            <button
                              type="button"
                              onClick={() => duplicateInvestigation(inv.id)}
                              title="Duplicate investigation"
                              aria-label={`Duplicate ${inv.title}`}
                              className="p-1.5 rounded text-tl-muted hover:text-tl-cyan hover:bg-tl-elevated"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateInvestigationStatus(
                                  inv.id,
                                  inv.status === 'Archived' ? 'Active' : 'Archived'
                                )
                              }
                              title={inv.status === 'Archived' ? 'Restore investigation' : 'Archive investigation'}
                              aria-label={inv.status === 'Archived' ? `Restore ${inv.title}` : `Archive ${inv.title}`}
                              className="p-1.5 rounded text-tl-muted hover:text-tl-caution hover:bg-tl-elevated"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(inv.id)}
                              title="Delete investigation"
                              aria-label={`Delete ${inv.title}`}
                              className="p-1.5 rounded text-tl-muted hover:text-tl-alert hover:bg-tl-elevated"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail Inspector */}
          <aside className="xl:col-span-4 rounded-lg border border-tl-border bg-tl-panel p-4 space-y-3 text-xs">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Investigation Record Details
            </h2>
            {selectedInv ? (
              <div className="space-y-3">
                <div>
                  <div className="font-mono text-tl-cyan">{selectedInv.caseReference}</div>
                  <div className="font-display text-sm font-semibold text-tl-text mt-0.5">
                    {selectedInv.title}
                  </div>
                </div>
                <p className="text-tl-muted leading-relaxed">
                  {selectedInv.description || 'No description provided.'}
                </p>
                <dl className="grid grid-cols-2 gap-2.5 pt-2 border-t border-tl-border">
                  <div>
                    <dt className="text-tl-muted">Category</dt>
                    <dd className="text-tl-text mt-0.5">{selectedInv.category}</dd>
                  </div>
                  <div>
                    <dt className="text-tl-muted">Investigator</dt>
                    <dd className="text-tl-text mt-0.5">{selectedInv.investigator}</dd>
                  </div>
                  <div>
                    <dt className="text-tl-muted">Created</dt>
                    <dd className="font-mono text-tl-text mt-0.5">
                      {formatTimestamp(selectedInv.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tl-muted">Last Modified</dt>
                    <dd className="font-mono text-tl-text mt-0.5">
                      {formatTimestamp(selectedInv.updatedAt)}
                    </dd>
                  </div>
                </dl>
                <div>
                  <div className="text-tl-muted mb-1">Selected Modules</div>
                  <div className="text-tl-ice">{selectedInv.selectedModules.join(' · ')}</div>
                </div>
                {selectedInv.contextualNotes && (
                  <div className="rounded border border-tl-border bg-tl-bg-secondary p-2.5 text-tl-muted">
                    {selectedInv.contextualNotes}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-tl-muted">
                Click any investigation row to inspect full record details.
              </p>
            )}
          </aside>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteId)}
        title="Delete Investigation Record"
        description="Permanently delete this investigation from local browser storage? Associated evidence items will remain in the Evidence Vault as unlinked records."
        confirmLabel="Delete Investigation"
        destructive
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteInvestigation(deleteId);
          setDeleteId(null);
          setSelectedInvId(null);
        }}
      />
    </div>
  );
};
