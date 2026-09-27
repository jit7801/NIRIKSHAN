import React from 'react';
import { createPortal } from 'react-dom';
import { User, ShieldCheck, MapPin, Building2, Layers, CheckCircle2, X, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from './Toast';

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  currentRole, 
  setCurrentRole,
  onRefreshData 
}) {
  const { addToast } = useToast();

  if (!isOpen) return null;

  const roleDetails = {
    DISTRICT: {
      title: 'District Magistrate & Collector',
      office: 'DM Office, Jaipur Division',
      jurisdiction: 'Jaipur District, Rajasthan',
      level: 'District Level Executive Authority',
      icon: Building2,
      badge: 'District Magistrate'
    },
    STATE: {
      title: 'State Nodal Officer (MPLADS)',
      office: 'Planning Department, Govt. of Rajasthan',
      jurisdiction: 'State of Rajasthan (All 25 Constituencies)',
      level: 'State Level Administrative Authority',
      icon: Layers,
      badge: 'State Nodal Officer'
    },
    MP: {
      title: 'Hon\'ble Member of Parliament (Lok Sabha)',
      office: 'MP Constituency Nodal Secretariat',
      jurisdiction: 'Jaipur Parliamentary Constituency',
      level: 'Constituency Recommendation Authority',
      icon: ShieldCheck,
      badge: 'Member of Parliament'
    },
    MINISTRY: {
      title: 'Central Ministry Oversight Officer',
      office: 'Ministry of Statistics & Programme Implementation (MoSPI)',
      jurisdiction: 'National MPLADS Implementation Portal',
      level: 'Central Government Monitoring',
      icon: ShieldCheck,
      badge: 'Central Ministry'
    },
    CITIZEN: {
      title: 'Citizen Transparency Portal',
      office: 'Open Public Data Access Interface',
      jurisdiction: 'Public Domain / Open Audit',
      level: 'Public Transparency View',
      icon: CheckCircle2,
      badge: 'Citizen Access'
    }
  };

  const current = roleDetails[currentRole] || roleDetails.DISTRICT;
  const RoleIcon = current.icon;

  const handleResetSession = () => {
    addToast('Session refreshed. Cache reset.', 'info');
    if (onRefreshData) onRefreshData();
    onClose();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-[#E8E4DC] rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DC] bg-[#F7F7F1]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4B3C32] text-white flex items-center justify-center font-semibold text-xs shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">
                Nodal Authority Profile
              </h3>
              <p className="text-[11px] text-[#5E5E5D]">
                Active authenticated governance credential
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/40 transition-colors"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-[#4B3C32] uppercase tracking-wider bg-white px-2 py-0.5 rounded-lg border border-[#E8E4DC]">
                  {current.badge}
                </span>
                <h4 className="text-sm font-bold text-[#050505] mt-2">
                  {current.title}
                </h4>
                <p className="text-xs text-[#5E5E5D] mt-0.5">
                  {current.office}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#E8E4DC] text-[#4B3C32] shadow-xs">
                <RoleIcon className="w-5 h-5" />
              </div>
            </div>

            <div className="pt-2 border-t border-[#E8E4DC] space-y-1 text-xs text-[#5E5E5D]">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#C8BFB3] shrink-0" />
                <span>{current.jurisdiction}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E8B57] shrink-0" />
                <span>Statutory Authority: {current.level}</span>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher Buttons */}
          <div>
            <span className="text-[11px] font-semibold text-[#5E5E5D] uppercase tracking-wider block mb-2">
              Switch Administrative Role
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { id: 'DISTRICT', label: 'District Magistrate (Jaipur)' },
                { id: 'STATE', label: 'State Nodal Officer' },
                { id: 'MP', label: 'Hon\'ble MP (Jaipur)' },
                { id: 'MINISTRY', label: 'MoSPI Central Ministry' },
                { id: 'CITIZEN', label: 'Citizen Public View' }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setCurrentRole(r.id);
                    addToast(`Switched active view to: ${r.label}`, 'success');
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all border ${
                    currentRole === r.id
                      ? 'bg-[#4B3C32] text-white border-[#4B3C32] font-semibold shadow-xs'
                      : 'bg-white text-[#5E5E5D] border-[#E8E4DC] hover:bg-[#F7F7F1]'
                  }`}
                >
                  <span className="truncate block">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#E8E4DC] flex items-center justify-between gap-2">
            <button
              onClick={handleResetSession}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Pipeline Data</span>
            </button>
            <button
              onClick={onClose}
              className="btn-primary text-xs py-1.5 px-4"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
