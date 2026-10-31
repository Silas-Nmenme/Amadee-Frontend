import { loadIdentity, routeAuthCallback } from './identity.js';

export async function initAuth() {
  if (routeAuthCallback()) return;
  const button = document.getElementById('open-auth');
  button.href = '/signin.html';
  try {
    const { getUser } = await loadIdentity();
    const user = await getUser();
    if (user) button.textContent = 'My account';
  } catch {
    // The account link remains usable if the authentication service is unavailable.
  }
}
