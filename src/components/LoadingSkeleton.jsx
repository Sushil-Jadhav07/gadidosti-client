import React from "react";

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-28 skeleton-shimmer animate-shimmer rounded" />
        <div className="h-6 w-20 skeleton-shimmer animate-shimmer rounded-full" />
      </div>
      <div className="h-5 w-40 skeleton-shimmer animate-shimmer rounded mb-3" />
      <div className="flex items-center gap-4 mb-3">
        <div className="h-4 w-24 skeleton-shimmer animate-shimmer rounded" />
        <div className="h-4 w-24 skeleton-shimmer animate-shimmer rounded" />
      </div>
      <div className="h-6 w-20 skeleton-shimmer animate-shimmer rounded" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="bg-white rounded-lg shadow-card p-3 min-w-[110px] flex-shrink-0">
      <div className="h-5 w-5 skeleton-shimmer animate-shimmer rounded mb-2" />
      <div className="h-7 w-10 skeleton-shimmer animate-shimmer rounded mb-1" />
      <div className="h-3 w-16 skeleton-shimmer animate-shimmer rounded" />
    </div>
  );
}

export default function LoadingSkeleton({ type = "card", count = 3 }) {
  if (type === "stat") {
    return (
      <div className="flex gap-3 px-4 -mt-2 overflow-x-auto no-scrollbar">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
