import React from 'react';
import { 
  Briefcase, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  Copy,
  TrendingUp,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export default function KPICards({ summary, onSelectFilter }) {
  if (!summary) return null;

  const totalSanctionedCr = ((summary.total_sanctioned_amount || 0) / 10000000).toFixed(1);

  const cards = [
    {
      id: 'TOTAL',
      label: 'Total Projects',
      value: (summary.total_works || 0).toLocaleString(),
      context: `₹${totalSanctionedCr} Cr total sanctioned`,
      icon: Briefcase,
      accent: 'text-[#4B3C32]',
      iconBg: 'bg-[#F2F0EB]',
      badge: 'All works'
    },
    {
      id: 'HIGH',
      label: 'High & Critical Risk',
      value: ((summary.critical_count || 0) + (summary.high_count || 0)).toLocaleString(),
      context: `${summary.critical_count || 0} critical · ${summary.high_count || 0} high`,
      icon: AlertTriangle,
      accent: 'text-[#C94C4C]',
      iconBg: 'bg-[#FDF2F2]',
      badge: 'Action required'
    },
    {
      id: 'MEDIUM',
      label: 'Medium Risk',
      value: (summary.medium_count || 0).toLocaleString(),
      context: 'Score 30–59 · watchlist',
      icon: AlertOctagon,
      accent: 'text-[#E6A23C]',
      iconBg: 'bg-[#FEF8ED]',
      badge: 'Monitor'
    },
    {
      id: 'LOW',
      label: 'Low Risk',
      value: (summary.low_count || 0).toLocaleString(),
      context: 'Normative milestone velocity',
      icon: CheckCircle2,
      accent: 'text-[#2E8B57]',
      iconBg: 'bg-[#EEF7F2]',
      badge: 'On track'
    },
    {
      id: 'STAGNATION',
      label: 'Delayed / Stalled',
      value: (summary.stagnation_count || 0).toLocaleString(),
      context: 'Expenditure > physical by 20%+',
      icon: Clock,
      accent: 'text-[#916540]',
      iconBg: 'bg-[#F7F2ED]',
      badge: 'Pace gap'
    },
    {
      id: 'DUPLICATE',
      label: 'Potential Duplicates',
      value: (summary.duplicate_candidates_count || 0).toLocaleString(),
      context: 'Co-located within 150m radius',
      icon: Copy,
      accent: 'text-[#AA896C]',
      iconBg: 'bg-[#F5EFE9]',
      badge: 'Overlap test'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(card.id)}
            className="gov-card p-4 sm:p-4.5 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer hover:border-[#C8BFB3] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[#4B3C32] focus:outline-none"
            title={`View ${card.label}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3 w-full">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8D8A]">
                  {card.badge}
                </span>
                <div className={`w-7 h-7 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                  <Icon className={`w-3.5 h-3.5 ${card.accent}`} />
                </div>
              </div>

              <div className="text-2xl sm:text-[26px] font-bold text-[#050505] tracking-tight leading-none mb-1">
                {card.value}
              </div>

              <div className="text-xs font-semibold text-[#5E5E5D] group-hover:text-[#050505] transition-colors truncate">
                {card.label}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#F2EFEB] text-[11px] text-[#8E8D8A] w-full">
              <span className="truncate pr-1">{card.context}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#C8BFB3] group-hover:text-[#4B3C32] group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
