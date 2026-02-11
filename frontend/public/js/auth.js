async function checkAuth() {
  try {
    return await api('/api/auth/me');
  } catch {
    window.location.href = '/pages/login.html';
    return null;
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/pages/login.html';
}
