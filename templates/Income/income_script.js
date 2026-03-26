/**
 * Ensures the current user is authenticated and updates the UI with user info.
 *
 * If the server indicates the user is not authenticated, navigates the browser to `/auth.html` and returns `null`.
 * When authenticated, sets the `#username` element's text to the user's `username` or `email` (or `'User'` if both are absent)
 * and makes `#nav-links` visible, then returns the parsed user object.
 *
 * @returns {Object|null} The authenticated user object parsed from the response, or `null` if redirected due to lack of authentication.
 */
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

/**
 * Retrieve the authenticated user's income entries from the API.
 * @returns {Array<Object>} The parsed JSON array of income entries.
 * @throws {Error} If the API response is not OK.
 */
async function fetchIncome() {
    const response = await fetch('/api/income');
    if (!response.ok) throw new Error('Failed to fetch income');
    return response.json();
}

/**
 * Create a new income entry via the backend API.
 * @param {Object} incomeData - Form data for the income entry (e.g., { source, amount, currency, frequency, tax_band, description }).
 * @returns {Object} The saved income entry as returned by the API.
 * @throws {Error} If the server responds with a non-OK status (`'Failed to save income'`).
 */
async function saveIncome(incomeData) {
    const response = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(incomeData)
    });
    if (!response.ok) throw new Error('Failed to save income');
    return response.json();
}

/**
 * Delete an income entry on the server by its ID.
 * @param {number} id - The ID of the income entry to delete.
 * @throws {Error} If the server responds with a non-OK status.
 */
