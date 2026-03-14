async function loadDashboard() {
    try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) {
            window.location.href = '/auth.html';
            return;
        }

        const me = await meRes.json();
        const usernameEl = document.getElementById('username');
        const navLinks = document.getElementById('nav-links');

        if (usernameEl) usernameEl.textContent = me.username || me.email || 'User';
        if (navLinks) navLinks.style.display = 'flex';

        const dashRes = await fetch('/api/dashboard');
        if (!dashRes.ok) return;

        const data = await dashRes.json();
        const cards = Array.from(document.querySelectorAll('.card-grid .card p'));
        if (cards.length < 6) return;

        cards[0].textContent = '£' + Number(data.income || 0).toLocaleString();
        cards[1].textContent = '£' + Number(data.assets || 0).toLocaleString();
        cards[2].textContent = '£' + Number(data.liabilities || 0).toLocaleString();
        cards[3].textContent = String(data.protectionPolicies || 0) + ' policies';
        cards[4].textContent = String(data.estateCompleted || 0) + '/' + String(data.estateTotal || 0) + ' complete';
        cards[5].textContent = Number(data.intangibleAvg || 0).toFixed(1) + '/10';
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

loadDashboard();
