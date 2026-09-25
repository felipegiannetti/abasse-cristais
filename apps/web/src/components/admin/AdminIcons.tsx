import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'h-5 w-5',
  ...p,
});

export const IconDashboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7.5" height="9" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
    <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" />
    <rect x="3" y="15" width="7.5" height="6" rx="2" />
  </svg>
);
export const IconGem = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M12 21 8 9l4-6 4 6-4 12z" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconKey = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="14" r="4" />
    <path d="m11 11 9-9M17 5l3 3M14 8l2 2" />
  </svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconLogout = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h11" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8L12 3z" />
  </svg>
);
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="m21 16-5-5-8 8" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
export const IconEdit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
  </svg>
);
export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
  </svg>
);
export const IconList = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="10" width="16" height="10" rx="3" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.2-4 4.2-6 8-6s6.8 2 8 6" />
  </svg>
);
export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.6" />
    <path d="M2.5 20c.9-3.6 3.4-5.4 6.5-5.4s5.6 1.8 6.5 5.4M16 4.6a3.6 3.6 0 0 1 0 6.8M18 14.9c1.9.6 3.2 2.3 3.6 5.1" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 5 6v6c0 4.4 2.9 7.8 7 9 4.1-1.2 7-4.6 7-9V6l-7-3z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);
export const IconCart = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
    <circle cx="9.5" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V4M4 20h16" />
    <path d="m7.5 15 3.5-4.5 3 2.5 4.5-6" />
  </svg>
);
export const IconTruck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z" />
    <circle cx="7" cy="17.5" r="1.7" />
    <circle cx="17" cy="17.5" r="1.7" />
  </svg>
);
export const IconContact = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10.5" r="2.4" />
    <path d="M5.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3M15 9h3.5M15 12.5h3.5" />
  </svg>
);
