import client from './client';

export async function login(usuario, clave) {
  const { data } = await client.post('/api/auth/login', { usuario, clave });
  return data;
}

export async function verifyOtp(personaId, codigo) {
  const { data } = await client.post('/api/auth/verify-otp', { personaId, codigo });
  return data;
}

export async function changePassword(claveActual, claveNueva) {
  const { data } = await client.post('/api/auth/change-password', { claveActual, claveNueva });
  return data;
}

export async function forgotPassword(correo) {
  const { data } = await client.post('/api/auth/forgot-password', { correo });
  return data;
}

export async function resetPassword(correo, codigo, nuevaClave, confirmarClave) {
  const { data } = await client.post('/api/auth/reset-password', {
    correo,
    codigo,
    nuevaClave,
    confirmarClave,
  });
  return data;
}