import React, { useState, useMemo } from 'react';
import RiskBadge from './RiskBadge';
import { 
  Search, 
  Info, 
  Download, 
  X, 
  FilterX, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle 
} from 'lucide-react';
import { useToast } from './Toast';

export default function CostAnomaliesView({ works = [], onSelectWork }) {
  const { addToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Extract categories & districts
  const categories = useMemo(() => Array.from(new Set(works.map((w) => w.work_category))).filter(Boolean).sort(), [works]);
  const districts = useMemo(() => Array.from(new Set(works.map((w) => w.district))).filter(Boolean).sort(), [works]);

  const hasActiveFilters = Boolean(search || selectedCategory || selectedDistrict);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedDistrict('');
    setCurrentPage(1);
    addToast('Cost anomaly filters reset.', 'info');
  };

  // Filter works that have elevated financial risk (score >= 15)
  const costAnomalies = useMemo(() => {
    return works.filter((w) => {
      const isOutlier = (w.financial_risk || 0) >= 15;
      const matchCat = !selectedCategory || w.work_category === selectedCategory;
      const matchDist = !selectedDistrict || w.district === selectedDistrict;
      const matchSearch = !search || 
        (w.work_title && w.work_title.toLowerCase().includes(search.toLowerCase())) || 
        (w.work_id && w.work_id.toLowerCase().includes(search.toLowerCase())) ||
        (w.district && w.district.toLowerCase().includes(search.toLowerCase()));
      return isOutlier && matchCat && matchDist && matchSearch;
    }).sort((a, b) => (b.financial_risk || 0) - (a.financial_risk || 0));
  }, [works, selectedCategory, selectedDistrict, search]);

  const totalPages = Math.ceil(costAnomalies.length / pageSize) || 1;
  const paginatedAnomalies = costAnomalies.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCSV = () => {
    if (costAnomalies.length === 0) {
      addToast('No cost anomaly records to export.', 'warning');
      return;
    }

    const headers = [
      'Work ID', 'Work Title', 'District', 'State', 'Category',
      'This Work Cost (INR)', 'Peer Median (INR)', 'Cost Variance (%)',
      'Financial Risk Score', 'Unified Risk Score', 'Risk Level'
    ];
    const rows = costAnomalies.map((w) => {
      const cEval = w.cost_evaluation || {};
      const median = cEval.cohort_median || w.sanctioned_amount || 0;
      const ratio = cEval.cost_ratio || 1.0;
      const diffPct = Math.round((ratio - 1.0) * 100);

      return [
        `"${w.work_id || ''}"`,
        `"${(w.work_title || '').replace(/"/g, '""')}"`,
        `"${w.district || ''}"`,
        `"${w.state || ''}"`,
        `"${w.work_category || ''}"`,
        w.sanctioned_amount || 0,
        median,
        `${diffPct}%`,
        w.financial_risk || 0,
        w.overall_risk_score || 0,
        w.risk_level || ''
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MPLADS_Cost_Anomalies_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${costAnomalies.length} cost anomaly records to CSV.`, 'success');
  };

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#050505] tracking-tight">
            Cost Anomaly Intelligence
          </h2>
          <p className="text-xs text-[#5E5E5D]">
            Identify works whose cost significantly exceeds comparable like-for-like projects within the same peer group.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs font-medium self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-[#5E5E5D]" />
          <span>Export Anomalies (CSV)</span>
        </button>
      </div>

      {/* Explanatory Context Box */}
      <div className="gov-card p-4 bg-[#F7F7F1]/80 border-[#E8E4DC] flex items-start gap-3">
        <Info className="w-4 h-4 text-[#4B3C32] shrink-0 mt-0.5" />
        <div className="text-xs text-[#5E5E5D] leading-relaxed">
          <strong className="text-[#050505]">Methodology:</strong> Works are stratified into fine-grained peer cohorts (<em>Work Category × District</em>). 
          The system calculates the robust Median and Median Absolute Deviation (MAD) of historical sanctioned rates. Works with Modified Z-scores &gt; 2.5 or cost ratios &gt; 1.45× peer median are surfaced for rate validation against District Schedule of Rates (DSR).
        </div>
      </div>

      {/* Filter Bar */}
      <div className="gov-card p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5E5E5D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search cost outlier works..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F7F7F1]/70 text-xs text-[#050505] pl-9 pr-7 py-2 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32] focus:bg-[#FFFFFF] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5E5E5D] hover:text-[#050505]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* District Filter */}
          <select
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#F7F7F1]/70 text-xs text-[#050505] px-2.5 py-2 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32] focus:bg-[#FFFFFF] cursor-pointer transition-all"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#F7F7F1]/70 text-xs text-[#050505] px-2.5 py-2 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32] focus:bg-[#FFFFFF] cursor-pointer transition-all"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E8E4DC] text-xs text-[#5E5E5D]">
          <span>Found <strong className="text-[#050505]">{costAnomalies.length}</strong> cost anomalies</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[#C94C4C] hover:text-[#C94C4C]/80 flex items-center gap-1 font-semibold text-xs transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Outliers Table */}
      <div className="gov-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse gov-table min-w-[720px]">
            <thead>
              <tr>
                <th>Work Title & ID</th>
                <th>Location</th>
                <th>Category</th>
                <th>This Work</th>
                <th>Peer Median</th>
                <th>Difference</th>
                <th>Risk Score</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAnomalies.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#5E5E5D]">
                    <AlertCircle className="w-8 h-8 text-[#C8BFB3] mx-auto mb-2" />
                    <div className="font-semibold text-sm text-[#050505]">No cost anomalies found</div>
                    <p className="text-xs text-[#5E5E5D] mt-1">Try selecting a different district or category.</p>
                  </td>
                </tr>
              ) : (
                paginatedAnomalies.map((work) => {
                  const cEval = work.cost_evaluation || {};
                  const median = cEval.cohort_median || work.sanctioned_amount || 0;
                  const ratio = cEval.cost_ratio || 1.0;
                  const diffPct = Math.round((ratio - 1.0) * 100);

                  return (
                    <tr
                      key={work.work_id}
                      onClick={() => onSelectWork(work.work_id)}
                      className="cursor-pointer hover:bg-[#F7F7F1]/50 transition-colors"
                    >
                      <td className="max-w-[260px]">
                        <div className="font-semibold text-[#050505] hover:text-[#4B3C32] transition-colors truncate">
                          {work.work_title}
                        </div>
                        <div className="text-[10px] text-[#5E5E5D] font-mono mt-0.5">
                          {work.work_id}
                        </div>
                      </td>

                      <td className="whitespace-nowrap">
                        <div className="text-[#050505] font-medium">{work.district}</div>
                        <div className="text-[10px] text-[#5E5E5D]">{work.state}</div>
                      </td>

                      <td className="whitespace-nowrap text-xs text-[#5E5E5D]">
                        {work.work_category}
                      </td>

                      <td className="whitespace-nowrap font-medium text-[#050505]">
                        ₹{((work.sanctioned_amount || 0) / 100000).toFixed(2)}L
                      </td>

                      <td className="whitespace-nowrap text-[#5E5E5D] font-medium">
                        ₹{(median / 100000).toFixed(2)}L
                      </td>

                      <td className="whitespace-nowrap">
                        <span className="font-semibold text-[#916540] bg-[#916540]/10 px-2 py-0.5 rounded-lg border border-[#916540]/25 text-xs">
                          +{diffPct}%
                        </span>
                      </td>

                      <td className="whitespace-nowrap">
                        <RiskBadge score={work.overall_risk_score} level={work.risk_level} />
                      </td>

                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWork(work.work_id);
                          }}
                          className="btn-secondary py-1 px-2.5 text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-[#5E5E5D]" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="gov-card p-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-[#5E5E5D]">
            Page <strong className="text-[#050505]">{currentPage}</strong> of <strong className="text-[#050505]">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary py-1 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary py-1 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
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
