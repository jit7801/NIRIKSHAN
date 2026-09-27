import React, { useState } from 'react';
import { X, HelpCircle, BookOpen, ShieldCheck, Scale, Clock, Copy, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  const sections = [
    { id: 'overview', title: 'System Overview', icon: BookOpen },
    { id: 'financial', title: '1. Financial & Cost Anomalies', icon: Scale },
    { id: 'delay', title: '2. Progress Gap & Stagnation', icon: Clock },
    { id: 'duplicates', title: '3. Duplicate & Overlap Detection', icon: Copy },
    { id: 'directives', title: '4. Statutory Field Notices', icon: FileText },
  ];

  return (
    <div 
      className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div 
        className="bg-white border border-[#E8E4DC] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DC] bg-[#F7F7F1]/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4B3C32] text-white flex items-center justify-center shrink-0 shadow-xs">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="help-modal-title" className="text-sm sm:text-base font-bold text-[#050505]">
                MPLADS Risk Intelligence — Verification Guidelines
              </h2>
              <p className="text-[11px] text-[#5E5E5D]">
                Operational manual and algorithmic rationale for district nodal authorities.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/40 transition-colors"
            aria-label="Close help guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          
          {/* Navigation Tab list */}
          <div className="w-full sm:w-48 bg-[#F7F7F1]/60 border-b sm:border-b-0 sm:border-r border-[#E8E4DC] p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto shrink-0 scrollbar-thin">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive 
                      ? 'bg-white text-[#4B3C32] font-semibold shadow-xs border border-[#E8E4DC]'
                      : 'text-[#5E5E5D] hover:bg-[#E8E4DC]/40 hover:text-[#050505]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#4B3C32]' : 'text-[#5E5E5D]'}`} />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>

          {/* Section Content Area */}
          <div className="flex-1 p-5 overflow-y-auto text-xs leading-relaxed text-[#5E5E5D] space-y-4 scrollbar-thin">
            
            {activeSection === 'overview' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#050505]">Objective & Scope</h3>
                <p>
                  The <strong>MPLADS Risk Intelligence Layer</strong> is a transparent, explainable decision-support engine developed to assist Members of Parliament, District Magistrates, and central monitoring bodies.
                </p>
                <div className="p-3 bg-[#F7F7F1]/70 rounded-xl border border-[#E8E4DC] space-y-1.5">
                  <span className="font-semibold text-[#050505] block">Unified Risk Scoring (0–100 Scale):</span>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-[#5E5E5D]">
                    <li><strong className="text-[#C94C4C]">Critical (80–100):</strong> Urgent spot inspection mandated within 7 days.</li>
                    <li><strong className="text-[#916540]">High (60–79):</strong> Elevated progress gap or cost outlier requiring desk audit.</li>
                    <li><strong className="text-[#E6A23C]">Medium (30–59):</strong> Routine monitoring with minor milestone slippage.</li>
                    <li><strong className="text-[#2E8B57]">Low (0–29):</strong> Fully compliant and on-schedule execution.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'financial' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#050505]">Peer Group Baselining & Cost Outliers</h3>
                <p>
                  Rather than evaluating projects in isolation, every project is benchmarked against its statistical peer cohort (defined by <em>Work Category × District</em>).
                </p>
                <p>
                  The engine computes the median sanctioned rate and Median Absolute Deviation (MAD). Works exceeding <strong>1.45×</strong> of peer median or exhibiting Modified Z-scores &gt; 2.5 are flagged for verification against the District Schedule of Rates (DSR).
                </p>
              </div>
            )}

            {activeSection === 'delay' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#050505]">Physical vs Financial Progress Divergence</h3>
                <p>
                  A critical vulnerability in infrastructure projects is disbursement of public funds without commensurate ground execution.
                </p>
                <p>
                  The engine monitors the progress divergence: <code>Financial Progress % - Physical Progress %</code>. If this gap exceeds <strong>20%</strong> or if zero physical updates have been recorded for <strong>&gt;60 days</strong>, a Stagnation Alert is triggered.
                </p>
              </div>
            )}

            {activeSection === 'duplicates' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#050505]">Spatial & Semantic Duplicate Detection</h3>
                <p>
                  Works sanctioned within a <strong>150-meter spatial bubble</strong> are evaluated using Haversine geodesic proximity combined with TF-IDF character n-gram cosine similarity.
                </p>
                <p>
                  When spatial distance is &lt;100m and title/agency match is &gt;40%, the system flags the pair as candidate duplicate works for field auditors to inspect on-site before double disbursements occur.
                </p>
              </div>
            )}

            {activeSection === 'directives' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#050505]">Statutory Field Verification Notices</h3>
                <p>
                  For any work in the Critical or High risk tier, district administrators can generate a standardized, legally formatted <strong>Field Verification Notice</strong> with one click.
                </p>
                <p>
                  The notice includes the exact mathematical justification, evidence checklist, and assigned Junior Engineer directive to upload geotagged photographic confirmation within 7 working days.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#E8E4DC] bg-[#F7F7F1]/60 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="btn-primary text-xs py-1.5 px-4"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
