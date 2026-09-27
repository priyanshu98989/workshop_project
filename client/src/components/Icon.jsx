import React from 'react';

export default function Icon({
  paths,
  d,
  className = 'h-3.5 w-3.5',
  strokeWidth = 1.8,
  fill = 'none',
  fillRule,
  clipRule,
  viewBox = '0 0 24 24',
}) {
  const all = paths || (d ? [d] : []);
  if (all.length === 0) return null;
  return (
    <svg
      className={className}
      fill={fill}
      viewBox={viewBox}
      stroke={fill === 'none' ? 'currentColor' : undefined}
      strokeWidth={strokeWidth}
      aria-hidden="true"
    >
      {all.map((p, i) => (
        <path
          key={i}
          d={p}
          strokeLinecap={fill === 'none' ? 'round' : undefined}
          strokeLinejoin={fill === 'none' ? 'round' : undefined}
          fillRule={fillRule}
          clipRule={clipRule}
        />
      ))}
    </svg>
  );
}