async function deleteIncome(id) {
    const response = await fetch(`/api/income/${id}/delete`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to delete income');
}

// Chart instances
let incomeChartInstance = null;
let taxChartInstance = null;
let currencyChartInstance = null;
let taxRateChartInstance = null;

// Color palette for charts
const chartColors = {
    primary: '#667eea',
    secondary: '#764ba2',
    success: '#48bb78',
    danger: '#ff6b6b',
    warning: '#fbbf24',
    info: '#3b82f6',
    lightBlue: '#93c5fd',
    lightPurple: '#d8b4fe',
    lightGreen: '#86efac',
    lightRed: '#fca5a5'
};

const colorPalette = [
    '#667eea', '#764ba2', '#48bb78', '#ff6b6b', '#fbbf24',
    '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6'
];

// Tax rates for different countries (simplified progressive tax brackets)
const taxBrackets = {
    USD: [
        { limit: 11000, rate: 0.10 },
        { limit: 44725, rate: 0.12 },
        { limit: 95375, rate: 0.22 },
        { limit: 182100, rate: 0.24 },
        { limit: 231250, rate: 0.32 },
        { limit: 578125, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ],
    EUR: [
        { limit: 20000, rate: 0.19 },
        { limit: 50000, rate: 0.42 },
        { limit: Infinity, rate: 0.45 }
    ],
    GBP: [
        { limit: 12570, rate: 0 },
        { limit: 50270, rate: 0.20 },
        { limit: 125140, rate: 0.40 },
        { limit: Infinity, rate: 0.45 }
    ],
    CAD: [
        { limit: 55867, rate: 0.15 },
        { limit: 111733, rate: 0.205 },
        { limit: 173205, rate: 0.26 },
        { limit: 246752, rate: 0.29 },
        { limit: Infinity, rate: 0.33 }
    ],
    AUD: [
        { limit: 18200, rate: 0 },
        { limit: 45000, rate: 0.19 },
        { limit: 120000, rate: 0.325 },
        { limit: 180000, rate: 0.37 },
        { limit: Infinity, rate: 0.45 }
    ],
    INR: [
        { limit: 250000, rate: 0 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 }
    ],
    AED: [
        { limit: Infinity, rate: 0 }
    ]
};

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'AED'];
const DEFAULT_RATES = {
    USD: 1,
    GBP: 0.78,
    EUR: 0.92,
    INR: 83.2,
    CAD: 1.35,
    AUD: 1.52,
    AED: 3.67
};

// Exchange rates follow the same server-backed system used by the Assets page.
let exchangeRates = { ...DEFAULT_RATES };
let exchangeRatesAsOf = null;
let exchangeRateSource = 'fallback';

let incomeEntries = [];
let displayCurrency = 'USD'; // Current currency to display all values in

/**
 * Escape HTML special characters to prevent XSS attacks.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped text safe for HTML insertion.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Build a complete rates object for supported currencies.
 * @param {Object} sourceRates - Raw rates object keyed by currency code.
 * @returns {Object|null} Normalized rates map or null when required currencies are missing/invalid.
 */
function normalizeRates(sourceRates) {
    if (!sourceRates || typeof sourceRates !== 'object') {
        return null;
    }

    const normalized = { USD: 1 };
    for (const currency of SUPPORTED_CURRENCIES) {
        if (currency === 'USD') continue;
        const value = Number(sourceRates[currency]);
        if (!Number.isFinite(value) || value <= 0) {
            return null;
        }
        normalized[currency] = value;
    }

    return normalized;
}

/**
 * Get a safe exchange rate for a currency.
 * @param {string} currency - ISO currency code.
 * @returns {number} Rate in units per USD; defaults to 1 when unavailable.
 */
function getExchangeRate(currency) {
    const rate = Number(exchangeRates[currency]);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

/**
 * Apply exchange rates and update metadata text in the UI.
 * @param {Object} rates - Normalized rates map.
 * @param {string|Date|null} asOf - Timestamp from provider.
 * @param {string} source - Source label.
 */
function applyExchangeRates(rates, asOf, source) {
    exchangeRates = rates;
    exchangeRatesAsOf = asOf;
    exchangeRateSource = source;
    updateExchangeRatesMeta();
}

/**
 * Render exchange-rate status metadata for users.
 * @param {string} statusMessage - Additional status text.
 * @param {boolean} isError - Whether status represents an error state.
 */
function updateExchangeRatesMeta(statusMessage = '', isError = false) {
    const ratesAsOfEl = document.getElementById('ratesAsOf');
    const ratesStatusEl = document.getElementById('ratesStatus');

    if (ratesAsOfEl) {
        if (exchangeRatesAsOf) {
            const asOfDate = new Date(exchangeRatesAsOf);
            ratesAsOfEl.textContent = Number.isNaN(asOfDate.getTime())
                ? 'Rates as of: unknown'
                : `Rates as of: ${asOfDate.toLocaleString()}`;
        } else {
            ratesAsOfEl.textContent = 'Rates as of: unavailable';
        }
    }

    if (ratesStatusEl) {
        const sourceText = exchangeRateSource === 'live' ? 'Live rates' : 'Fallback rates';
        ratesStatusEl.textContent = [sourceText, statusMessage].filter(Boolean).join(' | ');
        ratesStatusEl.classList.toggle('error', isError);
    }
}

/**
 * Ensure conversion logic can run even if live fetch/config are unavailable.
 */
function applyFallbackRates() {
    applyExchangeRates({ ...DEFAULT_RATES }, new Date(), 'fallback');
}

/**
 * Load exchange rates from a live API with a safe fallback path.
 */
async function loadExchangeRates() {
    const endpoint = '/api/exchange-rates';

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const normalized = normalizeRates(data.rates);
        if (!normalized) {
            throw new Error('API did not return all required currencies');
        }

        const source = data.source === 'live' ? 'live' : 'fallback';
        const timestamp = data.updatedAt || new Date();
        applyExchangeRates(normalized, timestamp, source);
        updateExchangeRatesMeta(source === 'live' ? 'Loaded from server cache.' : 'Server fallback rates in use.');
        return;
    } catch (error) {
        console.error('Failed to load live exchange rates:', error);
    }

    applyFallbackRates();
    updateExchangeRatesMeta('Could not reach rates endpoint. Using fallback rates.', true);
}

/**
 * Set the UI display currency and refresh dependent calculations, charts, and converter.
 * @param {string} currency - The target currency code (e.g., 'USD', 'EUR') to use for displaying amounts.
 */
function changeDisplayCurrency(currency) {
    displayCurrency = currency;
    updateTaxCalculations();
    updateCharts();
    updateConverter();
}

/**
 * Compute progressive tax for an income amount using currency-specific brackets.
 *
 * Calculates tax by applying each bracket's rate to the portion of income within that bracket,
 * using the bracket set for the given currency or falling back to USD brackets if the currency is unknown.
 *
 * @param {number} income - Income amount in the specified currency.
 * @param {string} currency - ISO currency code used to select the tax bracket set.
 * @returns {number} Tax amount rounded to two decimal places.
 */
function calculateTax(income, currency) {
    const brackets = taxBrackets[currency] || taxBrackets.USD;
    let tax = 0;
    let previousLimit = 0;

    for (let bracket of brackets) {
        if (income <= previousLimit) break;

        const taxableInThisBracket = Math.min(income, bracket.limit) - previousLimit;
        tax += taxableInThisBracket * bracket.rate;
        previousLimit = bracket.limit;
    }

    return Math.round(tax * 100) / 100;
}

/**
 * Format an amount as a currency string using a symbol for known ISO currency codes.
 * @param {number} amount - The monetary amount to format; will be shown with two decimal places.
 * @param {string} currency - ISO currency code (e.g., 'USD', 'EUR'); selects the symbol. If unknown, the dollar sign (`$`) is used.
 * @returns {string} The formatted currency string with a symbol and two decimal places (for example, `$123.45`).
 */
function formatCurrency(amount, currency) {
    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CAD: 'C$',
        AUD: 'A$',
        INR: '₹',
        AED: 'AED'
    };
    return `${symbols[currency] || '$'}${amount.toFixed(2)}`;
}

