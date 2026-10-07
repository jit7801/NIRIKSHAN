import React, { useState, useMemo } from 'react';
import RiskBadge from './RiskBadge';
import { 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter, 
  Download, 
  X, 
  FilterX, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle 
} from 'lucide-react';
import { useToast } from './Toast';

export default function DelayStagnationView({ works = [], onSelectWork }) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, MISMATCH, DORMANT, OVERDUE
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const delayedWorks = useMemo(() => {
    return works.filter((w) => {
      const dEval = w.delay_evaluation || {};
      const gap = dEval.progress_gap || (w.financial_progress - w.physical_progress);
      const daysDormant = dEval.days_dormant || 0;
      const daysOverdue = dEval.days_overdue || 0;

      const hasDelayRisk = (w.delay_risk || 0) >= 12 || gap >= 20 || daysDormant >= 60 || daysOverdue > 0;
      if (!hasDelayRisk) return false;

      if (filterType === 'MISMATCH' && gap < 20) return false;
      if (filterType === 'DORMANT' && daysDormant < 60) return false;
      if (filterType === 'OVERDUE' && daysOverdue <= 0) return false;

      if (search) {
        const s = search.toLowerCase();
        return (
          (w.work_title && w.work_title.toLowerCase().includes(s)) ||
          (w.work_id && w.work_id.toLowerCase().includes(s)) ||
          (w.district && w.district.toLowerCase().includes(s))
        );
      }
      return true;
    }).sort((a, b) => (b.delay_risk || 0) - (a.delay_risk || 0));
  }, [works, filterType, search]);

  const totalPages = Math.ceil(delayedWorks.length / pageSize) || 1;
  const paginatedWorks = delayedWorks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCSV = () => {
    if (delayedWorks.length === 0) {
      addToast('No delay records to export.', 'warning');
      return;
    }

    const headers = [
      'Work ID', 'Work Title', 'District', 'State', 'Category',
      'Physical Progress (%)', 'Financial Progress (%)', 'Progress Divergence Gap (%)',
      'Days Dormant', 'Days Overdue', 'Delay Risk Score', 'Unified Risk Score'
    ];
    const rows = delayedWorks.map((w) => {
      const dEval = w.delay_evaluation || {};
      const gap = dEval.progress_gap || (w.financial_progress - w.physical_progress);
      return [
        `"${w.work_id || ''}"`,
        `"${(w.work_title || '').replace(/"/g, '""')}"`,
        `"${w.district || ''}"`,
        `"${w.state || ''}"`,
        `"${w.work_category || ''}"`,
        w.physical_progress || 0,
        w.financial_progress || 0,
        gap,
        dEval.days_dormant || 0,
        dEval.days_overdue || 0,
        w.delay_risk || 0,
        w.overall_risk_score || 0
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MPLADS_Delayed_Works_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${delayedWorks.length} delay records to CSV.`, 'success');
  };

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#050505] tracking-tight">
            Delay & Stagnation Intelligence
          </h2>
          <p className="text-xs text-[#5E5E5D]">
            Track works where financial expenditure outpaces verified physical assets, milestone dates have lapsed, or progress updates have halted.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs font-medium self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-[#5E5E5D]" />
          <span>Export Delays (CSV)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="gov-card p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#5E5E5D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search delayed works by title, ID, district..."
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

          {/* Filter Type Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-[#F7F7F1] p-1 rounded-xl border border-[#E8E4DC] text-xs">
            {[
              { id: 'ALL', label: 'All Flagged' },
              { id: 'MISMATCH', label: 'Progress Mismatch (>20%)' },
              { id: 'DORMANT', label: 'Dormant (>60d)' },
              { id: 'OVERDUE', label: 'Target Lapsed' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterType(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === tab.id
                    ? 'bg-[#4B3C32] text-white shadow-xs'
                    : 'text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E8E4DC] text-xs text-[#5E5E5D]">
          <span>Displaying <strong className="text-[#050505]">{delayedWorks.length}</strong> flagged projects</span>
          {(search || filterType !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setFilterType('ALL');
                setCurrentPage(1);
              }}
              className="text-[#C94C4C] hover:text-[#C94C4C]/80 flex items-center gap-1 font-semibold text-xs transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Delayed Works Table */}
      <div className="gov-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse gov-table min-w-[760px]">
            <thead>
              <tr>
                <th>Work Title & ID</th>
                <th>Location</th>
                <th>Progress (Phys vs Fin)</th>
                <th>Divergence Gap</th>
                <th>Stagnation Days</th>
                <th>Delay Score</th>
                <th>Total Risk</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWorks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#5E5E5D]">
                    <AlertCircle className="w-8 h-8 text-[#C8BFB3] mx-auto mb-2" />
                    <div className="font-semibold text-sm text-[#050505]">No delayed works found</div>
                    <p className="text-xs text-[#5E5E5D] mt-1">All works are currently progressing within milestones.</p>
                  </td>
                </tr>
              ) : (
                paginatedWorks.map((work) => {
                  const dEval = work.delay_evaluation || {};
                  const gap = dEval.progress_gap ?? Math.max(0, work.financial_progress - work.physical_progress);
                  const daysDormant = dEval.days_dormant || 0;

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
                          {work.work_id} · {work.work_category}
                        </div>
                      </td>

                      <td className="whitespace-nowrap">
                        <div className="text-[#050505] font-medium">{work.district}</div>
                        <div className="text-[10px] text-[#5E5E5D]">{work.state}</div>
                      </td>

                      <td className="whitespace-nowrap">
                        <div className="text-xs font-semibold text-[#050505]">
                          {work.physical_progress}% phys / {work.financial_progress}% fin
                        </div>
                        <div className="w-24 bg-[#E8E4DC]/80 h-1.5 rounded-full mt-1.5 overflow-hidden flex">
                          <div style={{ width: `${work.physical_progress}%` }} className="h-full bg-[#2E8B57]" />
                          <div style={{ width: `${Math.max(0, work.financial_progress - work.physical_progress)}%` }} className="h-full bg-[#AA896C]" />
                        </div>
                      </td>

                      <td className="whitespace-nowrap">
                        {gap > 0 ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                            gap >= 30 
                              ? 'bg-[#C94C4C]/10 text-[#C94C4C] border-[#C94C4C]/25' 
                              : 'bg-[#E6A23C]/10 text-[#916540] border-[#E6A23C]/25'
                          }`}>
                            +{gap}% gap
                          </span>
                        ) : (
                          <span className="text-xs text-[#5E5E5D]">Aligned</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap font-medium text-xs text-[#050505]">
                        {daysDormant > 0 ? `${daysDormant} days` : 'Active'}
                      </td>

                      <td className="whitespace-nowrap font-bold text-xs text-[#916540]">
                        {work.delay_risk || 0} / 30
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
