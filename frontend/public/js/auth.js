async function checkAuth() {
  try {
    return await api('/api/auth/me');
  } catch {
    return null;
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/pages/login.html';
}
