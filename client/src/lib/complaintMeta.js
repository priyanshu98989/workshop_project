export const categoryMeta = {
  pothole: {
    label: 'Pothole',
    icon: ['M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10z'],
    color: 'bg-amber-500/20 text-amber-300',
  },
  garbage: {
    label: 'Garbage',
    icon: ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6', 'M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2', 'M10 11v6', 'M14 11v6'],
    color: 'bg-lime-500/20 text-lime-300',
  },
  'water leakage': {
    label: 'Water Leakage',
    icon: ['M12 2.69l5.66 5.66a8 8 0 11-11.31 0z'],
    color: 'bg-cyan-500/20 text-cyan-300',
  },
  'broken streetlight': {
    label: 'Broken Light',
    icon: ['M9.663 17h4.673', 'M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'],
    color: 'bg-yellow-500/20 text-yellow-300',
  },
  'road obstruction': {
    label: 'Obstruction',
    icon: ['M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'],
    color: 'bg-orange-500/20 text-orange-300',
  },
  'drainage blockage': {
    label: 'Drainage Block',
    icon: ['M12 6v12', 'M17 13l-5 5-5-5', 'M5 21h14'],
    color: 'bg-blue-500/20 text-blue-300',
  },
  other: {
    label: 'Other',
    icon: ['M6 5a2 2 0 012-2h8a2 2 0 012 2v14l-6-4-6 4V5z'],
    color: 'bg-purple-500/20 text-purple-300',
  },
};

export const DEFAULT_CATEGORY = categoryMeta.other;

export const severityMeta = {
  high: { label: 'High', color: 'bg-red-500/20 text-red-300' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  low: { label: 'Low', color: 'bg-emerald-500/20 text-emerald-300' },
};

export const priorityMeta = {
  critical: { label: 'Critical', color: 'bg-purple-500/20 text-purple-300' },
  high: { label: 'High', color: 'bg-red-500/20 text-red-300' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  low: { label: 'Low', color: 'bg-emerald-500/20 text-emerald-300' },
};

export const DEFAULT_PRIORITY = 'medium';

export const PRIORITY_FILTERS = ['critical', 'high', 'medium', 'low'];

export const statusColor = {
  Pending: 'bg-slate-700/50 text-slate-200',
  Acknowledged: 'bg-blue-500/20 text-blue-300',
  'In Progress': 'bg-amber-500/20 text-amber-300',
  Resolved: 'bg-emerald-500/20 text-emerald-300',
};

export const DEFAULT_STATUS_COLOR = statusColor.Pending;

export const STATUS_FILTERS = ['Pending', 'Acknowledged', 'In Progress', 'Resolved'];
