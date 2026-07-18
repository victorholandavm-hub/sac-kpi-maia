export function StoreIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" style={{ color }}>
      <path
        d="M4 10.5V19a1 1 0 0 0 1 1h5v-5h4v5h5a1 1 0 0 0 1-1v-8.5M3 10l1.5-5.5A1 1 0 0 1 5.46 3.5h13.08a1 1 0 0 1 .96 1L21 10M3 10a2 2 0 0 0 4 0M7 10a2 2 0 0 0 4 0M11 10a2 2 0 0 0 4 0M15 10a2 2 0 0 0 4 0M19 10a2 2 0 0 0 2 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WrenchIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" style={{ color }}>
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 4.6L3 17.2V21h3.8l6.3-6.3a4 4 0 0 0 4.6-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HardHatIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" style={{ color }}>
      <path
        d="M4 16.5h16M4.5 16.5C4.5 11 8 7 12 7s7.5 4 8 9.5M12 7V4.5M9.5 16.5V13a2.5 2.5 0 0 1 5 0v3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
