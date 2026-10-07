import React from 'react';
import { AlertOctagon, TrendingUp, Clock, Copy, FileWarning, CheckCircle, ShieldCheck } from 'lucide-react';

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      title: "Total Monitored Works",
      value: summary.total_works || 0,
      subtext: `₹${((summary.total_sanctioned_amount || 0) / 10000000).toFixed(1)} Cr total budget`,
      icon: ShieldCheck,
      color: "text-[#4B3C32]",
      border: "border-[#E8E4DC]",
      bg: "bg-white",
    },
    {
      title: "Critical Risk Projects",
      value: summary.critical_count || 0,
      subtext: "Requires immediate inspection today",
      icon: AlertOctagon,
      color: "text-[#C94C4C]",
      border: "border-[#C94C4C]/25",
      bg: "bg-[#C94C4C]/5",
      pulse: false,
    },
    {
      title: "Cost Anomalies",
      value: summary.cost_anomalies_count || 0,
      subtext: "Costs > 1.5× peer median",
      icon: TrendingUp,
      color: "text-[#916540]",
      border: "border-[#E8E4DC]",
      bg: "bg-white",
    },
    {
      title: "Progress Mismatch / Stalled",
      value: summary.stagnation_count || 0,
      subtext: "Financial progress > physical by 30%+",
      icon: Clock,
      color: "text-[#AA896C]",
      border: "border-[#E8E4DC]",
      bg: "bg-white",
    },
    {
      title: "Candidate Duplicate Works",
      value: summary.duplicate_candidates_count || 0,
      subtext: "Co-located within 150m radius",
      icon: Copy,
      color: "text-[#4B3C32]",
      border: "border-[#E8E4DC]",
      bg: "bg-white",
    },
    {
      title: "Missing Certificates",
      value: summary.missing_docs_count || 0,
      subtext: "Missing UC, CC, or geo-photo",
      icon: FileWarning,
      color: "text-[#E6A23C]",
      border: "border-[#E8E4DC]",
      bg: "bg-white",
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-2xl border ${card.border} ${card.bg} transition-all duration-200 hover:shadow-xs relative overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#5E5E5D] uppercase tracking-wider">
                {card.title}
              </span>
              <Icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-[#050505] tracking-tight">
              {card.value}
            </div>
            <p className="text-[10px] text-[#5E5E5D] font-medium mt-1 truncate">
              {card.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
}
