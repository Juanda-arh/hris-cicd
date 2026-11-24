import client from './client';

// The reports are always "as of today" and count only employees who are not inactive (admin only)

export async function getOrganizationSize() {
  const { data } = await client.get('/api/reportes/tamano-organizacion');
  return data;
}

export async function getSizeByArea() {
  const { data } = await client.get('/api/reportes/tamano-organizacion/por-area');
  return data;
}

export async function getTeamSizeByLeader() {
  const { data } = await client.get('/api/reportes/tamano-organizacion/por-lider');
  return data;
}
