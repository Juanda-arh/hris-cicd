const variants = {
  uploaded: 'ok',
  received: 'ok',
  pending: 'warn',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${variants[status] ?? 'warn'}`}>{status}</span>;
}
