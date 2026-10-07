import React from 'react';

export function CardSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="gov-card p-5 animate-pulse space-y-3">
          <div className="h-3 bg-[#E8E4DC] rounded-full w-2/3" />
          <div className="h-7 bg-[#E8E4DC] rounded-lg w-1/2" />
          <div className="h-2.5 bg-[#E8E4DC]/60 rounded-full w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="gov-card p-6 animate-pulse space-y-4">
      <div className="h-4 bg-[#E8E4DC] rounded-full w-1/4 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b border-[#E8E4DC]/50">
          <div className="h-3 bg-[#E8E4DC] rounded-full w-16" />
          <div className="h-3 bg-[#E8E4DC] rounded-full w-48" />
          <div className="h-3 bg-[#E8E4DC] rounded-full w-24" />
          <div className="h-3 bg-[#E8E4DC] rounded-full w-16" />
          <div className="h-3 bg-[#E8E4DC] rounded-full w-20" />
        </div>
      ))}
    </div>
  );
}
