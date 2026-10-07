import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ClipboardCheck, 
  MapPin, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  Search, 
  X
} from 'lucide-react';
import syncManager from '../services/syncManager';
import { 
  getAllCachedProjects, 
  saveProjects, 
  enqueueOperation, 
  saveLocalVerificationRecord, 
  getLocalVerificationsForProject,
  getCachedProject
} from '../services/db';
import { fetchProjectVerifications } from '../api/client';
import RiskBadge from './RiskBadge';
import { useToast } from './Toast';

export default function FieldVerificationView({ 
  initialWorkId = null,
  availableWorks = [],
  _onSelectWork
}) {
  const { addToast } = useToast();
  const [syncState, setSyncState] = useState(syncManager.getState());
  const [cachedProjects, setCachedProjects] = useState([]);
  const [selectedWorkId, setSelectedWorkId] = useState(initialWorkId || '');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Verification Form State
  const [progress, setProgress] = useState(50);
  const [verificationStatus, setVerificationStatus] = useState('PARTIALLY_VERIFIED');
  const [remarks, setRemarks] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Submission & Result State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);
  const [riskDeltaInfo, setRiskDeltaInfo] = useState(null);
  const [conflictDetail, setConflictDetail] = useState(null);
  
  // Project Verification History
  const [historyRecords, setHistoryRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const unsub = syncManager.subscribe(setSyncState);
    return () => unsub();
  }, []);

  // Load cached projects from IndexedDB or seed from availableWorks
  const loadProjects = useCallback(async () => {
    try {
      let local = await getAllCachedProjects();
      if (local.length === 0 && availableWorks.length > 0) {
        // Automatically pre-populate local IndexedDB cache with current available works
        await saveProjects(availableWorks.map(w => ({
          work_id: w.work_id,
          work_title: w.work_title,
          work_category: w.work_category,
          district: w.district,
          state: w.state,
          village: w.village,
          ward: w.ward,
          latitude: w.latitude,
          longitude: w.longitude,
          sanctioned_amount: w.sanctioned_amount,
          physical_progress: w.physical_progress,
          financial_progress: w.financial_progress,
          overall_risk_score: w.overall_risk_score,
          risk_level: w.risk_level,
          primary_risk_factor: w.primary_risk_factor,
          implementing_agency: w.implementing_agency,
          status: w.status,
          version: w.version || 1
        })));
        local = await getAllCachedProjects();
      }
      setCachedProjects(local);

      // Auto-select first project if none selected
      if (!selectedWorkId && local.length > 0) {
        setSelectedWorkId(local[0].work_id);
      }
    } catch (err) {
      console.warn('Error loading cached projects:', err);
    }
  }, [availableWorks, selectedWorkId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Handle work selection changes
  const activeProject = useMemo(() => {
    if (!selectedWorkId) return null;
    return cachedProjects.find(p => p.work_id === selectedWorkId) || 
           availableWorks.find(w => w.work_id === selectedWorkId) || null;
  }, [selectedWorkId, cachedProjects, availableWorks]);

  // Load historical verifications (API if online, IndexedDB if offline)
  const loadHistory = useCallback(async (wId) => {
    setLoadingHistory(true);
    try {
      if (syncState.isOnline) {
        const apiRes = await fetchProjectVerifications(wId);
        setHistoryRecords(apiRes.verifications || []);
      } else {
        const localList = await getLocalVerificationsForProject(wId);
        setHistoryRecords(localList || []);
      }
    } catch {
      const localList = await getLocalVerificationsForProject(wId);
      setHistoryRecords(localList || []);
    } finally {
      setLoadingHistory(false);
    }
  }, [syncState.isOnline]);

  // When activeProject changes, pre-populate form progress
  useEffect(() => {
    if (activeProject) {
      setProgress(activeProject.physical_progress || 0);
      setRemarks('');
      setSaveSuccessMessage(null);
      setRiskDeltaInfo(null);
      setConflictDetail(null);
      loadHistory(activeProject.work_id);
    }
  }, [activeProject, loadHistory]);

  // GPS Coordinate Capture
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setIsCapturingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)));
        setLongitude(Number(position.coords.longitude.toFixed(6)));
        setIsCapturingGps(false);
        addToast(`GPS captured: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`, 'success');
      },
      (error) => {
        setIsCapturingGps(false);
        setGpsError(`GPS permission denied or unavailable (${error.message}). Manual verification permitted.`);
        addToast('GPS coordinates unavailable. Continuing with manual field verification.', 'info');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Image Upload & Client Compression
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use HTML Canvas to compress image for safe local IndexedDB footprint
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = Math.min(img.width, MAX_WIDTH);
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setEvidencePhoto(dataUrl);
        setPhotoPreview(dataUrl);
        addToast('Inspection photograph attached.', 'info');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Save Field Verification
  const handleSaveVerification = async (e) => {
    e.preventDefault();
    if (!activeProject) return;

    setIsSaving(true);
    setSaveSuccessMessage(null);
    setRiskDeltaInfo(null);
    setConflictDetail(null);

    const operationId = `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const verifiedTimestamp = new Date().toISOString();

    const verificationPayload = {
      progress: Number(progress),
      verification_status: verificationStatus,
      remarks: remarks.trim() || 'Field verification recorded.',
      latitude: latitude ?? (activeProject.latitude || null),
      longitude: longitude ?? (activeProject.longitude || null),
      verified_at: verifiedTimestamp,
      evidence_photo: evidencePhoto || null,
      expected_version: activeProject.version || 1
    };

    try {
      // 1. Always record in local IndexedDB first (Offline-First guarantee)
      await saveLocalVerificationRecord({
        operation_id: operationId,
        project_id: activeProject.work_id,
        progress: Number(progress),
        verification_status: verificationStatus,
        remarks: remarks.trim(),
        latitude: verificationPayload.latitude,
        longitude: verificationPayload.longitude,
        verified_at: verifiedTimestamp,
        has_photo: Boolean(evidencePhoto),
        evidence_photo: evidencePhoto || null,
        sync_status: syncState.isOnline ? 'syncing' : 'pending',
        created_at: verifiedTimestamp
      });

      // 2. Enqueue into sync_queue
      await enqueueOperation({
        operation_id: operationId,
        project_id: activeProject.work_id,
        payload: verificationPayload,
        created_at: verifiedTimestamp,
        status: syncState.isOnline ? 'pending' : 'pending'
      });

      // 3. If online, trigger sync immediately
      if (syncState.isOnline) {
        addToast('Saving verification and synchronizing with Central AI Engine...', 'info');
        await syncManager.triggerSync();
        
        // Check updated status
        const updatedLocal = await getCachedProject(activeProject.work_id);
        if (updatedLocal) {
          setSaveSuccessMessage('Verification synchronized successfully with Central AI Engine.');
          setRiskDeltaInfo({
            currentRisk: updatedLocal.overall_risk_score,
            currentLevel: updatedLocal.risk_level
          });
        }
      } else {
        // Offline response
        setSaveSuccessMessage('You are offline. Changes saved locally in IndexedDB. Waiting for synchronization.');
        addToast('Offline: Verification stored locally in sync queue.', 'warning');
      }

      // Reload project history and local projects
      await loadProjects();
      await loadHistory(activeProject.work_id);
    } catch (err) {
      if (err.status === 409 || err.message?.includes('Conflict')) {
        setConflictDetail('This project was updated after it was downloaded. Your offline verification could not automatically overwrite the newer server information. Review the latest project information before submitting again.');
      } else {
        addToast(`Save error: ${err.message}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return cachedProjects;
    const q = searchQuery.toLowerCase();
    return cachedProjects.filter(p => 
      p.work_id.toLowerCase().includes(q) || 
      p.work_title.toLowerCase().includes(q) ||
      p.district.toLowerCase().includes(q)
    );
  }, [cachedProjects, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E4DC] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#050505] tracking-tight">
              Offline-First Field Verification
            </h1>
            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              syncState.isOnline ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/25' : 'bg-[#E6A23C]/10 text-[#916540] border-[#E6A23C]/25'
            }`}>
              {syncState.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{syncState.isOnline ? 'Online Sync Active' : 'Offline Mode Active'}</span>
            </span>
          </div>
          <p className="text-xs text-[#5E5E5D] mt-1">
            Empower field engineers and audit officers to collect spot verification evidence without network access.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="text-xs text-[#5E5E5D] bg-[#FFFFFF] px-3 py-1.5 rounded-xl border border-[#E8E4DC] shadow-xs">
            Cached Projects: <strong className="text-[#050505]">{cachedProjects.length}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Selector, Right Verification Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Project Selector (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#050505] uppercase tracking-wider">
              Assigned Projects ({filteredProjects.length})
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#5E5E5D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID, title, district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8E4DC] rounded-xl text-xs text-[#050505] focus:outline-none focus:border-[#4B3C32] transition-all"
            />
          </div>

          {/* Project List */}
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredProjects.map((p) => {
              const isSelected = p.work_id === selectedWorkId;
              return (
                <div
                  key={p.work_id}
                  onClick={() => setSelectedWorkId(p.work_id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FFFFFF] border-[#4B3C32] shadow-xs ring-1 ring-[#4B3C32]/20'
                      : 'bg-white border-[#E8E4DC] hover:border-[#C8BFB3] hover:bg-[#F7F7F1]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[#050505] font-mono">{p.work_id}</span>
                    <RiskBadge level={p.risk_level} score={p.overall_risk_score} size="xs" />
                  </div>
                  <div className="font-medium text-[#050505] mt-1 line-clamp-1">{p.work_title}</div>
                  <div className="flex items-center justify-between text-[11px] text-[#5E5E5D] mt-2 pt-2 border-t border-[#E8E4DC]/60">
                    <span>{p.district}</span>
                    <span>Prog: <strong className="text-[#050505]">{p.physical_progress}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Verification Form & Dossier (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-5">
          
          {activeProject ? (
            <>
              {/* Active Project Meta Dossier Card */}
              <div className="gov-card p-5 border-l-4 border-l-[#4B3C32] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-[#4B3C32] bg-[#F7F7F1] px-2 py-0.5 rounded-lg border border-[#E8E4DC]">
                      {activeProject.work_id}
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-[#050505] mt-1.5">
                      {activeProject.work_title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={activeProject.risk_level} score={activeProject.overall_risk_score} />
                    <span className="text-[11px] text-[#5E5E5D] bg-[#F7F7F1] px-2 py-1 rounded-lg border border-[#E8E4DC]">
                      v{activeProject.version || 1}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-[#E8E4DC]">
                  <div>
                    <span className="text-[#5E5E5D]">District / State:</span>
                    <div className="font-semibold text-[#050505]">{activeProject.district}, {activeProject.state}</div>
                  </div>
                  <div>
                    <span className="text-[#5E5E5D]">Sanctioned Cost:</span>
                    <div className="font-semibold text-[#050505]">₹{((activeProject.sanctioned_amount || 0) / 100000).toFixed(2)} L</div>
                  </div>
                  <div>
                    <span className="text-[#5E5E5D]">Reported Progress:</span>
                    <div className="font-semibold text-[#050505]">{activeProject.physical_progress}%</div>
                  </div>
                  <div>
                    <span className="text-[#5E5E5D]">Financial Spent:</span>
                    <div className="font-semibold text-[#050505]">{activeProject.financial_progress}%</div>
                  </div>
                </div>
              </div>

              {/* Status or Conflict Banners */}
              {conflictDetail && (
                <div className="p-4 bg-[#C94C4C]/10 border border-[#C94C4C]/30 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#C94C4C] font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Optimistic Concurrency Conflict</span>
                  </div>
                  <p className="text-[#050505] leading-relaxed">
                    {conflictDetail}
                  </p>
                  <button
                    onClick={() => {
                      setConflictDetail(null);
                      loadProjects();
                    }}
                    className="btn-secondary py-1 px-3 text-xs bg-white"
                  >
                    Review Latest Data
                  </button>
                </div>
              )}

              {saveSuccessMessage && (
                <div className="p-4 bg-[#2E8B57]/10 border border-[#2E8B57]/25 rounded-2xl text-xs text-[#2E8B57] space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{saveSuccessMessage}</span>
                  </div>
                  {riskDeltaInfo && (
                    <div className="text-[11px] text-[#2E8B57]">
                      Updated Risk Score: <strong>{riskDeltaInfo.currentRisk} / 100 ({riskDeltaInfo.currentLevel})</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Field Verification Entry Form */}
              <form onSubmit={handleSaveVerification} className="gov-card p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#050505]">
                    <ClipboardCheck className="w-4 h-4 text-[#4B3C32]" />
                    <span>Record On-Ground Field Evidence</span>
                  </div>
                  <span className="text-[11px] text-[#5E5E5D]">
                    Officer: <strong>FIELD_OFFICER_01</strong>
                  </span>
                </div>

                {/* 1. Verified Physical Progress % */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-[#050505]">
                      Verified Physical Progress on Ground: <span className="text-[#4B3C32] font-bold text-sm">{progress}%</span>
                    </label>
                    <span className="text-[11px] text-[#5E5E5D]">
                      Previously Recorded: {activeProject.physical_progress}%
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={progress}
                      onChange={(e) => setProgress(parseFloat(e.target.value))}
                      className="flex-1 accent-[#4B3C32] cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={progress}
                      onChange={(e) => setProgress(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-16 text-center font-bold text-xs py-1.5 border border-[#E8E4DC] rounded-xl focus:outline-none focus:border-[#4B3C32]"
                    />
                  </div>
                </div>

                {/* 2. Verification Status */}
                <div className="space-y-1.5 text-xs">
                  <label className="font-semibold text-[#050505] block">
                    Field Verification Status Determination
                  </label>
                  <select
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value)}
                    className="w-full bg-[#F7F7F1]/70 text-xs font-medium text-[#050505] px-3 py-2 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32]"
                  >
                    <option value="FULLY_VERIFIED">Fully Verified — Physical Milestones Match Sanction</option>
                    <option value="PARTIALLY_VERIFIED">Partially Verified — Work In Progress Tracks Milestones</option>
                    <option value="DISCREPANCY_FOUND">Discrepancy Found — Physical Work Diverges from Drawdown</option>
                    <option value="WORK_NOT_STARTED">Work Not Started — No Physical Activity on Site</option>
                  </select>
                </div>

                {/* 3. GPS Coordinates Capture */}
                <div className="p-3 bg-[#F7F7F1]/60 rounded-xl border border-[#E8E4DC] space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[#050505] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#4B3C32]" />
                        <span>Site Geolocation Coordinates</span>
                      </span>
                      <p className="text-[11px] text-[#5E5E5D] mt-0.5">
                        {latitude && longitude
                          ? `Lat: ${latitude}, Lon: ${longitude}`
                          : `Registered: ${activeProject.latitude || 'N/A'}, ${activeProject.longitude || 'N/A'}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCaptureGps}
                      disabled={isCapturingGps}
                      className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#4B3C32]" />
                      <span>{isCapturingGps ? 'Locating GPS...' : 'Capture Current GPS'}</span>
                    </button>
                  </div>

                  {gpsError && (
                    <div className="text-[11px] text-[#916540] italic">
                      {gpsError}
                    </div>
                  )}
                </div>

                {/* 4. Photographic Evidence */}
                <div className="space-y-1.5 text-xs">
                  <label className="font-semibold text-[#050505] block">
                    Geotagged Photographic Proof (Optional / Compressed for Offline)
                  </label>
                  
                  <div className="flex items-center gap-3">
                    <label className="btn-secondary py-2 px-3 text-xs flex items-center gap-2 cursor-pointer">
                      <Camera className="w-4 h-4 text-[#5E5E5D]" />
                      <span>Capture / Attach Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    {photoPreview && (
                      <div className="relative inline-block">
                        <img 
                          src={photoPreview} 
                          alt="Verification preview" 
                          className="w-14 h-14 object-cover rounded-xl border border-[#E8E4DC]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEvidencePhoto(null);
                            setPhotoPreview(null);
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-[#C94C4C] text-white rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Ground Inspection Remarks */}
                <div className="space-y-1.5 text-xs">
                  <label className="font-semibold text-[#050505] block">
                    Ground Inspection Observations & Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter on-site findings e.g. foundation laid, superstructure 50% complete, structural quality, contractor presence..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-[#F7F7F1]/70 text-xs text-[#050505] p-3 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32]"
                  />
                </div>

                {/* Save Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DC]">
                  <div className="text-[11px] text-[#5E5E5D] flex items-center gap-1.5">
                    {syncState.isOnline ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[#2E8B57]" />
                        <span>Online: will sync immediately</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[#E6A23C]" />
                        <span>Offline: will queue in IndexedDB</span>
                      </>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary text-xs flex items-center gap-1.5 py-2 px-5"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>{isSaving ? 'Recording Evidence...' : 'Save Verification'}</span>
                  </button>
                </div>
              </form>

              {/* Historical Verification Ledger */}
              <div className="gov-card p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#050505]">
                    Field Verification History ({historyRecords.length})
                  </span>
                  <span className="text-[11px] text-[#5E5E5D]">
                    Work ID: {activeProject.work_id}
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="py-4 text-center text-xs text-[#5E5E5D]">Loading audit trail...</div>
                ) : historyRecords.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[#5E5E5D]">
                    No previous field verification recorded for this project.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {historyRecords.map((rec, idx) => (
                      <div
                        key={rec.verification_id || rec.operation_id || idx}
                        className="p-3.5 rounded-xl border border-[#E8E4DC] bg-[#F7F7F1]/50 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#050505]">
                              {new Date(rec.verified_at || rec.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20">
                              Progress: {rec.progress}%
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${
                            rec.sync_status === 'synced' ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20' : 'bg-[#E6A23C]/10 text-[#916540] border-[#E6A23C]/20'
                          }`}>
                            {rec.sync_status || 'Synced'}
                          </span>
                        </div>

                        <div className="text-[#5E5E5D] text-[11px]">
                          <strong>Status:</strong> {rec.verification_status} · <strong>Officer:</strong> {rec.user_id}
                        </div>

                        {rec.remarks && (
                          <div className="text-[11px] text-[#050505] italic bg-white p-2 rounded-lg border border-[#E8E4DC]">
                            "{rec.remarks}"
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-[#5E5E5D] pt-1">
                          <span>Location Captured: {rec.latitude && rec.longitude ? `Yes (${rec.latitude}, ${rec.longitude})` : 'No'}</span>
                          <span>Ref: {rec.verification_id || rec.operation_id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="gov-card p-12 text-center text-xs text-[#5E5E5D]">
              Select a project from the left registry to start field verification.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
