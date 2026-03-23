function setActiveAuthTab(target) {
    const safeTarget = target === 'signup' ? 'signup' : 'login';
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === safeTarget));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + safeTarget));
}

const initialTab = new URLSearchParams(window.location.search).get('tab');
setActiveAuthTab(initialTab);

document.querySelectorAll('.auth-tab, [data-switch]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.dataset.tab || el.dataset.switch;
        setActiveAuthTab(target);
    });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    const body = new URLSearchParams(new FormData(e.target)).toString();
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await res.json();
    if (data.success) { window.location.href = '/dashboard.html'; }
    else { errEl.textContent = data.error; errEl.style.display = 'block'; }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('signup-error');
    errEl.style.display = 'none';
    const body = new URLSearchParams(new FormData(e.target)).toString();
    const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await res.json();
    if (data.success) { window.location.href = '/auth.html'; }
    else { errEl.textContent = data.error; errEl.style.display = 'block'; }
});