/**
 * Get the currency symbol for a given currency code.
 * @param {string} currency - Currency code (e.g., 'USD', 'EUR', 'GBP').
 * @returns {string} The symbol for the currency (e.g., '$', '€', '£'); returns '$' if the code is not recognized.
 */
function getCurrencySymbol(currency) {
    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CAD: 'C$',
        AUD: 'A$',
        INR: '₹',
        AED: 'AED'
    };
    return symbols[currency] || '$';
}

/**
 * Create a new income entry from current form values, persist it via the API, and refresh the dashboard.
 *
 * Validates that the source is non-empty and the amount is greater than zero; shows a modal for validation errors.
 * On success clears the input form, reloads income data, and shows a success modal. On failure shows an error modal.
 */
async function addIncome() {
    const source = document.getElementById('incomeSource').value.trim();
    const amount = parseFloat(document.getElementById('incomeAmount').value);
    const currency = document.getElementById('incomeCurrency') ? document.getElementById('incomeCurrency').value : 'USD';

    if (!source) {
        showModal('Please enter an income source');
        return;
    }

    if (!amount || amount <= 0) {
        showModal('Please enter a valid amount');
        return;
    }

    try {
        await saveIncome({
            source_type: source,
            amount: amount,
            currency: currency,
            frequency: 'annual', // Default to annual for now
            tax_band: 'Basic Rate', // Default
            description: source // Use source as description
        });

        clearForm();
        await loadIncomeData();
        showModal('Income added successfully!');
    } catch (error) {
        console.error('Failed to add income:', error);
        showModal('Failed to add income: ' + error.message);
    }
}

/**
 * Delete an income entry by its ID and refresh the dashboard.
 *
 * On success, reloads income data and shows a success modal. On failure, logs the error and shows an alert to the user.
 * @param {number|string} id - The identifier of the income entry to remove.
 */
async function removeIncome(id) {
    try {
        await deleteIncome(id);
        await loadIncomeData();
        showModal('Income removed successfully!');
    } catch (error) {
        console.error('Failed to remove income:', error);
        showModal('Failed to remove income. Please try again.');
    }
}

/**
 * Clear and reset the add-income form fields.
 *
 * Clears the source and amount inputs, resets the currency selector to 'USD' if present,
 * and focuses the income source input.
 */
function clearForm() {
    document.getElementById('incomeSource').value = '';
    document.getElementById('incomeAmount').value = '';
    if (document.getElementById('incomeCurrency')) {
        document.getElementById('incomeCurrency').value = 'USD';
    }
    document.getElementById('incomeSource').focus();
}

