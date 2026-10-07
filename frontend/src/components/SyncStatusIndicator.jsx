import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Download, 
  X, 
  ChevronRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import syncManager from '../services/syncManager';
import { getAllCachedProjects, saveProjects, getAllQueueItems } from '../services/db';
import { fetchOfflineProjectBundle } from '../api/client';
import { useToast } from './Toast';

export default function SyncStatusIndicator({ onSelectWork }) {
  const { addToast } = useToast();
  const [syncState, setSyncState] = useState(syncManager.getState());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [queueItems, setQueueItems] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  const loadLocalStats = async () => {
    try {
      const projs = await getAllCachedProjects();
      setCachedCount(projs.length);
      const items = await getAllQueueItems();
      setQueueItems(items);
    } catch (err) {
      console.warn('Could not load local stats:', err);
    }
  };

  useEffect(() => {
    loadLocalStats();
    const interval = setInterval(loadLocalStats, 5000);
    return () => clearInterval(interval);
  }, [syncState]);

  const handleDownloadBundle = async () => {
    setIsDownloading(true);
    try {
      const bundle = await fetchOfflineProjectBundle({ limit: 100 });
      if (bundle && bundle.projects) {
        await saveProjects(bundle.projects);
        setCachedCount(bundle.projects.length);
        addToast(`Downloaded and cached ${bundle.projects.length} projects for offline verification.`, 'success');
      }
    } catch (err) {
      addToast(`Offline bundle download failed: ${err.message}`, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTriggerSync = () => {
    syncManager.triggerSync();
    addToast('Initiating synchronization with central intelligence engine...', 'info');
  };

  const { isOnline, isSyncing, queueSummary, statusMessage } = syncState;
  const hasConflicts = queueSummary.conflict > 0;
  const hasFailed = queueSummary.failed > 0;
  const hasPending = queueSummary.pending > 0;

  return (
    <>
      {/* Compact Header Pill */}
      <button
        onClick={() => setIsPanelOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
          !isOnline
            ? 'bg-[#FEF6EE] text-[#916540] border-[#E8E4DC]'
            : isSyncing
            ? 'bg-[#F2ECE4] text-[#4B3C32] border-[#C8BFB3]'
            : hasConflicts
            ? 'bg-[#FDF2F2] text-[#C94C4C] border-[#F2C2C2]'
            : hasFailed
            ? 'bg-[#FDF2F2] text-[#C94C4C] border-[#F2C2C2]'
            : hasPending
            ? 'bg-[#FFFBEB] text-[#916540] border-[#E8E4DC]'
            : 'bg-[#F0F8F4] text-[#2E8B57] border-[#C2E0D0]'
        }`}
        title="Offline Field Verification & Sync Manager"
        aria-label="Offline Sync Manager Status"
      >
        {!isOnline ? (
          <>
            <span className="w-2 h-2 rounded-full bg-[#E6A23C] animate-pulse" />
            <span>Offline</span>
            {hasPending && <span className="text-[10px] font-bold">({queueSummary.pending})</span>}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-3 h-3 text-[#4B3C32] animate-spin" />
            <span>Syncing...</span>
          </>
        ) : hasConflicts ? (
          <>
            <AlertTriangle className="w-3 h-3 text-[#C94C4C]" />
            <span>Conflict ({queueSummary.conflict})</span>
          </>
        ) : hasFailed ? (
          <>
            <AlertCircle className="w-3 h-3 text-[#C94C4C]" />
            <span>Sync Failed ({queueSummary.failed})</span>
          </>
        ) : hasPending ? (
          <>
            <Clock className="w-3 h-3 text-[#E6A23C]" />
            <span>{queueSummary.pending} pending</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-[#2E8B57]" />
            <span className="hidden sm:inline">Engine Online</span>
            <CheckCircle2 className="w-3 h-3 text-[#2E8B57]" />
          </>
        )}
      </button>

      {/* Sync Manager Modal / Slideover Panel */}
      {isPanelOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/30 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setIsPanelOpen(false)}
        >
          <div 
            className="bg-white border border-[#E8E4DC] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4DC] bg-[#F7F7F1]">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isOnline ? 'bg-[#F0F8F4] text-[#2E8B57]' : 'bg-[#FEF6EE] text-[#916540]'}`}>
                  {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#050505]">
                    Field Verification & Sync Center
                  </h3>
                  <p className="text-[11px] text-[#5E5E5D]">
                    {isOnline ? 'Connected to Central AI Engine' : 'Offline Mode — Local IndexedDB Storage Active'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="p-1.5 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Status Alert Banner */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
                !isOnline 
                  ? 'bg-[#FEF6EE] border-[#E8E4DC] text-[#916540]' 
                  : isSyncing 
                  ? 'bg-[#F7F7F1] border-[#C8BFB3] text-[#4B3C32]'
                  : hasConflicts
                  ? 'bg-[#FDF2F2] border-[#F2C2C2] text-[#C94C4C]'
                  : 'bg-[#F0F8F4] border-[#C2E0D0] text-[#2E8B57]'
              }`}>
                <div className="flex items-center gap-2.5">
                  {!isOnline ? <WifiOff className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span className="font-medium text-xs">{statusMessage}</span>
                </div>
                {isOnline && (hasPending || hasFailed) && (
                  <button
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                    className="btn-primary py-1 px-3 text-[11px] flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync Now</span>
                  </button>
                )}
              </div>

              {/* Offline Storage Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#F7F7F1] rounded-xl border border-[#E8E4DC]">
                  <div className="text-[11px] text-[#5E5E5D] font-medium">Cached Projects</div>
                  <div className="text-xl font-semibold text-[#050505] mt-0.5">{cachedCount}</div>
                  <div className="text-[10px] text-[#5E5E5D]/80">Ready for field</div>
                </div>
                <div className="p-3 bg-[#F7F7F1] rounded-xl border border-[#E8E4DC]">
                  <div className="text-[11px] text-[#5E5E5D] font-medium">Pending Sync</div>
                  <div className="text-xl font-semibold text-[#916540] mt-0.5">{queueSummary.pending}</div>
                  <div className="text-[10px] text-[#5E5E5D]/80">In sync queue</div>
                </div>
                <div className="p-3 bg-[#F7F7F1] rounded-xl border border-[#E8E4DC]">
                  <div className="text-[11px] text-[#5E5E5D] font-medium">Synced Records</div>
                  <div className="text-xl font-semibold text-[#2E8B57] mt-0.5">{queueSummary.synced}</div>
                  <div className="text-[10px] text-[#5E5E5D]/80">Authoritative</div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleDownloadBundle}
                  disabled={!isOnline || isDownloading}
                  className="flex-1 btn-secondary text-xs flex items-center justify-center gap-2 py-2.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#5E5E5D]" />
                  <span>{isDownloading ? 'Caching Data...' : 'Cache Projects for Field Work'}</span>
                </button>

                <button
                  onClick={handleTriggerSync}
                  disabled={!isOnline || isSyncing}
                  className="btn-primary text-xs flex items-center justify-center gap-2 py-2.5 px-4"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Queue</span>
                </button>
              </div>

              {/* Conflict Notice if any */}
              {hasConflicts && (
                <div className="p-3.5 bg-[#FDF2F2] border border-[#F2C2C2] rounded-xl text-[#C94C4C] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Version Conflict Detected</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#5E5E5D]">
                    This project was updated after it was downloaded. Your offline verification could not automatically overwrite the newer server information. Review the latest project information before submitting again.
                  </p>
                </div>
              )}

              {/* Sync Queue Operations Log */}
              <div className="space-y-2 pt-2 border-t border-[#E8E4DC]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#050505] text-xs">
                    Recent Queue Operations
                  </span>
                  <span className="text-[11px] text-[#5E5E5D]">
                    Total: {queueItems.length}
                  </span>
                </div>

                {queueItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#F7F7F1] border border-[#E8E4DC] text-center text-xs text-[#5E5E5D]">
                    No operations in sync queue. All field records are up to date.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {queueItems.map((item) => (
                      <div
                        key={item.operation_id}
                        className="p-3 rounded-xl border border-[#E8E4DC] bg-white flex items-center justify-between text-xs hover:border-[#C8BFB3] transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#050505]">{item.project_id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              item.status === 'synced'
                                ? 'bg-[#F0F8F4] text-[#2E8B57]'
                                : item.status === 'syncing'
                                ? 'bg-[#F7F7F1] text-[#4B3C32]'
                                : item.status === 'conflict'
                                ? 'bg-[#FDF2F2] text-[#C94C4C]'
                                : item.status === 'failed'
                                ? 'bg-[#FDF2F2] text-[#C94C4C]'
                                : 'bg-[#FEF6EE] text-[#916540]'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#5E5E5D]">
                            Progress: {item.payload?.progress}% · {item.payload?.verification_status}
                          </div>
                          {item.last_error && (
                            <div className="text-[10px] text-[#C94C4C] italic">
                              Error: {item.last_error}
                            </div>
                          )}
                        </div>

                        {onSelectWork && (
                          <button
                            onClick={() => {
                              setIsPanelOpen(false);
                              onSelectWork(item.project_id);
                            }}
                            className="p-1.5 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#F7F7F1] transition-colors"
                            title="Inspect work dossier"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[#E8E4DC] bg-[#F7F7F1] flex justify-between items-center text-[11px] text-[#5E5E5D]">
              <span>MPLADS Offline Sync Protocol v1.0</span>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="btn-secondary py-1.5 px-3.5 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
