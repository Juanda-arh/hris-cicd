// What each notification type means for the person who receives it: its icon, colour, a short
// label and the button that takes them to what it is about. The route depends on the role
// (an admin reviews requests in /requests, a leader in /team-requests).

const REVIEW_REQUESTS = { admin: '/requests', lider: '/team-requests' };
const TEAM = { admin: '/people', lider: '/my-team' };

const TYPES = {
  // Time off — for whoever reviews it
  PERMISO_SOLICITADO: { group: 'Time off', icon: 'clock', tone: 'action', needsAction: true, action: (role) => REVIEW_REQUESTS[role] && { label: 'Review request', to: REVIEW_REQUESTS[role] } },
  SOPORTE_SUBIDO: { group: 'Time off', icon: 'doc', tone: 'action', needsAction: true, action: (role) => REVIEW_REQUESTS[role] && { label: 'Review support', to: REVIEW_REQUESTS[role] } },
  PERMISO_CANCELADO: { group: 'Time off', icon: 'cancel', tone: 'neutral', action: (role) => REVIEW_REQUESTS[role] && { label: 'View requests', to: REVIEW_REQUESTS[role] } },
  // Time off — for whoever asked for it
  PERMISO_ENVIADO: { group: 'Time off', icon: 'clock', tone: 'pending', action: () => ({ label: 'View request', to: '/time-off' }) },
  SOPORTE_SOLICITADO: { group: 'Time off', icon: 'upload', tone: 'action', needsAction: true, action: () => ({ label: 'Upload support', to: '/time-off' }) },
  PERMISO_APROBADO: { group: 'Time off', icon: 'check', tone: 'ok', action: () => ({ label: 'View request', to: '/time-off' }) },
  PERMISO_RECHAZADO: { group: 'Time off', icon: 'x', tone: 'bad', action: () => ({ label: 'See why', to: '/time-off' }) },
  // Employment certificates
  CERTIFICADO_SOLICITADO: { group: 'Certificates', icon: 'doc', tone: 'action', needsAction: true, action: (role) => role === 'admin' && { label: 'Review request', to: '/certificates' } },
  CERTIFICADO_CANCELADO: { group: 'Certificates', icon: 'cancel', tone: 'neutral', action: (role) => role === 'admin' && { label: 'View requests', to: '/certificates' } },
  CERTIFICADO_ENVIADO: { group: 'Certificates', icon: 'clock', tone: 'pending', action: () => ({ label: 'View request', to: '/my-certificates' }) },
  CERTIFICADO_APROBADO: { group: 'Certificates', icon: 'check', tone: 'ok', action: () => ({ label: 'Download certificate', to: '/my-certificates' }) },
  CERTIFICADO_RECHAZADO: { group: 'Certificates', icon: 'x', tone: 'bad', action: () => ({ label: 'See why', to: '/my-certificates' }) },
  // Birthdays
  CUMPLEANOS: { group: 'Birthday', icon: 'cake', tone: 'party', action: () => null },
  CUMPLEANOS_EQUIPO: { group: 'Birthday', icon: 'cake', tone: 'party', action: (role) => TEAM[role] && { label: role === 'admin' ? 'View people' : 'View my team', to: TEAM[role] } },
};

const FALLBACK = { group: 'Update', icon: 'bell', tone: 'neutral', action: () => null };

export function describeNotification(notification, role) {
  const type = TYPES[notification.tipo] || FALLBACK;
  return {
    group: type.group,
    icon: type.icon,
    tone: type.tone,
    needsAction: Boolean(type.needsAction),
    action: type.action(role) || null,
  };
}

// "Oct 27 · 09:42" (time in the person's own timezone)
export function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}
