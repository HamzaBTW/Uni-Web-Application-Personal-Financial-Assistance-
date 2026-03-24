const categories = [
    'Cash & savings',
    'Investments',
    'Property',
    'Vehicles',
    'Valuables'
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
let cachedAssetRows = [];
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

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

async function requireUser() {
    const response = await fetch('/api/me');
    if (!response.ok) {
        window.location.href = '/auth.html';
        return null;
    }

    const me = await response.json();
    const usernameEl = document.getElementById('username');
    if (usernameEl) usernameEl.textContent = me.username || me.email || 'User';
    return me;
}

function renderCategoryBreakdown(rows) {
    const breakdownEl = document.getElementById('category-breakdown');
    if (!breakdownEl) return;

    const totalsByCategory = categories.reduce((acc, category) => {
        acc[category] = 0;
        return acc;
    }, {});

    for (const row of rows) {
        const key = categories.includes(row.category) ? row.category : 'Valuables';
        totalsByCategory[key] += Number(row.value || 0);
    }

    breakdownEl.innerHTML = categories
        .map((category) => `<div class="category-chip"><strong>${escapeHtml(category)}</strong><span>${formatCurrency(totalsByCategory[category])}</span></div>`)
        .join('');
}

function renderRows(rows) {
    const body = document.getElementById('asset-rows');
    if (!body) return;

    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4" class="empty">No assets added yet.</td></tr>';
        return;
    }

    body.innerHTML = rows.map((row) => {
        return `<tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.description)}</td>
            <td>${formatCurrency(row.value)}</td>
            <td><button class="action-btn" data-id="${Number(row.id)}">Delete</button></td>
        </tr>`;
    }).join('');
}

function renderTotals(rows) {
    const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    const totalAssetsEl = document.getElementById('total-assets');
    const countEl = document.getElementById('asset-count');

    if (totalAssetsEl) totalAssetsEl.textContent = formatCurrency(total);
    if (countEl) countEl.textContent = String(rows.length);
}

function updateValueLabel() {
    const valueLabel = document.getElementById('value-label');
    if (valueLabel) valueLabel.textContent = `Value (${selectedCurrency})`;
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

function rerenderFromCache() {
    renderTotals(cachedAssetRows);
    renderCategoryBreakdown(cachedAssetRows);
    renderRows(cachedAssetRows);
}

async function fetchAssets() {
    const response = await fetch('/api/assets');
    if (!response.ok) throw new Error('Failed to fetch assets');
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

async function refreshAssets() {
    cachedAssetRows = await fetchAssets();
    rerenderFromCache();
}

async function createAsset(formData) {
    const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData)
    });
    if (!response.ok) throw new Error('Failed to save asset');
}

async function deleteAsset(id) {
    const response = await fetch(`/api/assets/${id}/delete`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to delete asset');
}

function setMessage(message, isError = false) {
    const messageEl = document.getElementById('asset-message');
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.color = isError ? '#ff7a7a' : '#7be28c';
}

async function initAssetsPage() {
    try {
        const user = await requireUser();
        if (!user) return;

        const form = document.getElementById('asset-form');
        const tbody = document.getElementById('asset-rows');
        const currencySelect = document.getElementById('currency-select');

        if (currencySelect instanceof HTMLSelectElement) {
            const current = currencySelect.value;
            selectedCurrency = supportedCurrencies.includes(current) ? current : 'USD';
            currencySelect.addEventListener('change', () => {
                const next = currencySelect.value;
                selectedCurrency = supportedCurrencies.includes(next) ? next : 'USD';
                updateValueLabel();
                rerenderFromCache();
            });
        }

        await fetchExchangeRates();
        updateValueLabel();
        renderFxNote();

        await refreshAssets();

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                setMessage('Saving...');
                try {
                    const formData = Object.fromEntries(new FormData(form).entries());
                    formData.value = String(convertSelectedToUsd(formData.value));
                    await createAsset(formData);
                    form.reset();
                    await refreshAssets();
                    setMessage('Asset added successfully.');
                } catch (err) {
                    console.error(err);
                    setMessage('Could not add asset. Try again.', true);
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
                    await deleteAsset(id);
                    await refreshAssets();
                    setMessage('Asset removed.');
                } catch (err) {
                    console.error(err);
                    setMessage('Could not delete asset.', true);
                }
            });
        }
    } catch (err) {
        console.error('Failed to initialize assets page:', err);
        setMessage('Could not load assets right now.', true);
    }
}

initMobileNav();
initAssetsPage();
