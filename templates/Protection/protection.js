// ─── XSS Helper ───
function esc(str) {
    if (str == null) return '—';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML || '—';
}

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
let selectedCurrency = 'GBP';
let cachedPolicies = [];
let exchangeRates = { ...defaultRates };
let exchangeSource = 'fallback';
let exchangeUpdatedAt = null;

function rateFor(currencyCode) {
    const rate = Number(exchangeRates[currencyCode]);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function convertGbpToSelected(valueInGbp) {
    const valueInUsd = Number(valueInGbp || 0) / rateFor('GBP');
    return valueInUsd * rateFor(selectedCurrency);
}

function convertSelectedToGbp(valueInSelectedCurrency) {
    const valueInUsd = Number(valueInSelectedCurrency || 0) / rateFor(selectedCurrency);
    return valueInUsd * rateFor('GBP');
}

function formatCurrencyFromGbp(valueInGbp) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: selectedCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(convertGbpToSelected(valueInGbp));
}

function updatePremiumLabel() {
    const premiumLabel = document.getElementById('premium-label');
    if (premiumLabel) premiumLabel.textContent = `Annual Premium (${selectedCurrency})`;
}

function renderFxNote() {
    const fxNoteEl = document.getElementById('fx-note');
    if (!fxNoteEl) return;

    const parts = supportedCurrencies
        .filter(code => code !== 'GBP')
        .map(code => {
            const amount = rateFor(code) / rateFor('GBP');
            return `${code} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
        });

    const sourceText = exchangeSource === 'live' ? 'Live rates' : 'Fallback rates';
    const timeText = exchangeUpdatedAt ? ` at ${new Date(exchangeUpdatedAt).toLocaleTimeString()}` : '';
    fxNoteEl.textContent = `${sourceText}${timeText}: 1 GBP = ${parts.join(' | ')}`;
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

(async () => {
    // ─── Auth guard ───
    const me = await fetch('/api/me').then(r => r.json()).catch(() => null);
    if (!me || me.error) return window.location.href = '/auth.html';
    initMobileNav();

    const formPanel  = document.getElementById('form-panel');
    const formTitle  = document.getElementById('form-title');
    const form       = document.getElementById('policy-form');
    const editIdEl   = document.getElementById('edit-id');
    const tableEl    = document.getElementById('data-table');
    const tbodyEl    = document.getElementById('table-body');
    const emptyEl    = document.getElementById('empty-state');
    const currencySelect = document.getElementById('currency-select');
    const startDateEl = document.getElementById('start_date');
    const renewalDateEl = document.getElementById('renewal_date');
    const MAX_DATE = '2080-12-31';

    startDateEl.max = MAX_DATE;
    renewalDateEl.max = MAX_DATE;

    function isDateWithinLimit(v) {
        if (!v) return true;
        return /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= MAX_DATE;
    }

    function openForm(policy) {
        formPanel.classList.add('open');
        if (policy) {
            formTitle.textContent = 'Edit Policy';
            editIdEl.value = policy.id;
            document.getElementById('policy_type').value   = policy.policy_type || '';
            document.getElementById('provider').value      = policy.provider || '';
            document.getElementById('premium').value       = policy.premium == null || policy.premium === '' ? '' : convertGbpToSelected(policy.premium).toFixed(2);
            document.getElementById('start_date').value    = policy.start_date || '';
            document.getElementById('renewal_date').value  = policy.renewal_date || '';
        } else {
            formTitle.textContent = 'Add Policy';
            editIdEl.value = '';
            form.reset();
        }
    }

    function closeForm() { formPanel.classList.remove('open'); form.reset(); editIdEl.value = ''; }

    function renderRows(rows) {
        tbodyEl.innerHTML = '';
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${esc(r.policy_type)}</td>
                <td>${esc(r.provider)}</td>
                <td>${r.premium != null && r.premium !== '' ? formatCurrencyFromGbp(r.premium) : '—'}</td>
                <td>${esc(r.start_date)}</td>
                <td>${esc(r.renewal_date)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-ghost edit-btn">Edit</button>
                    <button class="btn btn-sm btn-danger del-btn">Delete</button>
                </td>`;
            tr.querySelector('.edit-btn').addEventListener('click', () => openForm(r));
            tr.querySelector('.del-btn').addEventListener('click', async () => {
                if (!confirm('Delete this policy?')) return;
                await fetch(`/api/protection/${r.id}/delete`, { method: 'POST' });
                loadData();
            });
            tbodyEl.appendChild(tr);
        });
    }

    function rerenderFromCache() {
        if (cachedPolicies.length === 0) {
            tableEl.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';
        tableEl.style.display = 'table';
        renderRows(cachedPolicies);
    }

    async function loadData() {
        const rows = await fetch('/api/protection').then(r => r.json());
        cachedPolicies = rows;
        rerenderFromCache();
    }

    document.getElementById('add-btn').addEventListener('click', () => openForm(null));
    document.getElementById('empty-add-btn').addEventListener('click', () => openForm(null));
    document.getElementById('cancel-btn').addEventListener('click', closeForm);

    if (currencySelect instanceof HTMLSelectElement) {
        const current = currencySelect.value;
        selectedCurrency = supportedCurrencies.includes(current) ? current : 'GBP';
        currencySelect.addEventListener('change', () => {
            const next = currencySelect.value;
            selectedCurrency = supportedCurrencies.includes(next) ? next : 'GBP';
            updatePremiumLabel();
            rerenderFromCache();
        });
    }

    await fetchExchangeRates();
    updatePremiumLabel();
    renderFxNote();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isDateWithinLimit(startDateEl.value) || !isDateWithinLimit(renewalDateEl.value)) {
            alert('Dates must be valid and not beyond 2080-12-31.');
            return;
        }
        const formData = new FormData(form);
        const premiumValue = formData.get('premium');
        if (typeof premiumValue === 'string' && premiumValue !== '') {
            formData.set('premium', String(convertSelectedToGbp(premiumValue)));
        }
        const body = new URLSearchParams(formData).toString();
        const id = editIdEl.value;
        const url = id ? `/api/protection/${id}/edit` : '/api/protection';
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        closeForm();
        loadData();
    });

    loadData();
})();
