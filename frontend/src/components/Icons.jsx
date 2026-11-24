const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const DownloadIcon = (p) => (
  <svg width="14" height="14" viewBox="0 0 16 16" {...base} {...p}><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" /></svg>
);
export const UploadIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 16 16" {...base} {...p}><path d="M8 13V3M4.5 6.5 8 3l3.5 3.5M3 14h10" /></svg>
);
export const BellIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...base} {...p}><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11ZM6.5 14a1.5 1.5 0 0 0 3 0" /></svg>
);
export const ReplaceIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...base} {...p}><path d="M13 6.5A5 5 0 0 0 3.6 5M3 9.5A5 5 0 0 0 12.4 11M3.5 2.5V5H6M12.5 13.5V11H10" /></svg>
);
export const MailIcon = (p) => (
  <svg width="14" height="14" viewBox="0 0 16 16" {...base} {...p}><rect x="2" y="3.5" width="12" height="9" rx="0.5" /><path d="m2.5 4 5.5 4.5L13.5 4" /></svg>
);
export const ChevronLeft = (p) => (
  <svg width="14" height="14" viewBox="0 0 16 16" {...base} strokeWidth="2" {...p}><path d="M10 3 5 8l5 5" /></svg>
);
export const ChevronRight = (p) => (
  <svg width="14" height="14" viewBox="0 0 16 16" {...base} strokeWidth="2" {...p}><path d="m6 3 5 5-5 5" /></svg>
);
export const MenuIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 20 20" {...base} {...p}><path d="M3 5.5h14M3 10h14M3 14.5h14" /></svg>
);
export const CloseIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 20 20" {...base} {...p}><path d="m5 5 10 10M15 5 5 15" /></svg>
);