/**
 * Load income entries from the API and refresh the UI.
 *
 * Fetches entries, assigns them to the module-level `incomeEntries`, and calls `updateDisplay()` to update the interface.
 * If fetching fails, logs the error, clears `incomeEntries`, and still calls `updateDisplay()` to reflect the empty state.
 */
async function loadIncomeData() {
    try {
        incomeEntries = await fetchIncome();
        updateDisplay();
    } catch (error) {
        console.error('Failed to load income data:', error);
        incomeEntries = [];
        updateDisplay();
    }
}

/**
 * Refreshes the dashboard UI sections related to income, tax calculations, currency conversion, and charts.
 *
 * Updates the income list, recomputes tax summaries and breakdowns, rebuilds the currency converter output, and refreshes all charts to reflect current data and display currency.
 */
function updateDisplay() {
    updateIncomeList();
    updateTaxCalculations();
    updateConverter();
    updateCharts();
}

/**
 * Render the income entries list into the UI and wire up delete buttons.
 *
 * Updates the element with id "incomeList" to show either an empty-state message or a list of income items (each showing source and formatted amount), attaches click handlers to buttons with class "remove-income-btn" to remove the corresponding entry, and toggles visibility of the element with id "scrollHint" based on the list height.
 */
function updateIncomeList() {
    const listContainer = document.getElementById('incomeList');
    const scrollHint = document.getElementById('scrollHint');

    if (incomeEntries.length === 0) {
        listContainer.innerHTML = `
            <article class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>No income entries yet. Add one to get started!</p>
            </article>
        `;
        if (scrollHint) {
            scrollHint.style.display = 'none';
        }
        return;
    }

    listContainer.innerHTML = incomeEntries.map(entry => {
        const curr = entry.currency || 'USD';
        const displayAmount = formatCurrency(Number(entry.amount || 0), curr);
        return `
        <div class="income-item">
            <div class="income-item-info">
                <div class="income-item-name">${escapeHtml(entry.source_type || entry.description)}</div>
                <div class="income-item-amount">${displayAmount}</div>
            </div>
            <div class="income-item-actions">
                <button class="btn-danger remove-income-btn" data-id="${entry.id}">Delete</button>
            </div>
        </div>
    `;
    }).join('');

    listContainer.querySelectorAll('.remove-income-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (id) removeIncome(Number(id));
        });
    });

    if (scrollHint) {
        scrollHint.style.display = listContainer.scrollHeight > 400 ? 'block' : 'none';
    }
}

/**
 * Recomputes totals, effective tax rate, and per-source tax breakdown, then updates the dashboard UI.
 *
 * Recalculates total income and total tax using each entry's own currency brackets and the global exchangeRates, converts totals into the current displayCurrency, updates summary fields (#totalIncome, #totalTax, #netIncome, #taxRate), and renders a per-source breakdown table into #taxBreakdown. If there are no entries, renders an empty-state message.
 */
