import client from './client';

// In-app notifications of the signed-in user (newest first)
export async function listNotifications({ limit = 50, offset = 0, unreadOnly = false } = {}) {
  const { data } = await client.get('/api/notificaciones', {
    params: { limite: limit, offset, ...(unreadOnly ? { soloNoLeidas: true } : {}) },
  });
  return data;
}

export async function markNotificationRead(id) {
  await client.patch(`/api/notificaciones/${id}/leida`);
  announceChange();
}

export async function markAllNotificationsRead() {
  await client.patch('/api/notificaciones/leidas');
  announceChange();
}

// The bell in the top bar listens to this to refresh its unread count
export const NOTIFICATIONS_CHANGED = 'hris:notifications-changed';

function announceChange() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
