const KEY = 'hris_token';

export function saveToken(token, remember) {
  clearToken();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(KEY, token);
}

export function getToken() {
  return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
}

export function clearToken() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

export function replaceToken(token) {
  const remembered = localStorage.getItem(KEY) !== null;
  saveToken(token, remembered);
}