function updateTaxCalculations() {
    // Calculate totals - tax per entry using its OWN currency's brackets
    let totalIncomeUsd = 0;
    let totalTaxUsd = 0;
    
    incomeEntries.forEach(entry => {
        const amt = Number(entry.amount || 0);
        const curr = entry.currency || 'USD';
        const rate = getExchangeRate(curr); // rate = units per USD
        
        // Convert to USD for total
        const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
        totalIncomeUsd += amtUsd;
        
        // Calculate tax using THIS ENTRY'S currency brackets
        const taxInOriginalCurrency = calculateTax(amt, curr);
        const taxInUsd = rate && rate !== 0 ? (taxInOriginalCurrency / rate) : taxInOriginalCurrency;
        totalTaxUsd += taxInUsd;
    });
    
    // Convert display values to selected display currency
    const displayRate = getExchangeRate(displayCurrency);
    const totalIncomeDisplay = displayRate && displayRate !== 0 ? (totalIncomeUsd * displayRate) : totalIncomeUsd;
    const totalTaxDisplay = displayRate && displayRate !== 0 ? (totalTaxUsd * displayRate) : totalTaxUsd;
    const netIncomeDisplay = totalIncomeDisplay - totalTaxDisplay;

    // Update summary
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncomeDisplay, displayCurrency);
    document.getElementById('totalTax').textContent = formatCurrency(totalTaxDisplay, displayCurrency);
    document.getElementById('netIncome').textContent = formatCurrency(netIncomeDisplay, displayCurrency);
    document.getElementById('taxRate').textContent = totalIncomeUsd > 0 ? ((totalTaxUsd / totalIncomeUsd) * 100).toFixed(2) + '%' : '0%';

    // Simple breakdown by source
    const breakdownContainer = document.getElementById('taxBreakdown');
    if (incomeEntries.length === 0) {
        breakdownContainer.innerHTML = `
            <h3>Tax Breakdown by Source</h3>
            <div class="empty-state">
                <p>Add income to see the tax breakdown</p>
            </div>
        `;
        return;
    }

    let breakdownHTML = `<h3>Tax Breakdown by Source</h3><table class="conversion-table"><thead><tr><th>Source</th><th>Amount (Original)</th><th>Amount (${displayCurrency})</th><th>Tax (${displayCurrency})</th><th>Rate</th></tr></thead><tbody>`;
    incomeEntries.forEach(entry => {
        const amt = Number(entry.amount || 0);
        const curr = entry.currency || 'USD';
        const exRate = getExchangeRate(curr);
        const amtUsd = exRate && exRate !== 0 ? (amt / exRate) : amt;
        const amtDisplay = displayRate && displayRate !== 0 ? (amtUsd * displayRate) : amtUsd;
        
        // Calculate tax using THIS ENTRY'S currency brackets
        const taxInOriginalCurrency = calculateTax(amt, curr);
        const taxUsd = exRate && exRate !== 0 ? (taxInOriginalCurrency / exRate) : taxInOriginalCurrency;
        const taxDisplay = displayRate && displayRate !== 0 ? (taxUsd * displayRate) : taxUsd;
        const rate = amt > 0 ? ((taxInOriginalCurrency / amt) * 100).toFixed(2) : '0';
        breakdownHTML += `
            <tr>
                <td><strong>${escapeHtml(entry.source_type || entry.description)}</strong></td>
                <td>${formatCurrency(amt, curr)}</td>
                <td>${formatCurrency(amtDisplay, displayCurrency)}</td>
                <td>${formatCurrency(taxDisplay, displayCurrency)}</td>
                <td>${rate}%</td>
            </tr>
        `;
    });
    breakdownHTML += '</tbody></table>';
    breakdownContainer.innerHTML = breakdownHTML;
}

/**
 * Rebuilds the currency selector UI and attaches click handlers to trigger conversion for a chosen currency.
 *
 * Replaces the contents of the #currencySelector element with buttons for USD, EUR, GBP, CAD, AUD, INR, and AED.
 * Each button has class `currency-btn` and a `data-currency` attribute; clicking a button calls `showConversion` with
 * the button's currency value and the button element.
 */
function updateConverter() {
    const selector = document.getElementById('currencySelector');
    const currencies = SUPPORTED_CURRENCIES;

    selector.innerHTML = currencies.map(curr => `
        <button class="currency-btn" data-currency="${curr}">${curr}</button>
    `).join('');

    selector.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConversion(btn.getAttribute('data-currency'), btn);
        });
    });
}

/**
 * Render a conversion summary between the current display currency and a selected currency and mark the corresponding currency button active.
 *
 * If there are no income entries, renders an empty-state message. Otherwise computes total income and total tax (using each entry's original currency and tax rules), converts those totals into the current display currency and the selected currency, and replaces the content of the `#conversionResult` element with a table showing original and converted amounts.
 * @param {string} selectedCurrency - The target currency code to convert totals into (e.g., 'USD', 'EUR').
 * @param {HTMLElement} buttonElement - The button element that was clicked; it will receive the active styling.
 */
