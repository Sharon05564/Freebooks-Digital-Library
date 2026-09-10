// Shared helpers used across every page: HTML escaping, navbar state, and logout.
// Previously this logic was copy-pasted (and had drifted slightly) into an inline
// <script> block on nearly every page - kept here once instead.

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (error) {
        return null;
    }
}

function updateNavbar() {
    const user = getStoredUser();
    const userNav = document.getElementById('userNav');
    const savedItems = document.getElementById('savedItems');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginButton = document.getElementById('loginButton');

    if (userNav) {
        userNav.innerHTML = user ? `<a href="/profile.html">${escapeHtml(user.username)}</a>` : '';
    }
    if (savedItems) savedItems.style.display = user ? 'inline' : 'none';
    if (logoutBtn) logoutBtn.style.display = user ? 'inline' : 'none';
    if (loginButton) loginButton.style.display = user ? 'none' : 'inline';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'jwt=; Max-Age=0; path=/';
    window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            logout();
        });
    }
});
