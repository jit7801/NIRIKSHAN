import React from 'react';
import { 
  Building2, 
  Layers, 
  UserCheck, 
  ShieldCheck, 
  CheckCircle2, 
  MapPin, 
  Sliders, 
  FileText, 
  Printer, 
  Filter,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function RoleContextBanner({ 
  currentRole, 
  scopedDistrict,
  scopedState,
  scopedCount,
  totalCount,
  onOpenSettings,
  onNavigateTab,
  onClearScope,
  isScoped
}) {
  const roleConfigs = {
    DISTRICT: {
      title: "District Magistrate & Collector's Dashboard",
      designation: "Executive District Authority",
      location: "Jaipur District, Rajasthan",
      badgeColor: "bg-[#4B3C32] text-white",
      accentBg: "bg-white border-[#E8E4DC]",
      icon: Building2,
      description: "Statutory spot inquiry, contractor rate audit against Jaipur DSR, and physical asset verification.",
      actions: [
        { label: "Jaipur Risk Map", tab: "MAP", icon: MapPin },
        { label: "Print Inspection Orders", tab: "REPORTS", icon: Printer },
        { label: "Check Co-located Duplicates", tab: "DUPLICATES", icon: FileText }
      ]
    },
    STATE: {
      title: "State Nodal Officer's Oversight Dashboard",
      designation: "State Planning Authority",
      location: "Govt. of Rajasthan (All Constituencies)",
      badgeColor: "bg-[#916540] text-white",
      accentBg: "bg-white border-[#E8E4DC]",
      icon: Layers,
      description: "Inter-district expenditure velocity tracking, fund tranche reallocation, and state-wide milestone monitoring.",
      actions: [
        { label: "Cost Anomaly Outliers", tab: "COST_ANOMALIES", icon: Sparkles },
        { label: "State Delay Matrix", tab: "DELAY_STAGNATION", icon: Filter },
        { label: "State Consolidated Reports", tab: "REPORTS", icon: FileText }
      ]
    },
    MP: {
      title: "Hon'ble Member of Parliament (Lok Sabha)",
      designation: "Constituency Representative",
      location: "Jaipur Parliamentary Constituency",
      badgeColor: "bg-[#AA896C] text-white",
      accentBg: "bg-white border-[#E8E4DC]",
      icon: UserCheck,
      description: "Tracking delivery of MP-recommended community works, progress transparency, and redressing constituent delay flags.",
      actions: [
        { label: "Constituency Risk Works", tab: "WORK_LIST", icon: Building2 },
        { label: "Geospatial Site Map", tab: "MAP", icon: MapPin },
        { label: "Progress Reports", tab: "REPORTS", icon: FileText }
      ]
    },
    MINISTRY: {
      title: "Central Ministry of Statistics & Programme Implementation (MoSPI)",
      designation: "National Oversight Authority",
      location: "New Delhi (MoSPI Central Headquarters)",
      badgeColor: "bg-[#4B3C32] text-white",
      accentBg: "bg-white border-[#E8E4DC]",
      icon: ShieldCheck,
      description: "Macro fiscal leakage prevention, policy weight calibration, and cross-state anomaly benchmarking nationwide.",
      actions: [
        { label: "Calibrate Policy Weights", action: onOpenSettings, icon: Sliders },
        { label: "National Anomaly Map", tab: "MAP", icon: MapPin },
        { label: "Audit Registry", tab: "REPORTS", icon: FileText }
      ]
    },
    CITIZEN: {
      title: "MPLADS Citizen Transparency Portal",
      designation: "Open Public Audit",
      location: "Constituency Public Domain",
      badgeColor: "bg-[#2E8B57] text-white",
      accentBg: "bg-white border-[#E8E4DC]",
      icon: CheckCircle2,
      description: "Open access to sanctioned development works, physical completion proofs, and executing agency accountability in your ward.",
      actions: []
    }
  };

  const config = roleConfigs[currentRole] || roleConfigs.DISTRICT;
  const RoleIcon = config.icon;

  if (currentRole === 'CITIZEN') return null;

  return (
    <div className="gov-card p-5 sm:p-6 border border-[#E8E4DC] rounded-2xl bg-white shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Left: Role identity & Mission */}
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl ${config.badgeColor} flex items-center justify-center shrink-0 shadow-xs mt-0.5`}>
            <RoleIcon className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.badgeColor}`}>
                {config.designation}
              </span>
              <span className="text-xs text-[#5E5E5D] flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#AA896C]" />
                {config.location}
              </span>
              <span className="text-[11px] font-medium text-[#4B3C32] bg-[#F7F7F1] px-2.5 py-0.5 rounded-full border border-[#E8E4DC]">
                {scopedCount} Works in Role Scope ({totalCount} Total)
              </span>
            </div>

            <h2 className="text-sm sm:text-base font-bold text-[#050505] tracking-tight">
              {config.title}
            </h2>

            <p className="text-xs text-[#5E5E5D] leading-relaxed max-w-2xl">
              {config.description}
            </p>
          </div>
        </div>

        {/* Right: Role-specific Quick Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#E8E4DC]">
          {config.actions.map((act, idx) => {
            const ActIcon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (act.action) act.action();
                  else if (act.tab && onNavigateTab) onNavigateTab(act.tab);
                }}
                className="btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5 rounded-xl hover:bg-[#F7F7F1] transition-all"
              >
                <ActIcon className="w-3.5 h-3.5 text-[#AA896C]" />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