function showConversion(selectedCurrency, buttonElement) {
    // Update active button
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    buttonElement.classList.add('active');

    const resultContainer = document.getElementById('conversionResult');

    if (incomeEntries.length === 0) {
        resultContainer.innerHTML = `
            <div class="empty-state">
                <p>Add income to see conversions</p>
            </div>
        `;
        return;
    }

    // Calculate totals properly using each entry's currency
    let totalIncomeUsd = 0;
    let totalTaxUsd = 0;
    
    incomeEntries.forEach(entry => {
        const amt = Number(entry.amount || 0);
        const curr = entry.currency || 'USD';
        const rate = getExchangeRate(curr);
        const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
        totalIncomeUsd += amtUsd;
        
        const taxInOriginalCurrency = calculateTax(amt, curr);
        const taxInUsd = rate && rate !== 0 ? (taxInOriginalCurrency / rate) : taxInOriginalCurrency;
        totalTaxUsd += taxInUsd;
    });
    
    // Convert from display currency to selected currency
    const displayRate = getExchangeRate(displayCurrency);
    const totalIncomeDisplay = displayRate && displayRate !== 0 ? (totalIncomeUsd * displayRate) : totalIncomeUsd;
    const selectedRate = getExchangeRate(selectedCurrency);
    const totalIncomeSelected = selectedRate && selectedRate !== 0 ? (totalIncomeUsd * selectedRate) : totalIncomeUsd;
    
    const taxDisplayConverted = displayRate && displayRate !== 0 ? (totalTaxUsd * displayRate) : totalTaxUsd;
    const taxSelectedConverted = selectedRate && selectedRate !== 0 ? (totalTaxUsd * selectedRate) : totalTaxUsd;

    let html = `<h3>Conversion from ${displayCurrency} to ${selectedCurrency}</h3><table class="conversion-table"><thead><tr><th>From Currency</th><th>Original Amount</th><th>Converted Amount</th><th>Tax (Original)</th><th>Tax (Converted)</th></tr></thead><tbody>`;

    html += `
        <tr>
            <td><strong>${displayCurrency}</strong></td>
            <td>${formatCurrency(totalIncomeDisplay, displayCurrency)}</td>
            <td>${formatCurrency(totalIncomeSelected, selectedCurrency)}</td>
            <td>${formatCurrency(taxDisplayConverted, displayCurrency)}</td>
            <td>${formatCurrency(taxSelectedConverted, selectedCurrency)}</td>
        </tr>
    `;

    html += '</tbody></table>';
    resultContainer.innerHTML = html;
}

/**
 * Refreshes the dashboard charts to reflect the current income entries and selected display currency.
 *
 * If there are no income entries, hides the charts section. Otherwise computes per-source totals
 * (converting entry amounts through USD into the current display currency) and updates all chart
 * visualizations (income distribution, tax vs net, source distribution, and tax rate analysis).
 */
function updateCharts() {
    const chartsSection = document.getElementById('chartsSection');
    
    if (incomeEntries.length === 0) {
        chartsSection.style.display = 'none';
        return;
    }

    chartsSection.style.display = 'grid';

    // Prepare data by source - convert all amounts to USD first, then to display currency
    const bySourceUsd = {};
    incomeEntries.forEach(entry => {
        const source = entry.source_type || entry.description || 'Other';
        const amt = Number(entry.amount || 0);
        const curr = entry.currency || 'USD';
        const rate = getExchangeRate(curr);
        // Convert to USD
        const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
        
        if (!bySourceUsd[source]) {
            bySourceUsd[source] = 0;
        }
        bySourceUsd[source] += amtUsd;
    });
    
    // Convert to display currency
    const displayRate = getExchangeRate(displayCurrency);
    const bySource = {};
    Object.keys(bySourceUsd).forEach(source => {
        bySource[source] = displayRate && displayRate !== 0 ? (bySourceUsd[source] * displayRate) : bySourceUsd[source];
    });

    // Update Income Distribution Chart (Pie)
    updateIncomeDistributionChart(bySource);

    // Update Tax vs Net Income Chart (Bar)
    updateTaxVsNetChart(bySourceUsd);

    // Update Income by Source Chart (Doughnut)
    updateSourceDistributionChart(bySource);

    // Update Tax Rate Analysis Chart (Bar)
    updateTaxRateAnalysisChart(bySourceUsd);
}

