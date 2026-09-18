import React from 'react';

export default function Icon({ paths, d, className = 'h-3.5 w-3.5', strokeWidth = 1.8 }) {
  const all = paths || (d ? [d] : []);
  if (all.length === 0) return null;
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      {all.map((p, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />
      ))}
    </svg>
  );
}