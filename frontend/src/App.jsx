import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import RoleContextBanner from './components/RoleContextBanner';
import KPICards from './components/KPICards';
import PriorityTable from './components/PriorityTable';
import WorksTableView from './components/WorksTableView';
import WorkDetailView from './components/WorkDetailView';
import CostAnomaliesView from './components/CostAnomaliesView';
import DelayStagnationView from './components/DelayStagnationView';
import DuplicatesView from './components/DuplicatesView';
import RiskMapView from './components/RiskMapView';
import ReportsView from './components/ReportsView';
import SettingsModal from './components/SettingsModal';
import CitizenView from './components/CitizenView';
import FieldVerificationView from './components/FieldVerificationView';
import { CardSkeleton, TableSkeleton } from './components/SkeletonLoader';
import {
  fetchSummary,
  fetchWorks,
  fetchDuplicateCandidates
} from './api/client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';

function AppContent() {
  const { addToast } = useToast();

  const [currentTab, setCurrentTab] = useState('COMMAND_CENTER');
  const [currentRole, setCurrentRole] = useState('MINISTRY');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Data state
  const [summary, setSummary] = useState(null);
  const [works, setWorks] = useState([]);
  const [duplicatePairs, setDuplicatePairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Work Dossier Inspection
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [verificationInitialWorkId, setVerificationInitialWorkId] =
    useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initialRiskFilter, setInitialRiskFilter] = useState('');

  // Sync URL Hash for Browser Back/Forward & Refresh state
  const syncStateFromHash = useCallback(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');

    if (!hash || hash === 'overview') {
      setCurrentTab('COMMAND_CENTER');
      setSelectedWorkId(null);
    } else if (hash.startsWith('work/')) {
      const wId = hash.replace('work/', '');
      setSelectedWorkId(wId);
    } else if (hash === 'works' || hash === 'work-list') {
      setCurrentTab('WORK_LIST');
      setSelectedWorkId(null);
    } else if (hash === 'cost-anomalies') {
      setCurrentTab('COST_ANOMALIES');
      setSelectedWorkId(null);
    } else if (hash === 'delay-stagnation') {
      setCurrentTab('DELAY_STAGNATION');
      setSelectedWorkId(null);
    } else if (hash === 'duplicates') {
      setCurrentTab('DUPLICATES');
      setSelectedWorkId(null);
    } else if (hash === 'map') {
      setCurrentTab('MAP');
      setSelectedWorkId(null);
    } else if (hash === 'reports') {
      setCurrentTab('REPORTS');
      setSelectedWorkId(null);
    } else if (hash === 'field-verification') {
      setCurrentTab('FIELD_VERIFICATION');
      setSelectedWorkId(null);
    } else if (hash === 'citizen') {
      setCurrentRole('CITIZEN');
      setSelectedWorkId(null);
    }
  }, []);

  useEffect(() => {
    syncStateFromHash();

    window.addEventListener('hashchange', syncStateFromHash);

    return () =>
      window.removeEventListener('hashchange', syncStateFromHash);
  }, [syncStateFromHash]);

  // Update hash when navigating
  const navigateTab = (tab) => {
    setCurrentTab(tab);
    setSelectedWorkId(null);
    setInitialRiskFilter('');

    const tabToHash = {
      COMMAND_CENTER: 'overview',
      FIELD_VERIFICATION: 'field-verification',
      WORK_LIST: 'works',
      COST_ANOMALIES: 'cost-anomalies',
      DELAY_STAGNATION: 'delay-stagnation',
      DUPLICATES: 'duplicates',
      MAP: 'map',
      REPORTS: 'reports'
    };

    window.location.hash = `#/${tabToHash[tab] || 'overview'}`;
  };

  const handleSelectWork = (workId) => {
    setSelectedWorkId(workId);
    window.location.hash = `#/work/${workId}`;
  };

  const handleBackToWorks = () => {
    setSelectedWorkId(null);
    window.location.hash = '#/works';
  };

  const handleOpenDuplicateDiff = (workIdA, workIdB) => {
    setSelectedWorkId(null);
    navigateTab('DUPLICATES');
  };

  const loadData = async (retryCount = 0) => {
    if (retryCount === 0) {
      setLoading(true);
      setError(null);
    }

    try {
      const [sumData, worksData, dupData] = await Promise.all([
        fetchSummary(),
        fetchWorks({ limit: 50 }),
        fetchDuplicateCandidates()
      ]);

      setSummary(sumData);
      setWorks(worksData.items || []);
      setDuplicatePairs(
        dupData.duplicate_pairs || dupData.pairs || []
      );
      setError(null);
      setLoading(false);
    } catch (err) {
      console.warn(
        `API Fetch attempt ${retryCount + 1} failed:`,
        err.message
      );

      // Auto-retry up to 3 times
      if (retryCount < 3) {
        setTimeout(() => {
          loadData(retryCount + 1);
        }, 1200 * (retryCount + 1));

        return;
      }

      console.error('API Fetch Error:', err);

      setError(
        'Unable to connect to the MPLADS Risk Intelligence engine. Ensure the backend server is running on port 8001.'
      );

      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleDataSynced = () => {
      loadData();
    };

    window.addEventListener(
      'mplads:data_synced',
      handleDataSynced
    );

    return () =>
      window.removeEventListener(
        'mplads:data_synced',
        handleDataSynced
      );
  }, []);

  const handleKPISelect = (kpiId) => {
    if (kpiId === 'TOTAL') {
      setInitialRiskFilter('');
      navigateTab('WORK_LIST');
    } else if (kpiId === 'HIGH') {
      setInitialRiskFilter('HIGH');
      navigateTab('WORK_LIST');
      addToast(
        'Filtered works registry by High Risk (Score 60–79).',
        'info'
      );
    } else if (kpiId === 'CRITICAL') {
      setInitialRiskFilter('CRITICAL');
      navigateTab('WORK_LIST');
      addToast(
        'Filtered works registry by Critical Risk (Score 80+).',
        'info'
      );
    } else if (kpiId === 'MEDIUM') {
      setInitialRiskFilter('MEDIUM');
      navigateTab('WORK_LIST');
      addToast(
        'Filtered works registry by Medium Risk (Score 30–59).',
        'info'
      );
    } else if (kpiId === 'LOW') {
      setInitialRiskFilter('LOW');
      navigateTab('WORK_LIST');
      addToast(
        'Filtered works registry by Low Risk (Score < 30).',
        'info'
      );
    } else if (kpiId === 'STAGNATION') {
      navigateTab('DELAY_STAGNATION');
    } else if (kpiId === 'DUPLICATE') {
      navigateTab('DUPLICATES');
    }
  };

  // Dynamic jurisdiction scoping
  const scopedWorks = useMemo(() => {
    if (!works || works.length === 0) return [];

    if (currentRole === 'DISTRICT' || currentRole === 'MP') {
      return works.filter(
        (w) =>
          (w.district || '').toLowerCase() === 'jaipur'
      );
    }

    if (currentRole === 'STATE') {
      return works.filter(
        (w) =>
          (w.state || '').toLowerCase() === 'rajasthan'
      );
    }

    return works;
  }, [works, currentRole]);

  const scopedDuplicatePairs = useMemo(() => {
    if (!duplicatePairs || duplicatePairs.length === 0) {
      return [];
    }

    if (
      currentRole === 'DISTRICT' ||
      currentRole === 'MP'
    ) {
      const filtered = duplicatePairs.filter(
        (p) =>
          (p.work_a?.district || '').toLowerCase() ===
            'jaipur' ||
          (p.work_b?.district || '').toLowerCase() ===
            'jaipur'
      );

      return filtered.length > 0 ? filtered : duplicatePairs;
    }

    if (currentRole === 'STATE') {
      const filtered = duplicatePairs.filter(
        (p) =>
          (p.work_a?.state || '').toLowerCase() ===
            'rajasthan' ||
          (p.work_b?.state || '').toLowerCase() ===
            'rajasthan'
      );

      return filtered.length > 0 ? filtered : duplicatePairs;
    }

    return duplicatePairs;
  }, [duplicatePairs, currentRole]);

  const scopedSummary = useMemo(() => {
    if (currentRole === 'MINISTRY') {
      return summary;
    }

    if (!scopedWorks || scopedWorks.length === 0) {
      return summary;
    }

    const total_works = scopedWorks.length;

    const critical_count = scopedWorks.filter(
      (w) => w.risk_level === 'CRITICAL'
    ).length;

    const high_count = scopedWorks.filter(
      (w) => w.risk_level === 'HIGH'
    ).length;

    const medium_count = scopedWorks.filter(
      (w) => w.risk_level === 'MEDIUM'
    ).length;

    const low_count = scopedWorks.filter(
      (w) => w.risk_level === 'LOW'
    ).length;

    const total_sanctioned_amount =
      scopedWorks.reduce(
        (acc, w) => acc + (w.sanctioned_amount || 0),
        0
      );

    const flagged_amount =
      scopedWorks.reduce(
        (acc, w) =>
          w.risk_level === 'CRITICAL' ||
          w.risk_level === 'HIGH'
            ? acc + (w.sanctioned_amount || 0)
            : acc,
        0
      );

    const cost_anomalies_count =
      scopedWorks.filter(
        (w) => (w.financial_risk || 0) >= 15
      ).length;

    const stagnation_count =
      scopedWorks.filter(
        (w) => (w.delay_risk || 0) >= 14
      ).length;

    const duplicate_candidates_count =
      scopedDuplicatePairs.length;

    const missing_docs_count =
      scopedWorks.filter(
        (w) => (w.compliance_risk || 0) >= 5
      ).length;

    return {
      total_works,
      critical_count,
      high_count,
      medium_count,
      low_count,
      total_sanctioned_amount,
      flagged_amount,
      cost_anomalies_count,
      stagnation_count,
      duplicate_candidates_count,
      missing_docs_count
    };
  }, [
    currentRole,
    scopedWorks,
    scopedDuplicatePairs,
    summary
  ]);

  return (
    <div className="flex h-screen bg-[#F7F7F1] text-[#050505] overflow-hidden font-sans">

      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={navigateTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <Header
          currentRole={currentRole}
          setCurrentRole={(r) => {
            setCurrentRole(r);

            if (r === 'CITIZEN') {
              window.location.hash = '#/citizen';
            }
          }}
          criticalCount={
            scopedSummary?.critical_count || 0
          }
          works={scopedWorks}
          onSelectWork={handleSelectWork}
          onToggleMobileSidebar={() =>
            setIsMobileSidebarOpen(!isMobileSidebarOpen)
          }
          onRefreshData={loadData}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 sm:py-8">
          <div className="max-w-7xl mx-auto space-y-7">

            {/* Backend Connection Warning */}
            {error && (
              <div className="gov-card p-4 border-[#FADCDA] bg-[#FDF4F4] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-[#C94C4C] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>

                <button
                  onClick={loadData}
                  className="btn-secondary py-1.5 px-3 text-xs text-[#C94C4C] border-[#FADCDA] hover:bg-white self-start sm:self-auto rounded-xl"
                >
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                  Retry Connection
                </button>
              </div>
            )}

            {/* Loading */}
            {loading ? (
              <div className="space-y-5">
                <CardSkeleton />
                <TableSkeleton rows={8} />
              </div>
            ) : currentRole === 'CITIZEN' ? (
              <CitizenView works={works} />
            ) : selectedWorkId ? (
              <WorkDetailView
                workId={selectedWorkId}
                initialWork={works.find(
                  (w) => w.work_id === selectedWorkId
                )}
                onBack={handleBackToWorks}
                onOpenDuplicateDiff={
                  handleOpenDuplicateDiff
                }
                onViewOnMap={(_wId) => {
                  navigateTab('MAP');
                }}
                onOpenFieldVerification={(wId) => {
                  setVerificationInitialWorkId(wId);
                  navigateTab('FIELD_VERIFICATION');
                }}
              />
            ) : (
              <>
                {/* Role Context */}
                <RoleContextBanner
                  currentRole={currentRole}
                  scopedCount={
                    currentRole === 'MINISTRY'
                      ? summary?.total_works || works.length
                      : scopedWorks.length
                  }
                  totalCount={
                    summary?.total_works || works.length
                  }
                  onOpenSettings={() =>
                    setIsSettingsOpen(true)
                  }
                  onNavigateTab={navigateTab}
                />

                {/* Command Center */}
                {currentTab === 'COMMAND_CENTER' && (
                  <div className="space-y-7">

                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#050505] tracking-tight">
                        Risk Command Center
                      </h1>

                      <p className="text-xs sm:text-sm text-[#5E5E5D] mt-1">
                        Early warning risk intelligence, empirical
                        cost anomaly auditing, and physical progress
                        monitoring across constituencies.
                      </p>
                    </div>

                    <KPICards
                      summary={scopedSummary}
                      onSelectFilter={handleKPISelect}
                    />

                    <PriorityTable
                      works={scopedWorks}
                      onSelectWork={handleSelectWork}
                      onViewAll={() =>
                        navigateTab('WORK_LIST')
                      }
                    />

                    <WorksTableView
                      works={works}
                      onSelectWork={handleSelectWork}
                      initialRiskFilter={initialRiskFilter}
                      totalAll={
                        summary?.total_works || 60880
                      }
                      summary={scopedSummary || summary}
                    />
                  </div>
                )}

                {/* Works Registry */}
                {currentTab === 'WORK_LIST' && (
                  <WorksTableView
                    works={works}
                    onSelectWork={handleSelectWork}
                    initialRiskFilter={initialRiskFilter}
                    totalAll={
                      summary?.total_works || 60880
                    }
                    summary={scopedSummary || summary}
                  />
                )}

                {/* Cost Anomalies */}
                {currentTab === 'COST_ANOMALIES' && (
                  <CostAnomaliesView
                    works={scopedWorks}
                    onSelectWork={handleSelectWork}
                  />
                )}

                {/* Delay & Stagnation */}
                {currentTab === 'DELAY_STAGNATION' && (
                  <DelayStagnationView
                    works={scopedWorks}
                    onSelectWork={handleSelectWork}
                  />
                )}

                {/* Duplicates */}
                {currentTab === 'DUPLICATES' && (
                  <DuplicatesView
                    pairs={scopedDuplicatePairs}
                    onSelectWork={handleSelectWork}
                  />
                )}

                {/* Risk Map */}
                {currentTab === 'MAP' && (
                  <RiskMapView
                    works={scopedWorks}
                    onSelectWork={handleSelectWork}
                  />
                )}

                {/* Reports */}
                {currentTab === 'REPORTS' && (
                  <ReportsView
                    works={scopedWorks}
                    onSelectWork={handleSelectWork}
                  />
                )}

                {/* Field Verification */}
                {currentTab === 'FIELD_VERIFICATION' && (
                  <FieldVerificationView
                    initialWorkId={
                      verificationInitialWorkId
                    }
                    availableWorks={scopedWorks}
                    onSelectWork={handleSelectWork}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Settings */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onWeightsApplied={loadData}
      />

      {/* Vercel Analytics */}
      <Analytics />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}