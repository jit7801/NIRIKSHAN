import React from 'react';

export default function RiskBadge({ score, level, size = 'sm' }) {
  const normLevel = (level || '').toUpperCase();

  let text = 'Low';
  let colorClass = 'text-[#2E8B57] bg-[#EEF7F2] border-[#D1E8DC]';

  if (normLevel === 'CRITICAL' || score >= 80) {
    text = 'Critical';
    colorClass = 'text-[#C94C4C] bg-[#FDF2F2] border-[#F8D2D2]';
  } else if (normLevel === 'HIGH' || score >= 60) {
    text = 'High';
    colorClass = 'text-[#C94C4C] bg-[#FDF4F4] border-[#FADCDA]';
  } else if (normLevel === 'MEDIUM' || score >= 30) {
    text = 'Medium';
    colorClass = 'text-[#B87D28] bg-[#FEF8ED] border-[#F8E5C4]';
  }

  const padding = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${padding} ${colorClass} whitespace-nowrap`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{text}</span>
      {score !== undefined && score !== null && (
        <span className="font-semibold opacity-90">· {score}</span>
      )}
    </span>
  );
}
