import React, { useState, useMemo } from 'react';
import { Search, MapPin, Building2, ExternalLink, FilterX, Eye, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CitizenView({ works = [] }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPublicWork, setSelectedPublicWork] = useState(null);

  const categories = useMemo(() => Array.from(new Set(works.map((w) => w.work_category))).filter(Boolean).sort(), [works]);

  const filtered = useMemo(() => {
    return works.filter((w) => {
      const matchCat = !selectedCategory || w.work_category === selectedCategory;
      const matchStatus = !selectedStatus || w.status === selectedStatus;
      if (!search) return matchCat && matchStatus;
      const s = search.toLowerCase();
      const matchSearch =
        (w.work_title && w.work_title.toLowerCase().includes(s)) ||
        (w.village && w.village.toLowerCase().includes(s)) ||
        (w.ward && w.ward.toLowerCase().includes(s)) ||
        (w.district && w.district.toLowerCase().includes(s)) ||
        (w.work_id && w.work_id.toLowerCase().includes(s));
      return matchCat && matchStatus && matchSearch;
    });
  }, [works, search, selectedCategory, selectedStatus]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedStatus('');
  };

  return (
    <div className="space-y-6">
      
      {/* Citizen Transparency Banner */}
      <div className="gov-card p-5 sm:p-6 bg-white border-[#E8E4DC]">
        <div className="max-w-3xl space-y-3">
          <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold text-[#4B3C32] bg-[#F7F7F1] border border-[#E8E4DC]">
            Public Transparency & Social Audit Portal
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-[#050505] tracking-tight">
            MPLADS Constituency Works Public Transparency Register
          </h2>
          <p className="text-xs text-[#5E5E5D] leading-relaxed">
            Open public registry of community development projects recommended under the Member of Parliament Local Area Development Scheme. 
            Track community assets, sanctioned funds, implementing agencies, and physical progress in your local village or ward.
          </p>

          {/* Search Bar */}
          <div className="pt-2 relative max-w-lg">
            <Search className="w-3.5 h-3.5 text-[#5E5E5D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by village, ward, district, or project title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F7F1]/70 text-xs text-[#050505] pl-9 pr-7 py-2.5 rounded-xl border border-[#E8E4DC] focus:outline-none focus:border-[#4B3C32] focus:bg-[#FFFFFF] transition-all"
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

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                !selectedCategory ? 'bg-[#4B3C32] text-white' : 'bg-[#F7F7F1] text-[#5E5E5D] hover:bg-[#E8E4DC]/50'
              }`}
            >
              All Categories
            </button>
            {categories.slice(0, 6).map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c === selectedCategory ? '' : c)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  selectedCategory === c ? 'bg-[#4B3C32] text-white' : 'bg-[#F7F7F1] text-[#5E5E5D] hover:bg-[#E8E4DC]/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-[#5E5E5D] px-1">
        <span>Found <strong className="text-[#050505]">{filtered.length}</strong> public community works</span>
        {(search || selectedCategory || selectedStatus) && (
          <button
            onClick={clearFilters}
            className="text-[#C94C4C] hover:text-[#C94C4C]/80 flex items-center gap-1 font-semibold transition-colors"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Reset Search</span>
          </button>
        )}
      </div>

      {/* Citizen Project Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.slice(0, 18).map((work) => (
          <div
            key={work.work_id}
            onClick={() => setSelectedPublicWork(work)}
            className="gov-card p-4 gov-card-hover cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-mono text-[10px] text-[#5E5E5D]">{work.work_id}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                  work.status === 'COMPLETED'
                    ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20'
                    : 'bg-[#F7F7F1] text-[#5E5E5D] border-[#E8E4DC]'
                }`}>
                  {work.status}
                </span>
              </div>

              <h4 className="text-sm font-bold text-[#050505] mb-2 leading-snug line-clamp-2">
                {work.work_title}
              </h4>

              <div className="text-xs text-[#5E5E5D] space-y-1 mb-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#C8BFB3] shrink-0" />
                  <span className="truncate">{work.village || work.ward ? `${work.village || work.ward}, ` : ''}{work.district}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#C8BFB3] shrink-0" />
                  <span className="truncate">Category: {work.work_category}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E4DC] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#5E5E5D]">Sanctioned Fund:</span>
                <strong className="text-[#050505]">₹{((work.sanctioned_amount || 0) / 100000).toFixed(2)} Lakhs</strong>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#5E5E5D] mb-1">
                  <span>Physical Completion</span>
                  <span className="font-bold text-[#2E8B57]">{work.physical_progress}%</span>
                </div>
                <div className="w-full bg-[#E8E4DC]/80 h-1.5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${work.physical_progress}%` }}
                    className="h-full bg-[#2E8B57] rounded-full"
                  />
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPublicWork(work);
                }}
                className="btn-secondary w-full py-1.5 text-xs font-medium text-center mt-1 inline-flex items-center justify-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-[#5E5E5D]" />
                <span>View Public Details</span>
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Public Project Details Modal */}
      {selectedPublicWork && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4"
          onClick={() => setSelectedPublicWork(null)}
        >
          <div 
            className="bg-white border border-[#E8E4DC] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DC] bg-[#F7F7F1]/60">
              <div>
                <span className="text-[10px] font-bold text-[#4B3C32] uppercase tracking-wider bg-white px-2 py-0.5 rounded-lg border border-[#E8E4DC]">
                  Public Asset Card
                </span>
                <h3 className="text-sm font-bold text-[#050505] mt-1.5">
                  {selectedPublicWork.work_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPublicWork(null)}
                className="p-1 rounded-lg text-[#5E5E5D] hover:text-[#050505] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-[#5E5E5D]">
              <div>
                <h4 className="text-sm font-bold text-[#050505] leading-snug mb-1">
                  {selectedPublicWork.work_title}
                </h4>
                <p className="text-xs text-[#5E5E5D]">
                  Location: {selectedPublicWork.village || selectedPublicWork.ward ? `${selectedPublicWork.village || selectedPublicWork.ward}, ` : ''}{selectedPublicWork.district}, {selectedPublicWork.state}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC]">
                <div>
                  <span className="text-[#5E5E5D] block text-[11px]">Sanctioned Fund</span>
                  <strong className="text-sm text-[#050505]">₹{((selectedPublicWork.sanctioned_amount || 0) / 100000).toFixed(2)}L</strong>
                </div>
                <div>
                  <span className="text-[#5E5E5D] block text-[11px]">Executing Agency</span>
                  <strong className="text-xs text-[#050505] truncate block">{selectedPublicWork.implementing_agency || 'DRDA'}</strong>
                </div>
                <div>
                  <span className="text-[#5E5E5D] block text-[11px]">Physical Progress</span>
                  <strong className="text-sm text-[#2E8B57]">{selectedPublicWork.physical_progress}%</strong>
                </div>
                <div>
                  <span className="text-[#5E5E5D] block text-[11px]">Project Status</span>
                  <strong className="text-xs text-[#050505]">{selectedPublicWork.status}</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#2E8B57]/10 border border-[#2E8B57]/20 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2E8B57] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#050505] leading-relaxed">
                  Citizens can report ground observations, delay concerns, or physical quality feedback directly to the District Planning Officer.
                </p>
              </div>

              <div className="pt-2 border-t border-[#E8E4DC] flex justify-end">
                <button
                  onClick={() => setSelectedPublicWork(null)}
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
