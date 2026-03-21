const liabilityCategories = [
    'Mortgage balances',
    'Student loans',
    'Credit card debt',
    'Personal loans & car finance',
    'Outstanding bills / overdrafts'
];

const supportedCurrencies = ['USD', 'GBP', 'EUR', 'INR', 'CAD', 'AUD', 'AED'];
const defaultRates = {
    USD: 1,
    GBP: 0.78,
    EUR: 0.92,
    INR: 83.2,
    CAD: 1.35,
    AUD: 1.52,
    AED: 3.67,
};
let selectedCurrency = 'USD';
let cachedLiabilityRows = [];
let cachedAssetTotal = 0;
let exchangeRates = { ...defaultRates };
let exchangeSource = 'fallback';
let exchangeUpdatedAt = null;

function rateFor(currencyCode) {
    const rate = Number(exchangeRates[currencyCode]);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function convertUsdToSelected(valueInUsd) {
    return Number(valueInUsd || 0) * rateFor(selectedCurrency);
}

function convertSelectedToUsd(valueInSelectedCurrency) {
    return Number(valueInSelectedCurrency || 0) / rateFor(selectedCurrency);
}

function formatCurrency(valueInUsd) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: selectedCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(convertUsdToSelected(valueInUsd));
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
            <td>${formatCurrency(row.balance)}</td>
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
        .map((category) => `<div class="category-chip"><strong>${escapeHtml(category)}</strong><span>${formatCurrency(totals[category])}</span></div>`)
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

async function fetchExchangeRates() {
    const response = await fetch('/api/exchange-rates');
    if (!response.ok) return;

    const payload = await response.json();
    if (!payload || !payload.rates) return;

    const nextRates = {};
    for (const code of supportedCurrencies) {
        const candidate = Number(payload.rates[code]);
        if (!Number.isFinite(candidate) || candidate <= 0) return;
        nextRates[code] = candidate;
    }

    exchangeRates = nextRates;
    exchangeSource = payload.source || 'live';
    exchangeUpdatedAt = payload.updatedAt || null;
}

function setMessage(message, isError = false) {
    const messageEl = document.getElementById('liability-message');
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.color = isError ? '#ff7a7a' : '#7be28c';
}

function updateBalanceLabel() {
    const balanceLabel = document.getElementById('balance-label');
    if (balanceLabel) balanceLabel.textContent = `Balance (${selectedCurrency})`;
}

function renderFxNote() {
    const fxNoteEl = document.getElementById('fx-note');
    if (!fxNoteEl) return;

    const parts = supportedCurrencies
        .filter(code => code !== 'USD')
        .map(code => `${code} ${rateFor(code).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`);

    const sourceText = exchangeSource === 'live' ? 'Live rates' : 'Fallback rates';
    const timeText = exchangeUpdatedAt ? ` at ${new Date(exchangeUpdatedAt).toLocaleTimeString()}` : '';
    fxNoteEl.textContent = `${sourceText}${timeText}: 1 USD = ${parts.join(' | ')}`;
}

function renderTotals() {
    const total = cachedLiabilityRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
    const totalLiabilitiesEl = document.getElementById('total-liabilities');
    const ratioEl = document.getElementById('debt-ratio');

    if (totalLiabilitiesEl) totalLiabilitiesEl.textContent = formatCurrency(total);

    const ratio = cachedAssetTotal > 0 ? (total / cachedAssetTotal) * 100 : 0;
    if (ratioEl) ratioEl.textContent = cachedAssetTotal > 0 ? formatPercent(ratio) : 'N/A';
}

function rerenderFromCache() {
    renderTotals();
    renderBreakdown(cachedLiabilityRows);
    renderRows(cachedLiabilityRows);
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
    cachedLiabilityRows = rows;
    cachedAssetTotal = Number(dashboard.assets || 0);
    rerenderFromCache();
}

async function initLiabilitiesPage() {
    try {
        const user = await requireUser();
        if (!user) return;

        const form = document.getElementById('liability-form');
        const tbody = document.getElementById('liability-rows');
        const currencySelect = document.getElementById('currency-select');

        if (currencySelect instanceof HTMLSelectElement) {
            const current = currencySelect.value;
            selectedCurrency = supportedCurrencies.includes(current) ? current : 'USD';
            currencySelect.addEventListener('change', () => {
                const next = currencySelect.value;
                selectedCurrency = supportedCurrencies.includes(next) ? next : 'USD';
                updateBalanceLabel();
                rerenderFromCache();
            });
        }

        await fetchExchangeRates();
        updateBalanceLabel();
        renderFxNote();

        await refreshLiabilities();

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                setMessage('Saving...');
                try {
                    const formData = Object.fromEntries(new FormData(form).entries());
                    formData.balance = String(convertSelectedToUsd(formData.balance));
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
