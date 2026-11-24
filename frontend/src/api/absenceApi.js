import client from './client';

// The logged-in leader's own employee record (only leaders and employees have one; the admin gets 403)
export async function getMyEmployee() {
  const { data } = await client.get('/api/empleados/me');
  return data;
}
