function initMobileNav() {
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');

    if (!navToggle || !navLinks) return;

    navToggle.addEventListener('click', function () {
        const isOpen = navLinks.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', String(isOpen));
        navToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
            if (window.innerWidth <= 600) {
                navLinks.classList.remove('is-open');
                navToggle.setAttribute('aria-expanded', 'false');
                navToggle.setAttribute('aria-label', 'Open navigation menu');
            }
        });
    });
}

async function loadDashboard() {
    try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/welcome.html';
            return;
        }

        const me = await meRes.json();
        const currencyCode = me.preferred_currency || 'GBP';
        const usernameEl = document.getElementById('username');

        if (usernameEl) usernameEl.textContent = me.username || me.email || 'User';

        const dashRes = await fetch('/api/dashboard');
        if (!dashRes.ok) return;

        const data = await dashRes.json();
        const cards = Array.from(document.querySelectorAll('.card-grid .card p'));
        if (cards.length < 6) return;

        cards[0].textContent = currencyCode + ' ' + Number(data.income || 0).toLocaleString();
        cards[1].textContent = currencyCode + ' ' + Number(data.assets || 0).toLocaleString();
        cards[2].textContent = currencyCode + ' ' + Number(data.liabilities || 0).toLocaleString();
        cards[3].textContent = String(data.protectionPolicies || 0) + ' policies';
        cards[4].textContent = String(data.estateCompleted || 0) + '/' + String(data.estateTotal || 0) + ' complete';
        cards[5].textContent = Number(data.intangibleAvg || 0).toFixed(1) + '/10';
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

initMobileNav();
loadDashboard();
