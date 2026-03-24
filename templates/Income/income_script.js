// Authentication check
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

// Fetch income data
async function fetchIncome() {
    const response = await fetch('/api/income');
    if (!response.ok) throw new Error('Failed to fetch income');
    return response.json();
}

// Save income entry
async function saveIncome(incomeData) {
    const response = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(incomeData)
    });
    if (!response.ok) throw new Error('Failed to save income');
    return response.json();
}

// Delete income entry
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

// Exchange rates (approximate, for demonstration)
const exchangeRates = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.53,
    INR: 83.12,
    AED: 3.67
};

let incomeEntries = [];
let displayCurrency = 'USD'; // Current currency to display all values in

// Change display currency
function changeDisplayCurrency(currency) {
    displayCurrency = currency;
    updateTaxCalculations();
    updateCharts();
    updateConverter();
}

// Calculate tax using progressive brackets
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

// Format currency
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

// Get currency symbol only
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

// Add income entry
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
        alert('Failed to add income. Please try again.');
    }
}

// Remove income entry
async function removeIncome(id) {
    try {
        await deleteIncome(id);
        await loadIncomeData();
        showModal('Income removed successfully!');
    } catch (error) {
        console.error('Failed to remove income:', error);
        alert('Failed to remove income. Please try again.');
    }
}

// Clear form
function clearForm() {
    document.getElementById('incomeSource').value = '';
    document.getElementById('incomeAmount').value = '';
    if (document.getElementById('incomeCurrency')) {
        document.getElementById('incomeCurrency').value = 'USD';
    }
    document.getElementById('incomeSource').focus();
}

// Load income data from API
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

// Update all displays
function updateDisplay() {
    updateIncomeList();
    updateTaxCalculations();
    updateConverter();
    updateCharts();
}

// Update income list display
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
        scrollHint.style.display = 'none';
        return;
    }

    listContainer.innerHTML = incomeEntries.map(entry => {
        const curr = entry.currency || 'USD';
        const displayAmount = formatCurrency(Number(entry.amount || 0), curr);
        return `
        <div class="income-item">
            <div class="income-item-info">
                <div class="income-item-name">${entry.source_type || entry.description}</div>
                <div class="income-item-amount">${displayAmount}</div>
            </div>
            <div class="income-item-actions">
                <button class="btn-danger" onclick="removeIncome(${entry.id})">Delete</button>
            </div>
        </div>
    `;
    }).join('');

    scrollHint.style.display = listContainer.scrollHeight > 400 ? 'block' : 'none';
}

// Update tax calculations
function updateTaxCalculations() {
    // Calculate totals - tax per entry using its OWN currency's brackets
    let totalIncomeUsd = 0;
    let totalTaxUsd = 0;
    
    incomeEntries.forEach(entry => {
        const amt = Number(entry.amount || 0);
        const curr = entry.currency || 'USD';
        const rate = exchangeRates[curr] || 1; // rate = units per USD
        
        // Convert to USD for total
        const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
        totalIncomeUsd += amtUsd;
        
        // Calculate tax using THIS ENTRY'S currency brackets
        const taxInOriginalCurrency = calculateTax(amt, curr);
        const taxInUsd = rate && rate !== 0 ? (taxInOriginalCurrency / rate) : taxInOriginalCurrency;
        totalTaxUsd += taxInUsd;
    });
    
    // Convert display values to selected display currency
    const displayRate = exchangeRates[displayCurrency] || 1;
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
        const exRate = exchangeRates[curr] || 1;
        const amtUsd = exRate && exRate !== 0 ? (amt / exRate) : amt;
        const amtDisplay = displayRate && displayRate !== 0 ? (amtUsd * displayRate) : amtUsd;
        
        // Calculate tax using THIS ENTRY'S currency brackets
        const taxInOriginalCurrency = calculateTax(amt, curr);
        const taxUsd = exRate && exRate !== 0 ? (taxInOriginalCurrency / exRate) : taxInOriginalCurrency;
        const taxDisplay = displayRate && displayRate !== 0 ? (taxUsd * displayRate) : taxUsd;
        const rate = amt > 0 ? ((taxInOriginalCurrency / amt) * 100).toFixed(2) : '0';
        breakdownHTML += `
            <tr>
                <td><strong>${entry.source_type || entry.description}</strong></td>
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

// Update converter
function updateConverter() {
    const selector = document.getElementById('currencySelector');
    const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'AED'];

    selector.innerHTML = currencies.map(curr => `
        <button class="currency-btn" onclick="showConversion('${curr}', this)">${curr}</button>
    `).join('');
}

// Show conversion for selected currency
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
        const rate = exchangeRates[curr] || 1;
        const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
        totalIncomeUsd += amtUsd;
        
        const taxInOriginalCurrency = calculateTax(amt, curr);
        const taxInUsd = rate && rate !== 0 ? (taxInOriginalCurrency / rate) : taxInOriginalCurrency;
        totalTaxUsd += taxInUsd;
    });
    
    // Convert from display currency to selected currency
    const displayRate = exchangeRates[displayCurrency] || 1;
    const totalIncomeDisplay = displayRate && displayRate !== 0 ? (totalIncomeUsd * displayRate) : totalIncomeUsd;
    const selectedRate = exchangeRates[selectedCurrency] || 1;
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

// Update Charts
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
        const rate = exchangeRates[curr] || 1;
        // Convert to USD
        const amtUsd = rate && rate !== 0 ? (amt / rate) : amt;
        
        if (!bySourceUsd[source]) {
            bySourceUsd[source] = 0;
        }
        bySourceUsd[source] += amtUsd;
    });
    
    // Convert to display currency
    const displayRate = exchangeRates[displayCurrency] || 1;
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

// Income Distribution Chart (Pie)
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

// Tax vs Net Income Chart (Bar)
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
                const rate = exchangeRates[curr] || 1;
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

    const displayRate = exchangeRates[displayCurrency] || 1;
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

// Income by Source Chart (Doughnut)
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

// Tax Rate Analysis Chart (Bar)
function updateTaxRateAnalysisChart(bySource) {
    const ctx = document.getElementById('taxRateChart').getContext('2d');
    const labels = Object.keys(bySource);
    const taxRates = [];

    labels.forEach(source => {
        let sourceTaxInOriginalCurrency = 0;
        let sourceAmountInOriginalCurrency = 0;
        
        incomeEntries.forEach(entry => {
            if ((entry.source_type || entry.description || 'Other') === source) {
                const amt = Number(entry.amount || 0);
                const curr = entry.currency || 'USD';
                sourceAmountInOriginalCurrency += amt;
                
                const taxInOriginalCurrency = calculateTax(amt, curr);
                sourceTaxInOriginalCurrency += taxInOriginalCurrency;
            }
        });
        
        const rate = sourceAmountInOriginalCurrency > 0 ? (sourceTaxInOriginalCurrency / sourceAmountInOriginalCurrency) * 100 : 0;
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

// Update legend helper
function updateLegend(elementId, labels, colors) {
    const legendContainer = document.getElementById(elementId);
    legendContainer.innerHTML = labels.map((label, index) => `
        <div class="legend-item">
            <div class="legend-color" style="background-color: ${colors[index]};"></div>
            <span>${label}</span>
        </div>
    `).join('');
}

// Switch tabs
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
    if (user) {
        clearForm();
        updateConverter();
        await loadIncomeData();
    }
});

// Allow Enter key to add income
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && (e.target.id === 'incomeSource' || e.target.id === 'incomeAmount')) {
        addIncome();
    }
});

// Modal functions
function showModal(message) {
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('validationModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('validationModal').style.display = 'none';
}