/**
 * Render the income distribution pie chart and update its legend.
 *
 * Recreates the Chart.js pie chart displayed in the #incomeChart canvas using the provided source-to-amount mapping, destroys any previous chart instance, and refreshes the legend.
 * @param {Object.<string, number>} bySource - Mapping of income source labels to their numeric amounts (in the current display currency). 
 */
function updateIncomeDistributionChart(bySource) {
    const ctx = document.getElementById('incomeChart').getContext('2d');
    const labels = Object.keys(bySource);
    const data = Object.values(bySource);
    const colors = colorPalette.slice(0, labels.length);

    if (incomeChartInstance) {
        incomeChartInstance.destroy();
    }

    incomeChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            const currencySymbol = getCurrencySymbol(displayCurrency);
                            return `${context.label}: ${currencySymbol}${context.parsed.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update legend
    updateLegend('incomeLegend', labels, colors);
}

/**
 * Renders the tax-vs-net-income bar chart by source and updates the global chart instance and legend.
 * @param {Object.<string, number>} bySourceUsd - Object mapping each source label to its total income amount in USD.
 */
function updateTaxVsNetChart(bySourceUsd) {
    const ctx = document.getElementById('taxChart').getContext('2d');
    const labels = Object.keys(bySourceUsd);
    const taxData = [];
    const netData = [];

    // Calculate tax and net for each source by summing contributions from its entries
    labels.forEach(source => {
        let sourceTaxUsd = 0;
        let sourceIncomeUsd = 0;
        
        incomeEntries.forEach(entry => {
            if ((entry.source_type || entry.description || 'Other') === source) {
                const amt = Number(entry.amount || 0);
                const curr = entry.currency || 'USD';
                const rate = getExchangeRate(curr);
                const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
                sourceIncomeUsd += amtUsd;
                
                // Tax calculated on original amount in original currency
                const taxInOriginalCurrency = calculateTax(amt, curr);
                const taxInUsd = rate && rate !== 0 ? (taxInOriginalCurrency / rate) : taxInOriginalCurrency;
                sourceTaxUsd += taxInUsd;
            }
        });
        
        const net = sourceIncomeUsd - sourceTaxUsd;
        taxData.push(sourceTaxUsd);
        netData.push(net);
    });

    if (taxChartInstance) {
        taxChartInstance.destroy();
    }

    const displayRate = getExchangeRate(displayCurrency);
    const netDataDisplay = netData.map(val => displayRate && displayRate !== 0 ? (val * displayRate) : val);
    const taxDataDisplay = taxData.map(val => displayRate && displayRate !== 0 ? (val * displayRate) : val);
    const currencySymbol = getCurrencySymbol(displayCurrency);

    taxChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Net Income',
                    data: netDataDisplay,
                    backgroundColor: chartColors.success,
                    borderRadius: 5
                },
                {
                    label: 'Tax',
                    data: taxDataDisplay,
                    backgroundColor: chartColors.danger,
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: { size: 12 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${currencySymbol}${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return currencySymbol + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });

    // Update legend
    updateLegend('taxLegend', ['Net Income', 'Tax'], [chartColors.success, chartColors.danger]);
}

/**
 * Render or refresh the doughnut chart that displays income totals grouped by source.
 *
 * Updates the global chart instance for the currency/source distribution and replaces the currency legend in the DOM.
 *
 * @param {Object<string, number>} bySource - Mapping of source label to total amount (values expressed in the current display currency).
 */
function updateSourceDistributionChart(bySource) {
    const ctx = document.getElementById('currencyChart').getContext('2d');
    const labels = Object.keys(bySource);
    const data = Object.values(bySource);
    const colors = colorPalette.slice(0, labels.length);

    if (currencyChartInstance) {
        currencyChartInstance.destroy();
    }

    currencyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            const currencySymbol = getCurrencySymbol(displayCurrency);
                            return `${context.label}: ${currencySymbol}${context.parsed.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update legend
    updateLegend('currencyLegend', labels, colors);
}

/**
 * Render a bar chart showing the effective tax rate for each income source and update its legend.
 *
 * Calculates each source's effective tax rate as (total tax for that source / total amount for that source) * 100,
 * destroys any existing chart instance, creates a new Chart.js bar chart with those rates, and refreshes the legend.
 * @param {Object<string, number>} bySource - Object whose keys are source labels (e.g., employer or description); values are amounts (used only to derive labels and order).
 */
function updateTaxRateAnalysisChart(bySource) {
    const ctx = document.getElementById('taxRateChart').getContext('2d');
    const labels = Object.keys(bySource);
    const taxRates = [];

    labels.forEach(source => {
        let sourceTaxUsd = 0;
        let sourceAmountUsd = 0;

        incomeEntries.forEach(entry => {
            if ((entry.source_type || entry.description || 'Other') === source) {
                const amt = Number(entry.amount || 0);
                const curr = entry.currency || 'USD';
                const rate = getExchangeRate(curr);

                // Convert amount to USD
                const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
                sourceAmountUsd += amtUsd;

                // Calculate tax in original currency, then convert to USD
                const taxInOriginalCurrency = calculateTax(amt, curr);
                const taxInUsd = rate && rate !== 0 ? (taxInOriginalCurrency / rate) : taxInOriginalCurrency;
                sourceTaxUsd += taxInUsd;
            }
        });

        const rate = sourceAmountUsd > 0 ? (sourceTaxUsd / sourceAmountUsd) * 100 : 0;
        taxRates.push(rate);
    });

    if (taxRateChartInstance) {
        taxRateChartInstance.destroy();
    }

    taxRateChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Effective Tax Rate (%)',
                data: taxRates,
                backgroundColor: chartColors.primary,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Tax Rate: ${context.parsed.y.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 50,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });

    // Update legend
    updateLegend('taxRateLegend', ['Effective Tax Rate'], [chartColors.primary]);
}

