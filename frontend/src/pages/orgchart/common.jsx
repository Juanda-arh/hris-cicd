export function LevelChip({ level }) {
  if (!level) return null;
  return <span className={`lvl lvl--${level.toLowerCase()}`}>{level}</span>;
}

export function FooterNote({ children }) {
  return <p className="ofw-footer">{children}</p>;
}
