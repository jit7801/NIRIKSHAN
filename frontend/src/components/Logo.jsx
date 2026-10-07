import React from 'react';

export default function Logo({ 
  size = 'md', 
  collapsed = false, 
  theme = 'light',
  className = '' 
}) {
  const sizeMap = {
    sm: { box: 'w-7 h-7', img: 'w-7 h-7', text: 'text-xs', sub: 'text-[10px]' },
    md: { box: 'w-8 h-8', img: 'w-8 h-8', text: 'text-[13px]', sub: 'text-[11px]' },
    lg: { box: 'w-10 h-10', img: 'w-10 h-10', text: 'text-base', sub: 'text-xs' },
    xl: { box: 'w-14 h-14', img: 'w-14 h-14', text: 'text-lg', sub: 'text-xs' },
  };

  const config = sizeMap[size] || sizeMap.md;
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Emblem Icon with Glow & Border */}
      <div 
        className={`${config.box} rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative shadow-xs transition-transform duration-200 hover:scale-105 border ${
          isDark ? 'border-amber-500/30 shadow-amber-500/10' : 'border-[#E8E4DC]'
        }`}
      >
        <img 
          src="/logo.png" 
          alt="NIRIKSHAN MPLADS Risk Intelligence Emblem" 
          className={`${config.img} object-cover rounded-xl`}
          onError={(e) => {
            // Graceful fallback to SVG if PNG is unavailable
            e.target.onerror = null;
            e.target.src = '/favicon.svg';
          }}
        />
      </div>

      {/* Typography Lockup */}
      {!collapsed && (
        <div className="overflow-hidden leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold tracking-tight truncate ${config.text} ${
              isDark ? 'text-white' : 'text-[#050505]'
            }`}>
              NIRIKSHAN
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F2F0EB] text-[#4B3C32] border border-[#E8E4DC]">
              AI
            </span>
          </div>
          <p className={`font-normal truncate ${config.sub} ${
            isDark ? 'text-stone-400' : 'text-[#5E5E5D]'
          }`}>
            MPLADS Monitoring
          </p>
        </div>
      )}
    </div>
  );
}