/**
 * Render a simple legend into a container element by id.
 *
 * Each label is paired with the color at the same index to create legend entries.
 *
 * @param {string} elementId - The id of the container element where the legend will be rendered.
 * @param {string[]} labels - Array of label strings for legend entries.
 * @param {string[]} colors - Array of CSS color strings; each color corresponds to the label at the same index.
 */
function updateLegend(elementId, labels, colors) {
    const legendContainer = document.getElementById(elementId);
    legendContainer.innerHTML = labels.map((label, index) => `
        <div class="legend-item">
            <div class="legend-color" style="background-color: ${colors[index]};"></div>
            <span>${label}</span>
        </div>
    `).join('');
}

/**
 * Activate the tab panel with the given ID and set its corresponding tab button to active.
 *
 * @param {string} tabName - The ID of the tab content to show; a case-insensitive match is used to locate and activate the related tab button.
 */
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    // Find and activate the button that was clicked
    const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn =>
        btn.textContent.toLowerCase().includes(tabName.toLowerCase())
    );
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    const user = await requireUser();

    const addBtn = document.getElementById('addIncomeBtn');
    const clearBtn = document.getElementById('clearFormBtn');
    const currencySelect = document.getElementById('displayCurrencySelect');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const tabButtons = document.querySelectorAll('.tab-btn');

    if (addBtn) addBtn.addEventListener('click', addIncome);
    if (clearBtn) clearBtn.addEventListener('click', clearForm);
    if (modalOkBtn) modalOkBtn.addEventListener('click', closeModal);
    if (currencySelect) currencySelect.addEventListener('change', (event) => changeDisplayCurrency(event.target.value));
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            if (tabName) switchTab(tabName);
        });
    });

    if (user) {
        clearForm();
        await loadExchangeRates();
        await loadIncomeData();
        updateConverter();
    }
});

// Allow Enter key to add income
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && (e.target.id === 'incomeSource' || e.target.id === 'incomeAmount')) {
        addIncome();
    }
});

/**
 * Displays the validation modal and sets its message.
 * @param {string} message - Text to display inside the modal.
 */
function showModal(message) {
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('validationModal').style.display = 'flex';
}

/**
 * Hides the validation modal dialog.
 */
function closeModal() {
    document.getElementById('validationModal').style.display = 'none';
}