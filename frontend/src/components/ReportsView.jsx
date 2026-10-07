import React, { useState, useMemo } from 'react';
import RiskBadge from './RiskBadge';
import { Printer, Download, Search, FilterX, Eye, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';

export default function ReportsView({ works = [], onSelectWork }) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedRisk, setSelectedRisk] = useState('');

  // Flagged works requiring field inquiries
  const flaggedWorks = useMemo(() => {
    return works.filter((w) => {
      const isFlagged = (w.overall_risk_score || 0) >= 60;
      const matchRisk = !selectedRisk || w.risk_level === selectedRisk;
      const matchSearch = !search ||
        (w.work_title && w.work_title.toLowerCase().includes(search.toLowerCase())) ||
        (w.work_id && w.work_id.toLowerCase().includes(search.toLowerCase())) ||
        (w.district && w.district.toLowerCase().includes(search.toLowerCase())) ||
        (w.implementing_agency && w.implementing_agency.toLowerCase().includes(search.toLowerCase()));

      return isFlagged && matchRisk && matchSearch;
    }).sort((a, b) => (b.overall_risk_score || 0) - (a.overall_risk_score || 0));
  }, [works, selectedRisk, search]);

  const exportCSV = () => {
    if (flaggedWorks.length === 0) {
      addToast('No verification directive records to export.', 'warning');
      return;
    }

    const headers = [
      'Order Ref', 'Work ID', 'Project Title', 'Location', 'Risk Score',
      'Risk Level', 'Primary Signal', 'Ordered Administrative Action', 'Implementing Agency'
    ];
    const rows = flaggedWorks.map((w) => [
      `"MPLADS/INQ/${w.district || 'GEN'}/${new Date().getFullYear()}/${w.work_id}"`,
      `"${w.work_id || ''}"`,
      `"${(w.work_title || '').replace(/"/g, '""')}"`,
      `"${w.district || ''}, ${w.state || ''}"`,
      w.overall_risk_score || 0,
      w.risk_level || '',
      `"${(w.primary_risk_factor || '').replace(/"/g, '""')}"`,
      `"${(w.recommended_action || '').replace(/"/g, '""')}"`,
      `"${(w.implementing_agency || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MPLADS_Verification_Directives_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${flaggedWorks.length} administrative orders to CSV.`, 'success');
  };

  return (
    <div className="space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#050505] tracking-tight">
            Inspection Orders & Audit Registry
          </h2>
          <p className="text-xs text-[#5E5E5D]">
            Formal statutory verification directives issued for high-risk and critical infrastructure projects.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs font-medium"
            title="Download CSV report of active directives"
          >
            <Download className="w-3.5 h-3.5 text-[#5E5E5D]" />
            <span>Export (CSV)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-1.5 py-1.5 text-xs font-medium"
            title="Print formal audit summary"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Summary</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="gov-card p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#5E5E5D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by order ID, title, agency, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F7F1]/70 text-xs text-[#050505] pl-9 pr-3 py-2 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32] focus:bg-[#FFFFFF] transition-all"
            />
          </div>

          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-[#F7F7F1]/70 text-[#050505] text-xs font-medium px-2.5 py-2 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32] focus:bg-[#FFFFFF] cursor-pointer transition-all"
          >
            <option value="">All Risk Tiers</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
          </select>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#5E5E5D]">
          <span>Found <strong className="text-[#050505]">{flaggedWorks.length}</strong> active directives</span>
          {(search || selectedRisk) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedRisk('');
              }}
              className="text-[#C94C4C] hover:text-[#C94C4C]/80 font-semibold text-xs flex items-center gap-1 transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="gov-card overflow-hidden">
        <div className="p-3.5 border-b border-[#E8E4DC] bg-[#F7F7F1]/60 flex items-center justify-between text-xs">
          <span className="font-bold text-[#050505]">
            Active Field Verification Directives ({flaggedWorks.length})
          </span>
          <span className="text-[#5E5E5D]">
            District Magistrate Oversight · Jaipur Division
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse gov-table min-w-[760px]">
            <thead>
              <tr>
                <th>Order Ref / Work ID</th>
                <th>Project Title</th>
                <th>Location</th>
                <th>Risk Level</th>
                <th>Ordered Administrative Action</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {flaggedWorks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[#5E5E5D]">
                    <AlertCircle className="w-8 h-8 text-[#C8BFB3] mx-auto mb-2" />
                    <div className="font-semibold text-sm text-[#050505]">No directives matching search criteria</div>
                    <p className="text-xs text-[#5E5E5D] mt-1">Try resetting search filters.</p>
                  </td>
                </tr>
              ) : (
                flaggedWorks.map((work) => (
                  <tr
                    key={work.work_id}
                    onClick={() => onSelectWork(work.work_id)}
                    className="cursor-pointer hover:bg-[#F7F7F1]/50 transition-colors"
                  >
                    <td className="whitespace-nowrap font-mono text-xs text-[#050505] font-semibold">
                      <div>{work.work_id}</div>
                      <div className="text-[10px] text-[#5E5E5D] font-normal">
                        Ref: INQ/{work.district || 'JP'}/{work.work_id}
                      </div>
                    </td>

                    <td className="max-w-[260px]">
                      <div className="font-bold text-[#050505] hover:text-[#4B3C32] transition-colors truncate">
                        {work.work_title}
                      </div>
                      <div className="text-[11px] text-[#5E5E5D] truncate mt-0.5">
                        Agency: {work.implementing_agency}
                      </div>
                    </td>

                    <td className="whitespace-nowrap text-xs text-[#5E5E5D]">
                      <div className="font-medium text-[#050505]">{work.district}</div>
                      <div className="text-[10px] text-[#5E5E5D]">{work.state}</div>
                    </td>

                    <td className="whitespace-nowrap">
                      <RiskBadge score={work.overall_risk_score} level={work.risk_level} />
                    </td>

                    <td className="max-w-[300px] text-xs text-[#5E5E5D]">
                      <p className="line-clamp-2 leading-relaxed">
                        {work.recommended_action}
                      </p>
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
                        <span>View Notice</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
