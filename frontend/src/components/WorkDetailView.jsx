import React, { useState, useEffect, useCallback } from 'react';
import RiskBadge from './RiskBadge';
import { 
  ArrowLeft, 
  Printer, 
  TrendingUp, 
  Clock, 
  Copy, 
  FileCheck, 
  AlertCircle, 
  MapPin, 
  Building2, 
  ShieldAlert, 
  Send, 
  X, 
  Map as MapIcon, 
  ClipboardCheck, 
  Activity, 
  User, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { fetchWorkExplanation, fetchWorkById, fetchProjectVerifications } from '../api/client';
import { getLocalVerificationsForProject, getCachedProject } from '../services/db';
import { useToast } from './Toast';

export default function WorkDetailView({ 
  workId, 
  initialWork,
  onBack, 
  onOpenDuplicateDiff,
  onViewOnMap,
  onOpenFieldVerification
}) {
  const { addToast } = useToast();
  const [dossier, setDossier] = useState(initialWork || null);
  const [loading, setLoading] = useState(!initialWork);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(null);
  
  // Interactive Action Determination Modal State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [selectedAction, setSelectedAction] = useState('SCHEDULE_INSPECTION');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [verifications, setVerifications] = useState([]);

  const loadWorkDetails = useCallback(async (retryCount = 0) => {
    if (!workId) return;
    if (retryCount === 0 && !dossier) {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch explanation and raw work details concurrently for complete coverage
      const [expRes, workRes] = await Promise.allSettled([
        fetchWorkExplanation(workId),
        fetchWorkById(workId)
      ]);

      const expData = expRes.status === 'fulfilled' ? expRes.value : null;
      const workData = workRes.status === 'fulfilled' ? workRes.value : null;

      if (!expData && !workData) {
        // If network failed and retry attempts remain, retry with progressive backoff (handles server warmup)
        if (retryCount < 2) {
          setTimeout(() => {
            loadWorkDetails(retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        }

        // Check if cached project is available offline in IndexedDB
        try {
          const cached = await getCachedProject(workId);
          if (cached) {
            setDossier(cached);
            setLoading(false);
            setRetrying(false);
            return;
          }
        } catch {}

        const primaryReason = expRes.reason?.message || workRes.reason?.message || `Failed to load details for ${workId}`;
        throw new Error(primaryReason);
      }

      // Merge both payloads seamlessly so all fields are available
      const merged = { ...(workData || {}), ...(expData || {}) };
      
      // Ensure critical progress and financial metrics from work record take precedence if missing in explanation
      if (workData) {
        if (workData.physical_progress !== undefined && merged.physical_progress === undefined) {
          merged.physical_progress = workData.physical_progress;
        }
        if (workData.financial_progress !== undefined && merged.financial_progress === undefined) {
          merged.financial_progress = workData.financial_progress;
        }
        if (workData.actual_expenditure !== undefined && merged.actual_expenditure === undefined) {
          merged.actual_expenditure = workData.actual_expenditure;
        }
        if (workData.latitude !== undefined && merged.latitude === undefined) {
          merged.latitude = workData.latitude;
        }
        if (workData.longitude !== undefined && merged.longitude === undefined) {
          merged.longitude = workData.longitude;
        }
        if (workData.sanction_date && !merged.sanction_date) {
          merged.sanction_date = workData.sanction_date;
        }
        if (workData.start_date && !merged.start_date) {
          merged.start_date = workData.start_date;
        }
        if (workData.expected_completion_date && !merged.expected_completion_date) {
          merged.expected_completion_date = workData.expected_completion_date;
        }
        if (workData.vendor && !merged.vendor) {
          merged.vendor = workData.vendor;
        }
      }

      setDossier(merged);
      setLoading(false);
      setRetrying(false);
    } catch (err) {
      // Check offline cache as fallback
      try {
        const cached = await getCachedProject(workId);
        if (cached) {
          setDossier(cached);
          setLoading(false);
          setRetrying(false);
          return;
        }
      } catch {}

      let displayMsg = err.message || 'Failed to load work details';
      if (displayMsg === 'Failed to fetch' || displayMsg.includes('NetworkError') || displayMsg.includes('Failed to connect')) {
        displayMsg = 'Unable to connect to the MPLADS analytical backend on port 8001. Please verify the backend server is running.';
      }

      setError(displayMsg);
      setLoading(false);
      setRetrying(false);
    }
  }, [workId]);

  useEffect(() => {
    if (!workId) return;
    loadWorkDetails(0);

    // Fetch verification audit history
    fetchProjectVerifications(workId)
      .then((data) => setVerifications(data.verifications || []))
      .catch(() => {
        getLocalVerificationsForProject(workId)
          .then((local) => setVerifications(local || []))
          .catch(() => setVerifications([]));
      });
  }, [workId, loadWorkDetails]);

  if (!workId) return null;

  const handlePrintNotice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !dossier) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Field Verification Directive - ${dossier.work_id}</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 40px; color: #111; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .sub { font-size: 13px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
          td { padding: 7px; border: 1px solid #ccc; font-size: 13px; }
          .label { font-weight: bold; width: 30%; background: #f9f9f9; }
          .section-title { font-size: 13px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; text-decoration: underline; }
          .evidence-list { margin-left: 20px; font-size: 13px; }
          .directive { background: #fcf8e3; border: 1px solid #faebcc; padding: 10px; margin-top: 15px; font-size: 13px; font-weight: bold; }
          .signatures { margin-top: 50px; display: flex; justify-content: space-between; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">OFFICE OF THE DISTRICT MAGISTRATE & NODAL OFFICER (MPLADS)</div>
          <div class="sub">District: ${dossier.district || 'N/A'} | State: ${dossier.state || 'N/A'}</div>
          <div class="sub">Statutory Project Field Verification & Audit Notice</div>
        </div>

        <p><strong>Order Ref:</strong> MPLADS/INQ/${(dossier.district || 'DISTRICT').toUpperCase()}/${new Date().getFullYear()}/${dossier.work_id}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>

        <table>
          <tr><td class="label">Work ID</td><td>${dossier.work_id}</td></tr>
          <tr><td class="label">Work Title</td><td>${dossier.work_title || 'N/A'}</td></tr>
          <tr><td class="label">Work Category</td><td>${dossier.work_category || 'N/A'}</td></tr>
          <tr><td class="label">Unified Risk Score</td><td><strong>${dossier.overall_risk_score ?? 0} / 100 (${dossier.risk_level || 'UNSPECIFIED'})</strong></td></tr>
          <tr><td class="label">Primary Signal</td><td>${dossier.primary_risk_factor || 'N/A'}</td></tr>
        </table>

        <div class="section-title">EMPIRICAL GROUNDS FOR SPOT VERIFICATION:</div>
        <ul class="evidence-list">
          ${(dossier.evidence_summary || []).map((e) => `<li>${e}</li>`).join('')}
        </ul>

        <div class="section-title">ORDERED ADMINISTRATIVE DIRECTIVE:</div>
        <div class="directive">
          ${dossier.recommended_action || 'Review fund-release eligibility according to applicable rules and pending documentation.'}
        </div>

        <p style="margin-top: 15px; font-size: 13px;">
          The designated Junior/Assistant Engineer is directed to conduct an on-site physical inspection, 
          record geotagged photographic proof of actual linear/spatial progress, and submit a compliance verification report within 7 working days.
        </p>

        <div class="signatures">
          <div><br><br>__________________________<br>Inspecting Officer</div>
          <div style="text-align: right;"><br><br>__________________________<br>District Magistrate / Collector<br>${dossier.district || 'District Authority'}</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleRecordAction = (e) => {
    e.preventDefault();
    setIsSubmittingAction(true);
    setTimeout(() => {
      setIsSubmittingAction(false);
      setIsActionModalOpen(false);
      addToast(`Administrative determination recorded for ${dossier.work_id}.`, 'success');
      setVerifications((prev) => [
        {
          verification_id: `DET-${Date.now().toString().slice(-6)}`,
          created_at: new Date().toISOString(),
          verification_status: selectedAction.replace(/_/g, ' '),
          progress: dossier?.physical_progress || 0,
          sync_status: 'Recorded',
          user_id: 'District Magistrate / Nodal Authority',
          remarks: inspectorNotes || `Statutory Order Issued: ${selectedAction.replace(/_/g, ' ')}`,
          latitude: dossier?.latitude,
          longitude: dossier?.longitude
        },
        ...prev
      ]);
      setInspectorNotes('');
    }, 600);
  };

  // Helper formatting values
  const sanctionedLakhs = dossier?.sanctioned_amount != null
    ? (Number(dossier.sanctioned_amount) / 100000).toFixed(2)
    : null;
  const expenditureLakhs = dossier?.actual_expenditure != null
    ? (Number(dossier.actual_expenditure) / 100000).toFixed(2)
    : null;
  const cohortMedianLakhs = (dossier?.cost_evaluation?.cohort_median != null || dossier?.cost_evaluation?.peer_median != null)
    ? ((Number(dossier.cost_evaluation.cohort_median || dossier.cost_evaluation.peer_median)) / 100000).toFixed(2)
    : sanctionedLakhs;
  
  const finProg = Number(dossier?.financial_progress ?? 0);
  const physProg = Number(dossier?.physical_progress ?? 0);
  const progGap = finProg - physProg;

  const hasCoords = Boolean(
    dossier?.latitude && 
    dossier?.longitude && 
    !isNaN(dossier.latitude) && 
    !isNaN(dossier.longitude) &&
    dossier.latitude >= 8.0 && 
    dossier.latitude <= 37.5 &&
    dossier.longitude >= 68.0 && 
    dossier.longitude <= 97.5
  );

  const duplicateCandidate = dossier?.duplicate_match || (dossier?.duplicate_evaluation?.has_candidate ? dossier.duplicate_evaluation : null);

  const getStatusColor = (st) => {
    const s = (st || '').toUpperCase();
    if (s === 'COMPLETED') return 'bg-[#EEF7F2] text-[#2E8B57] border-[#D1E8DC]';
    if (s === 'STALLED') return 'bg-[#FDF4F4] text-[#C94C4C] border-[#FADCDA]';
    if (s === 'SANCTIONED') return 'bg-[#FEF8ED] text-[#B87D28] border-[#F8E5C4]';
    return 'bg-[#F0F7FB] text-[#1F5F8B] border-[#D5E8F3]'; // IN_PROGRESS, ONGOING
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. TOP BREADCRUMB & ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-semibold text-[#12355B] hover:text-[#1F5F8B] transition-colors py-1.5 px-3 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F7F9FB] shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Work Registry</span>
          </button>
          <span className="text-[#CBD5E1]">/</span>
          <span className="text-[#536878] font-medium hidden md:inline truncate max-w-[180px]">
            {dossier?.work_category || 'Work Details'}
          </span>
          <span className="text-[#CBD5E1] hidden md:inline">/</span>
          <span className="text-[#17212B] font-mono font-semibold truncate max-w-[200px]">
            {workId}
          </span>
        </div>

        {dossier && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handlePrintNotice}
              className="inline-flex items-center gap-1.5 py-2 px-3 text-xs font-medium text-[#17212B] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F7F9FB] transition-colors shadow-xs"
              title="Print formal statutory inspection notice"
            >
              <Printer className="w-3.5 h-3.5 text-[#536878]" />
              <span>Print Notice</span>
            </button>

            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(dossier.work_id)}
                className="inline-flex items-center gap-1.5 py-2 px-3 text-xs font-medium text-[#17212B] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F7F9FB] transition-colors shadow-xs"
                title="View on Risk Map"
              >
                <MapIcon className="w-3.5 h-3.5 text-[#168A8A]" />
                <span>Map View</span>
              </button>
            )}

            {onOpenFieldVerification && (
              <button
                onClick={() => onOpenFieldVerification(dossier.work_id)}
                className="inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-medium text-white bg-[#168A8A] hover:bg-[#127070] transition-colors rounded-xl shadow-xs"
                title="Open Offline Ground Verification PWA"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Field Verification</span>
              </button>
            )}

            <button
              onClick={() => setIsActionModalOpen(true)}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-medium text-white bg-[#12355B] hover:bg-[#0E2A48] transition-colors rounded-xl shadow-xs"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Administrative Action</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-[#536878] border border-[#E2E8F0] shadow-xs">
          <div className="inline-block w-8 h-8 border-3 border-[#12355B] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-[#17212B]">Loading Project Dossier & Risk Intelligence...</p>
          <p className="text-xs text-[#536878] mt-1">Retrieving forensic audit metrics and peer cohort baselines</p>
        </div>
      ) : error ? (
        <div className="bg-[#FDF4F4] rounded-2xl p-8 text-center text-[#C94C4C] border border-[#FADCDA] max-w-lg mx-auto my-8 shadow-xs">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#C94C4C]" />
          <p className="text-sm font-bold">Failed to load work details</p>
          <p className="text-xs mt-1 text-[#7A271A] leading-relaxed">{error}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button 
              onClick={() => {
                setRetrying(true);
                loadWorkDetails(0);
              }}
              disabled={retrying}
              className="px-4 py-2 text-xs font-semibold bg-[#C94C4C] text-white rounded-xl hover:bg-[#b03d3d] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying...' : 'Retry Connection'}
            </button>
            <button 
              onClick={onBack}
              className="px-4 py-2 text-xs font-semibold bg-white border border-[#FADCDA] text-[#C94C4C] rounded-xl hover:bg-[#FDF4F4] transition-all cursor-pointer"
            >
              Return to Work Registry
            </button>
          </div>
        </div>
      ) : dossier ? (
        <>
          {/* 2. TOP PROJECT HEADER CARD */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              
              {/* Left Column: Project Identity & Location */}
              <div className="space-y-3 flex-1 min-w-0">
                {/* Badge Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#12355B] bg-[#EBF3FB] px-3 py-1 rounded-lg border border-[#D0E2F4]">
                    {dossier.work_id}
                  </span>
                  <span className="text-xs font-semibold text-[#1F5F8B] bg-[#F0F7FB] px-2.5 py-1 rounded-lg border border-[#D5E8F3]">
                    {dossier.work_category || 'General Works'}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getStatusColor(dossier.status)}`}>
                    ● {dossier.status || 'IN_PROGRESS'}
                  </span>
                </div>

                {/* Main Work Title */}
                <h1 className="text-xl sm:text-2xl font-bold text-[#17212B] tracking-tight leading-snug">
                  {dossier.work_title || 'MPLADS Development Project'}
                </h1>

                {/* Sub-Metadata Bar */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#536878] pt-1">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#17212B]">
                    <MapPin className="w-3.5 h-3.5 text-[#168A8A] shrink-0" />
                    {dossier.village || dossier.ward ? `${dossier.village || dossier.ward}, ` : ''}{dossier.district || 'District'}, {dossier.state || 'State'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-[#1F5F8B] shrink-0" />
                    Agency: <span className="text-[#17212B]">{dossier.implementing_agency || 'District Rural Development Agency'}</span>
                  </span>
                  {dossier.mp_name && (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-[#536878] shrink-0" />
                      MP: <strong className="text-[#17212B]">{dossier.mp_name}</strong> {dossier.constituency ? `(${dossier.constituency})` : ''}
                    </span>
                  )}
                </div>

                {/* Quick Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mt-1 border-t border-[#F1F5F9] text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#536878] block">Sanctioned Amount</span>
                    <strong className="text-[#17212B] font-bold text-sm">
                      {sanctionedLakhs ? `₹${sanctionedLakhs} Lakhs` : 'Not available'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#536878] block">Actual Expenditure</span>
                    <strong className="text-[#17212B] font-bold text-sm">
                      {expenditureLakhs ? `₹${expenditureLakhs} Lakhs` : 'No data'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#536878] block">Block / Tehsil</span>
                    <span className="text-[#17212B] font-semibold">
                      {dossier.block || dossier.city || 'District Nodal Area'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#536878] block">Sanction Date</span>
                    <span className="text-[#17212B] font-semibold">
                      {dossier.sanction_date || dossier.recommendation_date || 'Standard Period'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Unified Risk Score Showcase */}
              <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 p-4 sm:p-5 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] shrink-0 min-w-[240px]">
                <div className="text-left lg:text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#536878] block mb-1">
                    Unified Risk Score
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-[#17212B] tracking-tight">
                    {dossier.overall_risk_score ?? 0}
                    <span className="text-sm font-normal text-[#536878] ml-1">/ 100</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <RiskBadge score={dossier.overall_risk_score} level={dossier.risk_level} size="lg" />
                  <span className="text-[11px] text-[#536878] font-medium text-right">
                    Primary Driver: <strong className="text-[#17212B]">{dossier.primary_risk_factor || 'Multifactorial'}</strong>
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* 3. KEY SUMMARY CARDS (4-METRIC GRID) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Financial / Cost Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#536878]">Financial / Cost</span>
                <div className="w-8 h-8 rounded-xl bg-[#EBF3FB] text-[#1F5F8B] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-[#17212B] tracking-tight">
                {sanctionedLakhs ? `₹${sanctionedLakhs}L` : 'No data'}
              </div>
              <p className="text-xs text-[#536878] mt-1">
                {expenditureLakhs 
                  ? `₹${expenditureLakhs}L spent (${finProg}% disbursed)` 
                  : 'Expenditure figures pending upload'}
              </p>
            </div>

            {/* Delay & Execution Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#536878]">Delay / Stagnation</span>
                <div className="w-8 h-8 rounded-xl bg-[#FEF8ED] text-[#E6A23C] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-[#17212B] tracking-tight">
                {physProg}% Physical Progress
              </div>
              <p className="text-xs text-[#536878] mt-1">
                {dossier.delay_evaluation?.days_overdue > 0 
                  ? `${dossier.delay_evaluation.days_overdue} days past target completion` 
                  : dossier.delay_evaluation?.days_since_update > 0
                  ? `${dossier.delay_evaluation.days_since_update} days since status report`
                  : 'Timeline within standard progress window'}
              </p>
            </div>

            {/* Duplicate / Overlap Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#536878]">Duplicate / Overlap</span>
                <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] text-[#6B46C1] flex items-center justify-center">
                  <Copy className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-[#17212B] tracking-tight truncate">
                {duplicateCandidate 
                  ? 'Candidate Detected' 
                  : 'No Overlap Found'}
              </div>
              <p className="text-xs text-[#536878] mt-1 truncate">
                {duplicateCandidate?.distance_meters != null
                  ? `${Number(duplicateCandidate.distance_meters).toFixed(1)}m from ${duplicateCandidate.paired_work_id || 'co-located work'}`
                  : 'Zero spatial proximity conflict identified'}
              </p>
            </div>

            {/* Compliance Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#536878]">Compliance Deficit</span>
                <div className="w-8 h-8 rounded-xl bg-[#EEF7F2] text-[#2E8B57] flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-[#17212B] tracking-tight">
                {dossier.component_breakdown?.compliance_risk?.score ?? 0} / 15 Pts
              </div>
              <p className="text-xs text-[#536878] mt-1">
                {(dossier.component_breakdown?.compliance_risk?.score ?? 0) > 0
                  ? 'Statutory documentation review required'
                  : 'All mandatory milestone certificates logged'}
              </p>
            </div>

          </div>

          {/* 4. EXPLAINABLE RISK COMPONENTS (4-PILLAR MODEL) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                  Explainable Risk Components (4-Pillar Model)
                </h2>
                <p className="text-xs text-[#536878] mt-0.5">
                  Normalized audit breakdown based on leave-one-out statistical cohorts and empirical threshold rules.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#536878] bg-[#F7F9FB] px-2.5 py-1 rounded-lg border border-[#E2E8F0] self-start sm:self-auto">
                Max Score: 100 Points
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Financial Risk Pillar */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-[#536878] mb-1.5">
                    <span className="font-semibold text-[#17212B]">Financial / Cost</span>
                    <TrendingUp className="w-4 h-4 text-[#168A8A]" />
                  </div>
                  <div className="text-2xl font-extrabold text-[#17212B] tracking-tight">
                    {dossier.component_breakdown?.financial_risk?.score ?? 0}
                    <span className="text-xs font-normal text-[#536878]"> / {dossier.component_breakdown?.financial_risk?.max ?? 30}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-2 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, (((dossier.component_breakdown?.financial_risk?.score ?? 0) / 30) * 100))}%` }}
                      className="h-full bg-[#168A8A] rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] text-[11px] text-[#536878] space-y-0.5">
                  <div>Peer Median: <strong className="text-[#17212B]">₹{cohortMedianLakhs}L</strong></div>
                  <div>Cost Ratio: <strong className="text-[#17212B]">{dossier.cost_evaluation?.cost_ratio ? `${dossier.cost_evaluation.cost_ratio}×` : '1.0×'}</strong></div>
                  {dossier.cost_evaluation?.modified_z != null && (
                    <div>Mod Z-Score: <strong className="text-[#17212B]">{Number(dossier.cost_evaluation.modified_z).toFixed(2)}</strong></div>
                  )}
                </div>
              </div>

              {/* Delay Risk Pillar */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-[#536878] mb-1.5">
                    <span className="font-semibold text-[#17212B]">Delay / Stagnation</span>
                    <Clock className="w-4 h-4 text-[#E6A23C]" />
                  </div>
                  <div className="text-2xl font-extrabold text-[#17212B] tracking-tight">
                    {dossier.component_breakdown?.delay_risk?.score ?? 0}
                    <span className="text-xs font-normal text-[#536878]"> / {dossier.component_breakdown?.delay_risk?.max ?? 30}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-2 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, (((dossier.component_breakdown?.delay_risk?.score ?? 0) / 30) * 100))}%` }}
                      className="h-full bg-[#E6A23C] rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] text-[11px] text-[#536878] space-y-0.5">
                  <div>Milestone Gap: <strong className="text-[#17212B]">{progGap > 0 ? `+${progGap}% gap` : '0%'}</strong></div>
                  <div>Inactivity: <strong className="text-[#17212B]">{dossier.delay_evaluation?.days_since_update ?? 0} days dormant</strong></div>
                  {dossier.delay_evaluation?.days_overdue > 0 && (
                    <div>Overdue: <strong className="text-[#C94C4C]">{dossier.delay_evaluation.days_overdue} days</strong></div>
                  )}
                </div>
              </div>

              {/* Duplicate Risk Pillar */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-[#536878] mb-1.5">
                    <span className="font-semibold text-[#17212B]">Duplicate / Overlap</span>
                    <Copy className="w-4 h-4 text-[#6B46C1]" />
                  </div>
                  <div className="text-2xl font-extrabold text-[#17212B] tracking-tight">
                    {dossier.component_breakdown?.duplicate_risk?.score ?? 0}
                    <span className="text-xs font-normal text-[#536878]"> / {dossier.component_breakdown?.duplicate_risk?.max ?? 25}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-2 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, (((dossier.component_breakdown?.duplicate_risk?.score ?? 0) / 25) * 100))}%` }}
                      className="h-full bg-[#6B46C1] rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] text-[11px] text-[#536878] space-y-0.5">
                  {duplicateCandidate ? (
                    <>
                      <div>Proximity: <strong className="text-[#17212B]">{Number(duplicateCandidate.distance_meters || 0).toFixed(1)}m</strong></div>
                      <div>Text Match: <strong className="text-[#17212B]">{Number(duplicateCandidate.text_similarity || 0).toFixed(1)}%</strong></div>
                      {duplicateCandidate.paired_work_id && (
                        <div className="truncate font-mono">Pair: {duplicateCandidate.paired_work_id}</div>
                      )}
                    </>
                  ) : (
                    <div>No overlapping asset within 150m spatial radius</div>
                  )}
                </div>
              </div>

              {/* Compliance Risk Pillar */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-[#536878] mb-1.5">
                    <span className="font-semibold text-[#17212B]">Compliance Deficit</span>
                    <FileCheck className="w-4 h-4 text-[#C94C4C]" />
                  </div>
                  <div className="text-2xl font-extrabold text-[#17212B] tracking-tight">
                    {dossier.component_breakdown?.compliance_risk?.score ?? 0}
                    <span className="text-xs font-normal text-[#536878]"> / {dossier.component_breakdown?.compliance_risk?.max ?? 15}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-2 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, (((dossier.component_breakdown?.compliance_risk?.score ?? 0) / 15) * 100))}%` }}
                      className="h-full bg-[#C94C4C] rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] text-[11px] text-[#536878] space-y-0.5">
                  <div>Completion UC: <strong className="text-[#17212B]">{(dossier.component_breakdown?.compliance_risk?.score ?? 0) >= 5 ? 'Review Pending' : 'Satisfied'}</strong></div>
                  <div>Asset Register: <strong className="text-[#17212B]">{(dossier.component_breakdown?.compliance_risk?.score ?? 0) > 0 ? 'Verification Due' : 'Logged'}</strong></div>
                  <div>Geotag Photo: <strong className="text-[#17212B]">{hasCoords ? 'Coordinates Valid' : 'Required'}</strong></div>
                </div>
              </div>

            </div>
          </div>

          {/* 5. EMPIRICAL EVIDENCE CHECKLIST */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                Empirical Evidence Checklist
              </h2>
              <p className="text-xs text-[#536878] mt-0.5">
                Transparent quantitative grounds computed by NIRIKSHAN justifying priority administrative inspection.
              </p>
            </div>

            <div className="space-y-3">
              {(dossier.evidence_summary || []).length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E2E8F0] text-xs text-[#536878]">
                  Work metrics and milestone progress track within expected cohort parameters.
                </div>
              ) : (
                (dossier.evidence_summary || []).map((evidence, idx) => {
                  const isHighAlert = (dossier.overall_risk_score >= 60);
                  return (
                    <div 
                      key={idx}
                      className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                        isHighAlert 
                          ? 'bg-[#FDF4F4] border-[#FADCDA] text-[#7A271A]' 
                          : 'bg-[#F7F9FB] border-[#E2E8F0] text-[#17212B]'
                      }`}
                    >
                      <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isHighAlert ? 'text-[#C94C4C]' : 'text-[#1F5F8B]'}`} />
                      <div className="text-xs font-medium leading-relaxed">
                        {evidence}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 6. ANALYTICS SECTION (2-COLUMN DASHBOARD LAYOUT) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Progress Divergence Analysis */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                    Progress Divergence Analysis
                  </h3>
                  <p className="text-[11px] text-[#536878]">Financial disbursements vs physically built asset milestones</p>
                </div>
                <Activity className="w-4 h-4 text-[#168A8A]" />
              </div>

              <div className="space-y-4 pt-1">
                {/* Financial Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#536878] font-medium">Financial Expenditure Disbursed</span>
                    <strong className="text-[#17212B] font-bold">
                      {finProg}% {expenditureLakhs ? `(₹${expenditureLakhs}L)` : ''}
                    </strong>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-3 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, finProg))}%` }} 
                      className="h-full bg-[#1F5F8B] rounded-full transition-all duration-500" 
                    />
                  </div>
                </div>

                {/* Physical Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#536878] font-medium">Physically Built Assets</span>
                    <strong className="text-[#17212B] font-bold">
                      {physProg}%
                    </strong>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-3 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, physProg))}%` }} 
                      className="h-full bg-[#2E8B57] rounded-full transition-all duration-500" 
                    />
                  </div>
                </div>

                {/* Divergence Notification Banner */}
                {progGap > 0 ? (
                  <div className="p-3.5 rounded-2xl bg-[#FEF8ED] border border-[#F8E5C4] text-xs text-[#7A4D05] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#E6A23C] shrink-0" />
                      <span>Physical milestone gap:</span>
                    </div>
                    <strong className="text-[#B87D28] font-mono text-sm whitespace-nowrap">
                      +{progGap.toFixed(1)} percentage points
                    </strong>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#EEF7F2] border border-[#D1E8DC] text-xs text-[#2E8B57] flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Physical completion milestones track in parity with financial releases.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Peer Cost Baselining */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                    Peer Cost Baselining (DSR Comparison)
                  </h3>
                  <p className="text-[11px] text-[#536878]">Statistical cost benchmarking against comparable constituency works</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[#1F5F8B]" />
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center text-xs border-b border-[#F1F5F9] pb-2.5">
                  <span className="text-[#536878]">This Work's Sanctioned Cost:</span>
                  <strong className="text-[#17212B] font-bold text-sm">
                    {sanctionedLakhs ? `₹${sanctionedLakhs} Lakhs` : 'No data'}
                  </strong>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-[#F1F5F9] pb-2.5">
                  <span className="text-[#536878]">Peer Cohort Median Rate:</span>
                  <strong className="text-[#17212B] font-bold text-sm">
                    ₹{cohortMedianLakhs} Lakhs
                  </strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[#536878]">Variance vs Peer Median:</span>
                    <strong className={dossier.cost_evaluation?.cost_ratio >= 1.2 ? 'text-[#C94C4C] font-bold' : 'text-[#2E8B57] font-bold'}>
                      {dossier.cost_evaluation?.cost_ratio 
                        ? `${dossier.cost_evaluation.cost_ratio >= 1 ? '+' : ''}${Math.round((dossier.cost_evaluation.cost_ratio - 1) * 100)}% (${dossier.cost_evaluation.cost_ratio}×)` 
                        : 'Within Peer Range'}
                    </strong>
                  </div>
                  <div className="text-[11px] text-[#536878] flex items-center justify-between">
                    <span>Cohort: {dossier.work_category} in {dossier.district}</span>
                    <span>Sample: N = {dossier.cost_evaluation?.peer_count ?? 1} projects</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 7. PROJECT INFORMATION (STRUCTURED 4-GROUP GRID) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
              Project Details & Administrative Metadata
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              
              {/* Group 1: Project Details */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#12355B] block border-b border-[#E2E8F0] pb-1.5">
                  Project Details
                </span>
                <div>
                  <span className="text-[#536878] block text-[11px]">Work ID:</span>
                  <span className="font-mono font-semibold text-[#17212B]">{dossier.work_id}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Category:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.work_category || 'General'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Status:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.status || 'IN_PROGRESS'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Recommendation Date:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.recommendation_date || 'Standard Period'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Evaluation Date:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.evaluation_date || 'Current Session'}</span>
                </div>
              </div>

              {/* Group 2: Location */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#12355B] block border-b border-[#E2E8F0] pb-1.5">
                  Location Hierarchy
                </span>
                <div>
                  <span className="text-[#536878] block text-[11px]">State:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.state || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">District:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.district || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Constituency:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.constituency || 'General Constituency'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Block / Tehsil:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.block || 'Nodal Subdivision'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Village / Ward:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.village || dossier.ward || 'Constituency Ward'}</span>
                </div>
                {hasCoords && (
                  <div>
                    <span className="text-[#536878] block text-[11px]">GPS Coordinates:</span>
                    <span className="font-mono text-[#168A8A] font-semibold">{dossier.latitude.toFixed(4)}°N, {dossier.longitude.toFixed(4)}°E</span>
                  </div>
                )}
              </div>

              {/* Group 3: Financial Details */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#12355B] block border-b border-[#E2E8F0] pb-1.5">
                  Financial Allocations
                </span>
                <div>
                  <span className="text-[#536878] block text-[11px]">Sanctioned Allocation:</span>
                  <span className="font-bold text-[#17212B]">{sanctionedLakhs ? `₹${sanctionedLakhs} Lakhs` : 'No record'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Actual Expenditure:</span>
                  <span className="font-bold text-[#17212B]">{expenditureLakhs ? `₹${expenditureLakhs} Lakhs` : 'Pending'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Disbursement Ratio:</span>
                  <span className="font-semibold text-[#17212B]">{finProg}% of sanctioned fund</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Sanction Order Date:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.sanction_date || 'Standard Reference'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">IDA Approval:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.ida_approval || 'Completed'}</span>
                </div>
              </div>

              {/* Group 4: Implementation */}
              <div className="p-4 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#12355B] block border-b border-[#E2E8F0] pb-1.5">
                  Implementation Agency
                </span>
                <div>
                  <span className="text-[#536878] block text-[11px]">Executing Agency:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.implementing_agency || 'District Rural Development Agency'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Registered Vendor:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.vendor || 'Authorized Tenderer'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Legislative House:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.house || 'Lok Sabha'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Member of Parliament:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.mp_name || 'Incumbent MP'}</span>
                </div>
                <div>
                  <span className="text-[#536878] block text-[11px]">Target Completion:</span>
                  <span className="font-semibold text-[#17212B]">{dossier.expected_completion_date || 'Standard Schedule'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* 8. MAP / LOCATION CARD */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                  Geographic Asset Mapping & GIS Coordinates
                </h2>
                <p className="text-xs text-[#536878]">
                  {hasCoords 
                    ? `Physical location: ${dossier.latitude.toFixed(4)}°N, ${dossier.longitude.toFixed(4)}°E (${dossier.district}, ${dossier.state})`
                    : `Geotag coordinates not supplied by executing agency. Scoped to ${dossier.district}, ${dossier.state}.`}
                </p>
              </div>

              {onViewOnMap && (
                <button
                  onClick={() => onViewOnMap(dossier.work_id)}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-[#1F5F8B] bg-[#F0F7FB] border border-[#D5E8F3] rounded-xl hover:bg-[#E5F2F9] transition-colors self-start sm:self-auto"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Open Full-Screen GIS Risk Map</span>
                </button>
              )}
            </div>

            {hasCoords ? (
              <div className="h-72 w-full rounded-2xl overflow-hidden border border-[#E2E8F0] relative z-0 isolate">
                <MapContainer
                  center={[dossier.latitude, dossier.longitude]}
                  zoom={13}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <CircleMarker
                    center={[dossier.latitude, dossier.longitude]}
                    radius={10}
                    pathOptions={{
                      color: dossier.overall_risk_score >= 60 ? '#C94C4C' : '#1F5F8B',
                      fillColor: dossier.overall_risk_score >= 60 ? '#C94C4C' : '#1F5F8B',
                      fillOpacity: 0.85
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <strong className="block text-[#17212B]">{dossier.work_title}</strong>
                        <div>Work ID: <span className="font-mono">{dossier.work_id}</span></div>
                        <div>Risk Score: <strong>{dossier.overall_risk_score}/100 ({dossier.risk_level})</strong></div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </MapContainer>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-[#F7F9FB] border border-[#E2E8F0] text-center text-xs text-[#536878]">
                <MapPin className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="font-semibold text-[#17212B]">Exact GPS coordinates pending from field engineer</p>
                <p className="mt-1">
                  Asset location logged under administrative jurisdiction: {dossier.village || dossier.ward || 'Ward'}, {dossier.block ? `${dossier.block}, ` : ''}{dossier.district}, {dossier.state}.
                </p>
              </div>
            )}
          </div>

          {/* 9. STATUTORY ADMINISTRATIVE DIRECTIVE */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border-l-4 border-l-[#12355B] border border-[#E2E8F0] shadow-xs space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                Statutory Administrative Directive & Recommended Action
              </h2>
              <p className="text-[11px] text-[#536878] mt-0.5">
                All recommendations are advisory decision-support signals. Final administrative determination remains exclusively with authorized officers.
              </p>
            </div>

            <div className="text-xs text-[#17212B] font-medium leading-relaxed bg-[#F7F9FB] p-4 rounded-2xl border border-[#E2E8F0]">
              {dossier.recommended_action || 'Review fund-release eligibility according to applicable rules and pending statutory documentation.'}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handlePrintNotice}
                className="inline-flex items-center gap-1.5 py-2 px-4 text-xs font-semibold text-[#17212B] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F7F9FB] transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-[#536878]" />
                <span>Export Field Verification Notice</span>
              </button>

              {onOpenFieldVerification && (
                <button
                  onClick={() => onOpenFieldVerification(dossier.work_id)}
                  className="inline-flex items-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-[#168A8A] hover:bg-[#127070] transition-colors rounded-xl shadow-xs"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Conduct Field Verification</span>
                </button>
              )}

              {duplicateCandidate?.paired_work_id && onOpenDuplicateDiff && (
                <button
                  onClick={() => onOpenDuplicateDiff(dossier.work_id, duplicateCandidate.paired_work_id)}
                  className="inline-flex items-center gap-1.5 py-2 px-4 text-xs font-semibold text-[#6B46C1] bg-[#F3E8FF] border border-[#E9D8FD] rounded-xl hover:bg-[#E9D8FD] transition-colors shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Inspect Duplicate Candidate ({duplicateCandidate.paired_work_id})</span>
                </button>
              )}

              <button
                onClick={() => setIsActionModalOpen(true)}
                className="inline-flex items-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-[#12355B] hover:bg-[#0E2A48] transition-colors rounded-xl shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Record Inspection Determination</span>
              </button>
            </div>
          </div>

          {/* 10. FIELD VERIFICATION AUDIT HISTORY */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#12355B]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#12355B]">
                  Field Verification History ({verifications.length})
                </h2>
              </div>
              {onOpenFieldVerification && (
                <button
                  onClick={() => onOpenFieldVerification(dossier.work_id)}
                  className="text-xs font-semibold text-[#168A8A] hover:underline"
                >
                  + New Spot Inspection
                </button>
              )}
            </div>

            {verifications.length === 0 ? (
              <p className="text-xs text-[#536878] py-2">
                No offline or online spot verification recorded yet for this work order. Use the button above to log empirical ground progress.
              </p>
            ) : (
              <div className="space-y-3 pt-1">
                {verifications.map((v, i) => (
                  <div
                    key={v.verification_id || v.operation_id || i}
                    className="p-4 rounded-2xl border border-[#E2E8F0] bg-[#F7F9FB] text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#17212B]">
                          {new Date(v.verified_at || v.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF7F2] text-[#2E8B57] border border-[#D1E8DC]">
                          Verified Progress: {v.progress}%
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#EEF7F2] text-[#2E8B57] border border-[#D1E8DC]">
                        {v.sync_status || 'Synced'}
                      </span>
                    </div>

                    <div className="text-[#536878] text-[11px]">
                      <strong>Status:</strong> {v.verification_status} · <strong>Officer:</strong> {v.user_id}
                    </div>

                    {v.remarks && (
                      <p className="text-[11px] text-[#17212B] italic bg-white p-3 rounded-xl border border-[#E2E8F0]">
                        "{v.remarks}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-[#536878]">
                      <span>Location: {v.latitude && v.longitude ? `${Number(v.latitude).toFixed(4)}°N, ${Number(v.longitude).toFixed(4)}°E` : 'Manual Entry'}</span>
                      <span className="font-mono">Ref: {v.verification_id || v.operation_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* 11. ACTION DETERMINATION MODAL */}
      {isActionModalOpen && (
        <div 
          className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4"
          onClick={() => setIsActionModalOpen(false)}
        >
          <div 
            className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E2E8F0] bg-[#F7F9FB]">
              <div>
                <h3 className="text-sm font-bold text-[#12355B] tracking-tight">
                  Record Administrative Action & Directive
                </h3>
                <p className="text-[11px] text-[#536878] mt-0.5">
                  Work ID: <span className="font-mono">{dossier?.work_id}</span> · {dossier?.district}
                </p>
              </div>
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="p-1.5 rounded-lg text-[#536878] hover:text-[#17212B] hover:bg-[#E2E8F0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordAction} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#17212B] mb-1.5">
                  Administrative Directive Type
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full bg-[#F7F9FB] hover:bg-white text-xs text-[#17212B] px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] focus:outline-none focus:border-[#12355B] focus:bg-white cursor-pointer transition-colors"
                >
                  <option value="SCHEDULE_INSPECTION">Order Physical Spot Inspection by Assistant Engineer (7 Days)</option>
                  <option value="WITHHOLD_DISBURSEMENT">Withhold Interim Fund Tranche Pending Measurement Book Audit</option>
                  <option value="REQUEST_DSR_JUSTIFICATION">Demand Technical Justification from Implementing Agency for Cost Outlier</option>
                  <option value="CLOSE_DUPLICATE">Verify Co-located Duplicate Asset and Initiate Recovery Notice</option>
                  <option value="APPROVE_CLEARED">Mark Satisfactorily Verified & Clear Risk Flag</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#17212B] mb-1.5">
                  Nodal Authority Audit Notes / Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter specific instructions for the inspecting officer or executive engineer..."
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  className="w-full bg-[#F7F9FB] text-xs text-[#17212B] p-3.5 rounded-xl border border-[#CBD5E1] focus:outline-none focus:border-[#12355B] focus:bg-white transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsActionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#536878] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F7F9FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#12355B] hover:bg-[#0E2A48] rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingAction ? 'Recording...' : 'Issue Statutory Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
