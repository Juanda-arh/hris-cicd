export default function ProgressCard({ done, total, verb, footLeft, accent = 'orange', loading }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress">
      <p className="eyebrow">Period progress</p>
      <div className={`card progress-card ${loading ? 'is-loading' : ''}`}>
        <p className="progress-card__value">
          <span className="progress-card__number">{loading ? '–' : done}</span>
          <span className="progress-card__of">
            of {total} {verb}
          </span>
        </p>
        <div className="progress-bar">
          <span
            className={`progress-bar__fill progress-bar__fill--${accent}`}
            style={{ width: `${done ? Math.max(pct, 3) : 0}%` }}
          />
        </div>
        <div className="progress-card__foot mono">
          <span>{footLeft}</span>
          <span>{total - done} pending</span>
        </div>
      </div>
    </div>
  );
}
