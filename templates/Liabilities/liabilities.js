const liabilityCategories = [
    'Mortgage balances',
    'Student loans',
    'Credit card debt',
    'Personal loans & car finance',
    'Outstanding bills / overdrafts'
];

function formatGBP(value) {
    return '\u00A3' + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
    return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function requireUser() {
    const response = await fetch('/api/me');
    if (!response.ok) {
        window.location.href = '/auth.html';
        return null;
    }

    const me = await response.json();
    const usernameEl = document.getElementById('username');
    const navLinks = document.getElementById('nav-links');

    if (usernameEl) usernameEl.textContent = me.username || me.email || 'User';
    if (navLinks) navLinks.style.display = 'flex';
    return me;
}

function renderRows(rows) {
    const body = document.getElementById('liability-rows');
    if (!body) return;

    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">No liabilities added yet.</td></tr>';
        return;
    }

    body.innerHTML = rows.map((row) => {
        const interest = row.interest_rate == null || row.interest_rate === '' ? '-' : `${Number(row.interest_rate).toFixed(2)}%`;
        return `<tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.description)}</td>
            <td>${formatGBP(row.balance)}</td>
            <td>${interest}</td>
            <td><button class="action-btn" data-id="${Number(row.id)}">Delete</button></td>
        </tr>`;
    }).join('');
}

function renderBreakdown(rows) {
    const breakdownEl = document.getElementById('liability-breakdown');
    if (!breakdownEl) return;

    const totals = liabilityCategories.reduce((acc, item) => {
        acc[item] = 0;
        return acc;
    }, {});

    for (const row of rows) {
        const key = liabilityCategories.includes(row.category) ? row.category : 'Outstanding bills / overdrafts';
        totals[key] += Number(row.balance || 0);
    }

    breakdownEl.innerHTML = liabilityCategories
        .map((category) => `<div class="category-chip"><strong>${escapeHtml(category)}</strong><span>${formatGBP(totals[category])}</span></div>`)
        .join('');
}

async function fetchLiabilities() {
    const response = await fetch('/api/liabilities');
    if (!response.ok) throw new Error('Failed to fetch liabilities');
    return response.json();
}

async function fetchDashboardTotals() {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
        return { assets: 0, liabilities: 0 };
    }
    return response.json();
}

function setMessage(message, isError = false) {
    const messageEl = document.getElementById('liability-message');
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.color = isError ? '#ff7a7a' : '#7be28c';
}

async function createLiability(formData) {
    const response = await fetch('/api/liabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData)
    });
    if (!response.ok) throw new Error('Failed to save liability');
}

async function deleteLiability(id) {
    const response = await fetch(`/api/liabilities/${id}/delete`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to delete liability');
}

async function refreshLiabilities() {
    const [rows, dashboard] = await Promise.all([fetchLiabilities(), fetchDashboardTotals()]);
    const total = rows.reduce((sum, row) => sum + Number(row.balance || 0), 0);

    const totalLiabilitiesEl = document.getElementById('total-liabilities');
    const ratioEl = document.getElementById('debt-ratio');

    if (totalLiabilitiesEl) totalLiabilitiesEl.textContent = formatGBP(total);

    const assetsTotal = Number(dashboard.assets || 0);
    const ratio = assetsTotal > 0 ? (total / assetsTotal) * 100 : 0;
    if (ratioEl) ratioEl.textContent = assetsTotal > 0 ? formatPercent(ratio) : 'N/A';

    renderBreakdown(rows);
    renderRows(rows);
}

async function initLiabilitiesPage() {
    try {
        const user = await requireUser();
        if (!user) return;

        const form = document.getElementById('liability-form');
        const tbody = document.getElementById('liability-rows');

        await refreshLiabilities();

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                setMessage('Saving...');
                try {
                    const formData = Object.fromEntries(new FormData(form).entries());
                    await createLiability(formData);
                    form.reset();
                    await refreshLiabilities();
                    setMessage('Liability added successfully.');
                } catch (err) {
                    console.error(err);
                    setMessage('Could not add liability. Try again.', true);
                }
            });
        }

        if (tbody) {
            tbody.addEventListener('click', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                if (!target.matches('.action-btn')) return;

                const id = Number(target.getAttribute('data-id'));
                if (!id) return;

                try {
                    await deleteLiability(id);
                    await refreshLiabilities();
                    setMessage('Liability removed.');
                } catch (err) {
                    console.error(err);
                    setMessage('Could not delete liability.', true);
                }
            });
        }
    } catch (err) {
        console.error('Failed to initialize liabilities page:', err);
        setMessage('Could not load liabilities right now.', true);
    }
}

initLiabilitiesPage();
