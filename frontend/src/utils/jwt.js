import { jwtDecode } from 'jwt-decode';

export function decodeToken(token) {
  try {
    const payload = jwtDecode(token);
    const expired = payload.exp ? payload.exp * 1000 < Date.now() : false;
    return expired ? null : payload;
  } catch {
    return null;
  }
}