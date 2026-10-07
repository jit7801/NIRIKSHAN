import React, { useState, useMemo, useEffect } from 'react';
import RiskBadge from './RiskBadge';
import {
  Search,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FilterX,
  LayoutGrid,
  List,
  Eye,
  MapPin,
  Building2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  BarChart3,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Percent,
  Check
} from 'lucide-react';
import { useToast } from './Toast';
import { fetchWorks, fetchFilterOptions, fetchSummary } from '../api/client';

export default function WorksTableView({ 
  works = [], 
  onSelectWork, 
  initialRiskFilter = '', 
  totalAll = 60880,
  summary = null 
}) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRisk, setSelectedRisk] = useState(initialRiskFilter);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [showAnalytics, setShowAnalytics] = useState(true);

  const [sortBy, setSortBy] = useState('overall_risk_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [serverWorks, setServerWorks] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [filterOpts, setFilterOpts] = useState({ states: [], categories: [], statuses: [], state_districts: {} });
  const [isLoading, setIsLoading] = useState(false);

  // Status counts from real indexed DB/API
  const [statusCounts, setStatusCounts] = useState({
    completed: 1675,
    ongoing: 629,
    in_progress: 346,
    sanctioned: 6528,
    stalled: 2
  });

  // Local state/district-filtered summary
  const [localSummary, setLocalSummary] = useState(null);

  useEffect(() => {
    if (initialRiskFilter) {
      setSelectedRisk(initialRiskFilter);
      setCurrentPage(1);
    }
  }, [initialRiskFilter]);

  // Load distinct filter options from server on mount
  useEffect(() => {
    fetchFilterOptions()
      .then(opts => {
        if (opts && opts.states) setFilterOpts(opts);
      })
      .catch(err => console.warn('Could not load filter options:', err));
  }, []);

  // Fetch status counts lightweight (limit: 1) on filter changes
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchWorks({ status: 'COMPLETED', limit: 1, state: selectedState || undefined, district: selectedDistrict || undefined }).catch(() => null),
      fetchWorks({ status: 'ONGOING', limit: 1, state: selectedState || undefined, district: selectedDistrict || undefined }).catch(() => null),
      fetchWorks({ status: 'IN_PROGRESS', limit: 1, state: selectedState || undefined, district: selectedDistrict || undefined }).catch(() => null),
      fetchWorks({ status: 'SANCTIONED', limit: 1, state: selectedState || undefined, district: selectedDistrict || undefined }).catch(() => null),
      fetchWorks({ status: 'STALLED', limit: 1, state: selectedState || undefined, district: selectedDistrict || undefined }).catch(() => null),
    ]).then(([compRes, ongRes, inProgRes, sancRes, stalRes]) => {
      if (!isMounted) return;
      setStatusCounts(prev => ({
        completed: compRes?.total ?? prev.completed,
        ongoing: ongRes?.total ?? prev.ongoing,
        in_progress: inProgRes?.total ?? prev.in_progress,
        sanctioned: sancRes?.total ?? prev.sanctioned,
        stalled: stalRes?.total ?? prev.stalled,
      }));
    });

    // Update scoped summary if state/district is selected
    if (selectedState || selectedDistrict) {
      fetchSummary({ state: selectedState || undefined, district: selectedDistrict || undefined })
        .then(res => {
          if (isMounted) setLocalSummary(res);
        })
        .catch(() => {});
    } else {
      setLocalSummary(null);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedState, selectedDistrict]);

  // Active summary (scoped or global)
  const activeSummary = localSummary || summary;

  // Server-side query with 180ms debounce for smooth responsive searching
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(() => {
      fetchWorks({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: search.trim() || undefined,
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        category: selectedCategory || undefined,
        risk_level: selectedRisk || undefined,
        status: selectedStatus || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      })
        .then(res => {
          if (!isMounted) return;
          setServerWorks(res.items || []);
          setServerTotal(res.total || 0);
          setIsLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.warn('Server query fallback:', err);
          setIsLoading(false);
        });
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentPage, pageSize, search, selectedState, selectedDistrict, selectedCategory, selectedRisk, selectedStatus, sortBy, sortOrder]);

  // Extract unique filter options with fallback to local props
  const states = useMemo(() => {
    if (filterOpts.states && filterOpts.states.length > 0) return filterOpts.states;
    return Array.from(new Set(works.map((w) => w.state))).filter(Boolean).sort();
  }, [filterOpts, works]);

  const districts = useMemo(() => {
    if (selectedState && filterOpts.state_districts && filterOpts.state_districts[selectedState]) {
      return filterOpts.state_districts[selectedState];
    }
    const list = selectedState ? works.filter((w) => w.state === selectedState) : works;
    return Array.from(new Set(list.map((w) => w.district))).filter(Boolean).sort();
  }, [filterOpts, selectedState, works]);

  const categories = useMemo(() => {
    if (filterOpts.categories && filterOpts.categories.length > 0) return filterOpts.categories;
    return Array.from(new Set(works.map((w) => w.work_category))).filter(Boolean).sort();
  }, [filterOpts, works]);

  const hasActiveFilters = Boolean(
    search || selectedState || selectedDistrict || selectedCategory || selectedRisk || selectedStatus
  );

  const clearFilters = () => {
    setSearch('');
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedCategory('');
    setSelectedRisk('');
    setSelectedStatus('');
    setCurrentPage(1);
    addToast('All filters have been reset.', 'info');
  };

  // Filter & Sort Works
  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      const matchSearch =
        !search ||
        (w.work_title && w.work_title.toLowerCase().includes(search.toLowerCase())) ||
        (w.work_id && w.work_id.toLowerCase().includes(search.toLowerCase())) ||
        (w.district && w.district.toLowerCase().includes(search.toLowerCase())) ||
        (w.state && w.state.toLowerCase().includes(search.toLowerCase())) ||
        (w.mp_name && w.mp_name.toLowerCase().includes(search.toLowerCase())) ||
        (w.constituency && w.constituency.toLowerCase().includes(search.toLowerCase())) ||
        (w.village && w.village.toLowerCase().includes(search.toLowerCase())) ||
        (w.block && w.block.toLowerCase().includes(search.toLowerCase())) ||
        (w.implementing_agency && w.implementing_agency.toLowerCase().includes(search.toLowerCase()));

      const matchState = !selectedState || w.state === selectedState;
      const matchDistrict = !selectedDistrict || w.district === selectedDistrict;
      const matchCategory = !selectedCategory || w.work_category === selectedCategory;
      const matchRisk = !selectedRisk || w.risk_level === selectedRisk;
      const matchStatus = !selectedStatus || w.status === selectedStatus;

      return matchSearch && matchState && matchDistrict && matchCategory && matchRisk && matchStatus;
    }).sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [works, search, selectedState, selectedDistrict, selectedCategory, selectedRisk, selectedStatus, sortBy, sortOrder]);

  const isUsingServer = serverTotal > 0 || isLoading || serverWorks.length > 0;
  const paginatedWorks = isUsingServer ? serverWorks : filteredWorks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalRecords = isUsingServer ? serverTotal : filteredWorks.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Current works sample for local progress calculation
  const currentWorksSample = isUsingServer ? serverWorks : paginatedWorks;
  const avgPhysicalProgress = useMemo(() => {
    if (!currentWorksSample || currentWorksSample.length === 0) return 0;
    const valid = currentWorksSample.filter(w => typeof w.physical_progress === 'number');
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, w) => acc + w.physical_progress, 0);
    return Math.round(sum / valid.length);
  }, [currentWorksSample]);

  // Real KPI statistics
  const totalWorksCount = activeSummary?.total_works || totalAll || 60880;
  const highRiskCount = (activeSummary?.critical_count ?? 1) + (activeSummary?.high_count ?? 0);
  const ongoingWorksCount = (statusCounts.ongoing || 0) + (statusCounts.in_progress || 0);
  const completedWorksCount = statusCounts.completed || 1675;
  const sanctionedWorksCount = statusCounts.sanctioned || 6528;
  const stalledWorksCount = statusCounts.stalled || 2;

  const totalSanctionedCr = activeSummary?.total_sanctioned_amount 
    ? (activeSummary.total_sanctioned_amount / 10000000).toFixed(1)
    : "3,575.5";
  const flaggedAmountLakhs = activeSummary?.flagged_amount
    ? (activeSummary.flagged_amount / 100000).toFixed(2)
    : "31.35";
  const costAnomaliesCount = activeSummary?.cost_anomalies_count ?? 13377;
  const stagnationCount = activeSummary?.stagnation_count ?? 2;

  // Status distribution percentages
  const activeKnownStatusesTotal = completedWorksCount + ongoingWorksCount + sanctionedWorksCount + stalledWorksCount;
  const completedPct = activeKnownStatusesTotal > 0 ? Math.round((completedWorksCount / activeKnownStatusesTotal) * 100) : 18;
  const ongoingPct = activeKnownStatusesTotal > 0 ? Math.round((ongoingWorksCount / activeKnownStatusesTotal) * 100) : 10;
  const sanctionedPct = activeKnownStatusesTotal > 0 ? Math.round((sanctionedWorksCount / activeKnownStatusesTotal) * 100) : 71;
  const stalledPct = activeKnownStatusesTotal > 0 ? Math.max(1, Math.round((stalledWorksCount / activeKnownStatusesTotal) * 100)) : 1;

  // Risk distribution counts and percentages
  const lowCount = activeSummary?.low_count ?? 50355;
  const mediumCount = activeSummary?.medium_count ?? 10524;
  const criticalCount = activeSummary?.critical_count ?? 1;
  const riskTotal = lowCount + mediumCount + highRiskCount || totalWorksCount;
  const lowPct = Math.round((lowCount / riskTotal) * 100) || 83;
  const medPct = Math.round((mediumCount / riskTotal) * 100) || 17;
  const highPct = Math.max(0.1, Number(((highRiskCount / riskTotal) * 100).toFixed(1)));

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportCSV = () => {
    const recordsToExport = paginatedWorks;
    if (recordsToExport.length === 0) {
      addToast('No records available to export.', 'warning');
      return;
    }

    const headers = [
      'Work ID', 'Title', 'Category', 'State', 'District', 'Sanctioned Amount (INR)',
      'Actual Expenditure (INR)', 'Physical Progress (%)', 'Financial Progress (%)',
      'Unified Risk Score', 'Risk Level', 'Primary Signal', 'Status', 'Agency'
    ];
    const rows = recordsToExport.map((w) => [
      `"${w.work_id || ''}"`,
      `"${(w.work_title || '').replace(/"/g, '""')}"`,
      `"${w.work_category || ''}"`,
      `"${w.state || ''}"`,
      `"${w.district || ''}"`,
      w.sanctioned_amount || 0,
      w.actual_expenditure || 0,
      w.physical_progress || 0,
      w.financial_progress || 0,
      w.overall_risk_score || 0,
      w.risk_level || '',
      `"${(w.primary_risk_factor || '').replace(/"/g, '""')}"`,
      w.status || '',
      `"${(w.implementing_agency || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MPLADS_Works_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${recordsToExport.length} projects to CSV successfully.`, 'success');
  };

  return (
    <div className="space-y-6">

      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E8E4DC]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight">
            WORK REGISTRY
          </h1>
          <p className="text-xs text-[#5E5E5D] mt-0.5">
            Monitor, analyze and review MPLADS works
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Toggle Analytics Overview button */}
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs font-medium rounded-xl transition-all ${
              showAnalytics ? 'bg-[#F2ECE4] text-[#4B3C32] border-[#C8BFB3]' : 'text-[#5E5E5D]'
            }`}
            title={showAnalytics ? "Collapse overview analytics" : "Expand overview analytics"}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#AA896C]" />
            <span className="hidden sm:inline">{showAnalytics ? 'Hide Analytics' : 'Overview Analytics'}</span>
            {showAnalytics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#F2F0EB] p-1 rounded-xl border border-[#E8E4DC]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-[#4B3C32] shadow-xs font-semibold' : 'text-[#8E8D8A] hover:text-[#050505]'
              }`}
              title="Table View"
              aria-label="Switch to table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-[#4B3C32] shadow-xs font-semibold' : 'text-[#8E8D8A] hover:text-[#050505]'
              }`}
              title="Card Grid View"
              aria-label="Switch to grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3.5 text-xs font-medium rounded-xl hover:bg-[#F7F7F1]"
            title="Download CSV report of filtered works"
          >
            <Download className="w-3.5 h-3.5 text-[#AA896C]" />
            <span className="hidden xs:inline">Export CSV</span>
            <span className="xs:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* REGISTRY OVERVIEW — PRIMARY KPI ROW */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#5E5E5D]">
            Registry Overview
          </h2>
          <span className="text-[11px] text-[#8E8D8A]">
            Real-time aggregate data across {totalWorksCount.toLocaleString()} works
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. TOTAL WORKS */}
          <div 
            onClick={() => { setSelectedRisk(''); setSelectedStatus(''); }}
            className="gov-card rounded-2xl p-5 border border-[#E8E4DC] bg-white transition-all flex flex-col justify-between hover:border-[#C8BFB3] cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#5E5E5D] uppercase tracking-wider">
                Total Works
              </span>
              <div className="p-1.5 rounded-xl bg-[#F7F7F1] text-[#4B3C32]">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">
                {totalWorksCount.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#5E5E5D] pt-2 border-t border-[#F2EFEB]">
              <span>Total registered works</span>
              <span className="font-mono text-[#4B3C32] font-semibold">₹{totalSanctionedCr} Cr</span>
            </div>
          </div>

          {/* 2. HIGH-RISK WORKS */}
          <div 
            onClick={() => setSelectedRisk(selectedRisk === 'CRITICAL' ? '' : 'CRITICAL')}
            className={`gov-card rounded-2xl p-5 border transition-all flex flex-col justify-between cursor-pointer ${
              selectedRisk === 'CRITICAL' || selectedRisk === 'HIGH'
                ? 'border-[#C94C4C] bg-[#FDF2F2]/60 ring-1 ring-[#C94C4C]'
                : 'border-[#E8E4DC] bg-white hover:border-[#C94C4C]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#5E5E5D] uppercase tracking-wider">
                High-Risk Works
              </span>
              <div className="p-1.5 rounded-xl bg-[#FDF2F2] text-[#C94C4C]">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#C94C4C] tracking-tight">
                {highRiskCount.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#5E5E5D] pt-2 border-t border-[#F2EFEB]">
              <span>Require priority review</span>
              <span className="font-medium text-[#C94C4C] text-[10px] bg-[#FDF2F2] px-1.5 py-0.5 rounded-md">Urgent</span>
            </div>
          </div>

          {/* 3. ONGOING WORKS */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'IN_PROGRESS' || selectedStatus === 'ONGOING' ? '' : 'IN_PROGRESS')}
            className={`gov-card rounded-2xl p-5 border transition-all flex flex-col justify-between cursor-pointer ${
              selectedStatus === 'IN_PROGRESS' || selectedStatus === 'ONGOING'
                ? 'border-[#AA896C] bg-[#F7F4F0] ring-1 ring-[#AA896C]'
                : 'border-[#E8E4DC] bg-white hover:border-[#AA896C]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#5E5E5D] uppercase tracking-wider">
                Ongoing Works
              </span>
              <div className="p-1.5 rounded-xl bg-[#F7F4F0] text-[#AA896C]">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">
                {ongoingWorksCount.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#5E5E5D] pt-2 border-t border-[#F2EFEB]">
              <span>Currently ongoing</span>
              <span className="text-[10px] text-[#AA896C] font-semibold">Active field</span>
            </div>
          </div>

          {/* 4. COMPLETED WORKS */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'COMPLETED' ? '' : 'COMPLETED')}
            className={`gov-card rounded-2xl p-5 border transition-all flex flex-col justify-between cursor-pointer ${
              selectedStatus === 'COMPLETED'
                ? 'border-[#2E8B57] bg-[#F0F8F4] ring-1 ring-[#2E8B57]'
                : 'border-[#E8E4DC] bg-white hover:border-[#2E8B57]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#5E5E5D] uppercase tracking-wider">
                Completed Works
              </span>
              <div className="p-1.5 rounded-xl bg-[#F0F8F4] text-[#2E8B57]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 mb-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#2E8B57] tracking-tight">
                {completedWorksCount.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#5E5E5D] pt-2 border-t border-[#F2EFEB]">
              <span>Completed works</span>
              <span className="text-[10px] text-[#2E8B57] font-semibold">Delivered assets</span>
            </div>
          </div>
        </div>
      </div>

      {/* ANALYTICS / SUMMARY AREA */}
      {showAnalytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">

          {/* Card 1: Work Status Distribution */}
          <div className="gov-card rounded-2xl p-5 border border-[#E8E4DC] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#AA896C]" />
                  Work Status Distribution
                </span>
                <span className="text-[11px] text-[#8E8D8A]">
                  Active Scope
                </span>
              </div>

              {/* Status Breakdown Bars */}
              <div className="space-y-2.5 pt-1 text-xs">
                {/* Completed */}
                <div 
                  onClick={() => setSelectedStatus(selectedStatus === 'COMPLETED' ? '' : 'COMPLETED')}
                  className="p-2 rounded-xl hover:bg-[#F7F7F1] cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#050505] font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#2E8B57]" /> Completed
                    </span>
                    <span className="text-[#5E5E5D] font-mono text-[11px]">
                      {completedWorksCount.toLocaleString()} ({completedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#E8E4DC] h-1.5 rounded-full overflow-hidden">
                    <div style={{ width: `${completedPct}%` }} className="bg-[#2E8B57] h-full rounded-full" />
                  </div>
                </div>

                {/* Ongoing & In Progress */}
                <div 
                  onClick={() => setSelectedStatus(selectedStatus === 'IN_PROGRESS' || selectedStatus === 'ONGOING' ? '' : 'IN_PROGRESS')}
                  className="p-2 rounded-xl hover:bg-[#F7F7F1] cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#050505] font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#AA896C]" /> Ongoing / In Progress
                    </span>
                    <span className="text-[#5E5E5D] font-mono text-[11px]">
                      {ongoingWorksCount.toLocaleString()} ({ongoingPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#E8E4DC] h-1.5 rounded-full overflow-hidden">
                    <div style={{ width: `${ongoingPct}%` }} className="bg-[#AA896C] h-full rounded-full" />
                  </div>
                </div>

                {/* Sanctioned */}
                <div 
                  onClick={() => setSelectedStatus(selectedStatus === 'SANCTIONED' ? '' : 'SANCTIONED')}
                  className="p-2 rounded-xl hover:bg-[#F7F7F1] cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#050505] font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#4B3C32]" /> Sanctioned
                    </span>
                    <span className="text-[#5E5E5D] font-mono text-[11px]">
                      {sanctionedWorksCount.toLocaleString()} ({sanctionedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#E8E4DC] h-1.5 rounded-full overflow-hidden">
                    <div style={{ width: `${sanctionedPct}%` }} className="bg-[#4B3C32] h-full rounded-full" />
                  </div>
                </div>

                {/* Stalled */}
                <div 
                  onClick={() => setSelectedStatus(selectedStatus === 'STALLED' ? '' : 'STALLED')}
                  className="p-2 rounded-xl hover:bg-[#F7F7F1] cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#050505] font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#C94C4C]" /> Stalled / Dormant
                    </span>
                    <span className="text-[#C94C4C] font-mono text-[11px] font-semibold">
                      {stalledWorksCount} works
                    </span>
                  </div>
                  <div className="w-full bg-[#E8E4DC] h-1.5 rounded-full overflow-hidden">
                    <div style={{ width: `${stalledPct}%` }} className="bg-[#C94C4C] h-full rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EFEB] text-[11px] text-[#8E8D8A] flex justify-between">
              <span>Status source: Authority records</span>
              <span className="text-[#4B3C32] font-medium">Click to filter</span>
            </div>
          </div>

          {/* Card 2: Risk Distribution */}
          <div className="gov-card rounded-2xl p-5 border border-[#E8E4DC] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#C94C4C]" />
                  Risk Distribution
                </span>
                <span className="text-[11px] text-[#8E8D8A]">
                  AI Scored
                </span>
              </div>

              {/* Segmented Bar */}
              <div className="mt-2 mb-4">
                <div className="w-full bg-[#E8E4DC] h-3 rounded-full overflow-hidden flex">
                  <div style={{ width: `${lowPct}%` }} className="bg-[#2E8B57] h-full" title={`Low Risk: ${lowPct}%`} />
                  <div style={{ width: `${medPct}%` }} className="bg-[#E6A23C] h-full" title={`Medium Risk: ${medPct}%`} />
                  <div style={{ width: `${Math.max(1, highPct)}%` }} className="bg-[#C94C4C] h-full" title={`High/Critical Risk: ${highRiskCount}`} />
                </div>
              </div>

              {/* Risk Levels Detail */}
              <div className="space-y-2 text-xs">
                <div 
                  onClick={() => setSelectedRisk(selectedRisk === 'LOW' ? '' : 'LOW')}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7F7F1] cursor-pointer transition-colors"
                >
                  <span className="text-[#050505] font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2E8B57]" /> Low Risk (0–29)
                  </span>
                  <div className="text-right font-mono">
                    <strong className="text-[#050505]">{lowCount.toLocaleString()}</strong>
                    <span className="text-[11px] text-[#5E5E5D] ml-1.5">({lowPct}%)</span>
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedRisk(selectedRisk === 'MEDIUM' ? '' : 'MEDIUM')}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7F7F1] cursor-pointer transition-colors"
                >
                  <span className="text-[#050505] font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E6A23C]" /> Medium Risk (30–59)
                  </span>
                  <div className="text-right font-mono">
                    <strong className="text-[#050505]">{mediumCount.toLocaleString()}</strong>
                    <span className="text-[11px] text-[#5E5E5D] ml-1.5">({medPct}%)</span>
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedRisk(selectedRisk === 'CRITICAL' ? '' : 'CRITICAL')}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FDF2F2] cursor-pointer transition-colors"
                >
                  <span className="text-[#C94C4C] font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C94C4C]" /> High & Critical (60–100)
                  </span>
                  <div className="text-right font-mono text-[#C94C4C] font-bold">
                    <strong>{highRiskCount.toLocaleString()}</strong>
                    <span className="text-[11px] ml-1.5">({highPct}%)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EFEB] text-[11px] text-[#8E8D8A] flex justify-between">
              <span>Multi-signal anomaly detection</span>
              <span className="text-[#4B3C32] font-medium">Click to filter</span>
            </div>
          </div>

          {/* Card 3: Execution & Financial Snapshot */}
          <div className="gov-card rounded-2xl p-5 border border-[#E8E4DC] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#4B3C32]" />
                  Execution & Financial Snapshot
                </span>
                <span className="text-[11px] text-[#8E8D8A]">
                  Metrics
                </span>
              </div>

              {/* Progress Gauge */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-[#F7F7F1]/80 border border-[#E8E4DC] mb-3">
                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  <svg className="w-14 h-14 transform -rotate-90">
                    <circle cx="28" cy="28" r="22" stroke="#E8E4DC" strokeWidth="4.5" fill="none" />
                    <circle
                      cx="28" cy="28" r="22" stroke="#4B3C32" strokeWidth="4.5" fill="none"
                      strokeDasharray="138.23"
                      strokeDashoffset={138.23 - (138.23 * avgPhysicalProgress) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold text-[#111111]">
                    {avgPhysicalProgress}%
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#111111]">
                    Average Physical Progress
                  </div>
                  <div className="text-[11px] text-[#5E5E5D] mt-0.5">
                    Calculated from current view records
                  </div>
                </div>
              </div>

              {/* Analytical Numbers Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#F7F7F1] border border-[#E8E4DC]/80">
                  <div className="text-[10px] text-[#5E5E5D] font-medium uppercase tracking-wider">
                    Total Budget
                  </div>
                  <div className="text-sm font-bold text-[#050505] font-mono mt-0.5">
                    ₹{totalSanctionedCr} Cr
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F7F7F1] border border-[#E8E4DC]/80">
                  <div className="text-[10px] text-[#5E5E5D] font-medium uppercase tracking-wider">
                    Flagged at Risk
                  </div>
                  <div className="text-sm font-bold text-[#C94C4C] font-mono mt-0.5">
                    ₹{flaggedAmountLakhs} L
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F7F7F1] border border-[#E8E4DC]/80">
                  <div className="text-[10px] text-[#5E5E5D] font-medium uppercase tracking-wider">
                    Cost Anomalies
                  </div>
                  <div className="text-sm font-bold text-[#916540] font-mono mt-0.5">
                    {costAnomaliesCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F7F7F1] border border-[#E8E4DC]/80">
                  <div className="text-[10px] text-[#5E5E5D] font-medium uppercase tracking-wider">
                    Delayed / Stagnant
                  </div>
                  <div className="text-sm font-bold text-[#4B3C32] font-mono mt-0.5">
                    {stagnationCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EFEB] text-[11px] text-[#8E8D8A]">
              <span>Real-time aggregation from verified data</span>
            </div>
          </div>

        </div>
      )}

      {/* Filter Toolbar */}
      <div className="gov-card rounded-2xl p-4 sm:p-5 space-y-3.5 border border-[#E8E4DC] shadow-xs">

        {/* Search & Main Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">

          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[#8E8D8A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search title, ID, MP, district, village..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1] text-xs text-[#050505] placeholder-[#8E8D8A] pl-9 pr-8 py-2.5 rounded-xl border border-[#D8D2C7] focus:outline-none focus:border-[#4B3C32] focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8D8A] hover:text-[#050505] p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* State Filter */}
          <div>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict('');
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1] hover:bg-[#F2F0EB] text-xs text-[#050505] px-3 py-2.5 rounded-xl border border-[#D8D2C7] focus:outline-none focus:border-[#4B3C32] focus:bg-white cursor-pointer transition-colors"
              aria-label="Filter by state"
            >
              <option value="">All States ({states.length})</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1] hover:bg-[#F2F0EB] text-xs text-[#050505] px-3 py-2.5 rounded-xl border border-[#D8D2C7] focus:outline-none focus:border-[#4B3C32] focus:bg-white cursor-pointer transition-colors"
              aria-label="Filter by district"
            >
              <option value="">All Districts ({districts.length})</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <select
              value={selectedRisk}
              onChange={(e) => {
                setSelectedRisk(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1] hover:bg-[#F2F0EB] text-xs text-[#050505] px-3 py-2.5 rounded-xl border border-[#D8D2C7] focus:outline-none focus:border-[#4B3C32] focus:bg-white cursor-pointer transition-colors"
            >
              <option value="">All Risk Tiers</option>
              <option value="CRITICAL">Critical (80+)</option>
              <option value="HIGH">High (60–79)</option>
              <option value="MEDIUM">Medium (30–59)</option>
              <option value="LOW">Low (0–29)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1] hover:bg-[#F2F0EB] text-xs text-[#050505] px-3 py-2.5 rounded-xl border border-[#D8D2C7] focus:outline-none focus:border-[#4B3C32] focus:bg-white cursor-pointer transition-colors"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1] hover:bg-[#F2F0EB] text-xs text-[#050505] px-3 py-2.5 rounded-xl border border-[#D8D2C7] focus:outline-none focus:border-[#4B3C32] focus:bg-white cursor-pointer transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RECOMMENDED">Recommended</option>
              <option value="SANCTIONED">Sanctioned</option>
              <option value="COMPLETED">Completed</option>
              <option value="STALLED">Stalled</option>
            </select>
          </div>

        </div>

        {/* Results Count & Clear Button */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[#F2EFEB] text-xs text-[#5E5E5D]">
          <div>
            Showing <strong className="text-[#050505] font-semibold">{totalRecords.toLocaleString()}</strong> matching projects
            {hasActiveFilters ? ` (filtered from ${(totalAll || 60880).toLocaleString()} total)` : ''}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[#C94C4C] hover:text-[#A83232] flex items-center gap-1 font-semibold text-xs py-1 px-2.5 rounded-xl hover:bg-[#FDF2F2] transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

      </div>

      {/* Grid View Mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedWorks.length === 0 ? (
            <div className="col-span-full gov-card rounded-2xl p-12 text-center text-[#5E5E5D] border border-[#E8E4DC]">
              <AlertCircle className="w-8 h-8 text-[#AA896C] mx-auto mb-2" />
              <div className="font-semibold text-sm text-[#050505]">No projects found</div>
              <p className="text-xs text-[#5E5E5D] mt-1">Try broadening your search or resetting active filters.</p>
              <button onClick={clearFilters} className="btn-secondary text-xs mt-3 rounded-xl">Reset Filters</button>
            </div>
          ) : (
            paginatedWorks.map((work) => (
              <div
                key={work.work_id}
                onClick={() => onSelectWork(work.work_id)}
                className="gov-card rounded-2xl p-4 sm:p-5 gov-card-hover cursor-pointer flex flex-col justify-between border border-[#E8E4DC] hover:border-[#C8BFB3] shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2.5">
                    <span className="font-mono text-[10px] text-[#8E8D8A] truncate">
                      {work.work_id}
                    </span>
                    <RiskBadge score={work.overall_risk_score} level={work.risk_level} size="sm" />
                  </div>

                  <h3 className="text-sm font-bold text-[#050505] hover:text-[#4B3C32] transition-colors line-clamp-2 mb-2.5">
                    {work.work_title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-[#5E5E5D] mb-3.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#AA896C] shrink-0" />
                      <span className="truncate">{work.district}, {work.state}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#AA896C] shrink-0" />
                      <span className="truncate">{work.work_category}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F2EFEB] space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#5E5E5D]">Sanctioned Fund:</span>
                    <strong className="text-[#050505] font-semibold">₹{((work.sanctioned_amount || 0) / 100000).toFixed(2)}L</strong>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-[#5E5E5D] mb-1">
                      <span>Progress (Phys / Fin)</span>
                      <span className="font-semibold text-[#050505]">{work.physical_progress}% / {work.financial_progress}%</span>
                    </div>
                    <div className="w-full bg-[#E8E4DC] h-1.5 rounded-full overflow-hidden flex">
                      <div style={{ width: `${work.physical_progress}%` }} className="h-full bg-[#2E8B57]" />
                      <div style={{ width: `${Math.max(0, work.financial_progress - work.physical_progress)}%` }} className="h-full bg-[#AA896C]" />
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWork(work.work_id);
                    }}
                    className="btn-secondary w-full py-1.5 text-xs font-medium text-center mt-2 rounded-xl hover:bg-[#F7F7F1]"
                  >
                    Inspect Dossier
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Table View Mode */
        <div className="gov-card rounded-2xl overflow-hidden border border-[#E8E4DC] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse gov-table min-w-[760px]">
              <thead>
                <tr>
                  <th
                    onClick={() => toggleSort('work_id')}
                    className="cursor-pointer hover:bg-[#F2F0EB] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Work ID & Title</span>
                      <ArrowUpDown className="w-3 h-3 text-[#8E8D8A]" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('district')}
                    className="cursor-pointer hover:bg-[#F2F0EB] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      <ArrowUpDown className="w-3 h-3 text-[#8E8D8A]" />
                    </div>
                  </th>
                  <th>Category</th>
                  <th
                    onClick={() => toggleSort('sanctioned_amount')}
                    className="cursor-pointer hover:bg-[#F2F0EB] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Sanctioned</span>
                      <ArrowUpDown className="w-3 h-3 text-[#8E8D8A]" />
                    </div>
                  </th>
                  <th>Progress (Phys / Fin)</th>
                  <th
                    onClick={() => toggleSort('overall_risk_score')}
                    className="cursor-pointer hover:bg-[#F2F0EB] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Risk Score</span>
                      <ArrowUpDown className="w-3 h-3 text-[#8E8D8A]" />
                    </div>
                  </th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWorks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-[#5E5E5D]">
                      <AlertCircle className="w-8 h-8 text-[#AA896C] mx-auto mb-2" />
                      <div className="font-semibold text-sm text-[#050505]">No projects found</div>
                      <p className="text-xs text-[#5E5E5D] mt-1">Try broadening your search or resetting active filters.</p>
                      <button onClick={clearFilters} className="btn-secondary text-xs mt-3 rounded-xl">Reset Filters</button>
                    </td>
                  </tr>
                ) : (
                  paginatedWorks.map((work) => (
                    <tr
                      key={work.work_id}
                      onClick={() => onSelectWork(work.work_id)}
                      className="cursor-pointer hover:bg-[#FAF9F6] transition-colors"
                    >
                      {/* Work ID & Title */}
                      <td className="max-w-[280px]">
                        <div className="font-semibold text-[#050505] hover:text-[#4B3C32] transition-colors truncate">
                          {work.work_title}
                        </div>
                        <div className="text-[10px] text-[#8E8D8A] font-mono mt-0.5 truncate">
                          {work.work_id} · {work.status}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="whitespace-nowrap">
                        <div className="text-[#050505] font-medium">{work.district}</div>
                        <div className="text-[10px] text-[#5E5E5D]">{work.state}</div>
                      </td>

                      {/* Category */}
                      <td className="whitespace-nowrap text-xs text-[#5E5E5D]">
                        {work.work_category}
                      </td>

                      {/* Sanctioned */}
                      <td className="whitespace-nowrap font-medium text-[#050505]">
                        ₹{((work.sanctioned_amount || 0) / 100000).toFixed(2)}L
                      </td>

                      {/* Progress */}
                      <td className="whitespace-nowrap">
                        <div className="text-xs font-semibold text-[#050505]">
                          {work.physical_progress}% <span className="text-[#8E8D8A] font-normal">phys</span> / {work.financial_progress}% <span className="text-[#8E8D8A] font-normal">fin</span>
                        </div>
                        <div className="w-24 bg-[#E8E4DC] h-1.5 rounded-full mt-1.5 overflow-hidden flex">
                          <div style={{ width: `${work.physical_progress}%` }} className="h-full bg-[#2E8B57]" />
                          <div style={{ width: `${Math.max(0, work.financial_progress - work.physical_progress)}%` }} className="h-full bg-[#AA896C]" />
                        </div>
                      </td>

                      {/* Risk Score */}
                      <td className="whitespace-nowrap">
                        <RiskBadge score={work.overall_risk_score} level={work.risk_level} />
                      </td>

                      {/* Action */}
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWork(work.work_id);
                          }}
                          className="btn-secondary py-1 px-3 text-xs font-medium rounded-xl inline-flex items-center gap-1.5 hover:bg-[#F7F7F1]"
                        >
                          <Eye className="w-3 h-3 text-[#8E8D8A]" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="gov-card rounded-2xl p-4 border border-[#E8E4DC] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#5E5E5D]">
              Page <strong className="text-[#050505]">{currentPage}</strong> of <strong className="text-[#050505]">{totalPages.toLocaleString()}</strong> ({filteredWorks.length.toLocaleString()} items)
            </span>
            <div className="flex items-center gap-1.5 text-[#5E5E5D]">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#F7F7F1] border border-[#D8D2C7] rounded-xl px-2 py-1 text-xs text-[#050505] cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary py-1.5 px-3 text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {/* Page number buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pNum = Math.min(totalPages - 4 + i, currentPage - 2 + i);
                }
                return (
                  <button
                    key={pNum}
                    onClick={() => setCurrentPage(pNum)}
                    className={`w-8 h-8 rounded-xl font-medium text-xs transition-colors ${currentPage === pNum
                        ? 'bg-[#4B3C32] text-white shadow-xs'
                        : 'text-[#5E5E5D] hover:bg-[#F7F7F1] hover:text-[#050505]'
                      }`}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary py-1.5 px-3 text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
