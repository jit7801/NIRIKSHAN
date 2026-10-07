import React from 'react';
import { createPortal } from 'react-dom';
import { Bell, AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, X, Trash2 } from 'lucide-react';
import RiskBadge from './RiskBadge';

export default function NotificationsPanel({ 
  isOpen, 
  onClose, 
  works = [], 
  onSelectWork 
}) {
  if (!isOpen) return null;

  // Derive notifications from critical and high risk works
  const criticalAlerts = works
    .filter((w) => w.overall_risk_score >= 60)
    .slice(0, 10);

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-end p-3 sm:p-4 bg-black/30 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white border border-[#E8E4DC] rounded-2xl shadow-xl overflow-hidden mt-14"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E8E4DC] bg-[#F7F7F1]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#C94C4C]/10 text-[#C94C4C] flex items-center justify-center border border-[#C94C4C]/20">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#050505]">
                Priority Risk Alerts ({criticalAlerts.length})
              </h3>
              <span className="text-[10px] text-[#5E5E5D]">
                Real-time anomalies requiring field audit
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/40 transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E8E4DC] scrollbar-thin">
          {criticalAlerts.length === 0 ? (
            <div className="p-8 text-center text-[#5E5E5D]">
              <CheckCircle2 className="w-8 h-8 text-[#2E8B57] mx-auto mb-2 opacity-80" />
              <p className="text-xs font-medium text-[#050505]">No pending critical alerts</p>
              <p className="text-[11px] text-[#5E5E5D] mt-0.5">All monitored works are within policy thresholds.</p>
            </div>
          ) : (
            criticalAlerts.map((work) => {
              const isCritical = work.overall_risk_score >= 80;
              return (
                <div
                  key={work.work_id}
                  onClick={() => {
                    onSelectWork(work.work_id);
                    onClose();
                  }}
                  className="p-3.5 hover:bg-[#F7F7F1]/50 cursor-pointer transition-colors flex items-start gap-3 group"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isCritical ? 'bg-[#C94C4C]' : 'bg-[#E6A23C]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-mono text-[10px] text-[#5E5E5D] truncate">{work.work_id}</span>
                      <RiskBadge score={work.overall_risk_score} level={work.risk_level} size="sm" />
                    </div>
                    <p className="text-xs font-semibold text-[#050505] group-hover:text-[#4B3C32] transition-colors truncate">
                      {work.work_title}
                    </p>
                    <p className="text-[11px] text-[#C94C4C] font-medium mt-0.5 truncate">
                      {work.primary_risk_factor}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C8BFB3] group-hover:text-[#4B3C32] transition-colors shrink-0 self-center" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {criticalAlerts.length > 0 && (
          <div className="p-2.5 border-t border-[#E8E4DC] bg-[#F7F7F1]/60 text-center">
            <span className="text-[11px] text-[#5E5E5D]">
              Click any alert to inspect the complete forensic dossier
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;
}
