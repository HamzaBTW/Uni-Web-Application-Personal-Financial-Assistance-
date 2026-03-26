// Intangible Assets - Main Script

// Intangible asset categories
const categories = ['Skills', 'Network', 'IP', 'Brand', 'Financial Literacy', 'Health'];
const categoryKeys = ['skills', 'network', 'ip', 'brand', 'literacy', 'health'];
const sliderIds = ['skillsSlider', 'networkSlider', 'ipSlider', 'brandSlider', 'literacySlider', 'healthSlider'];
const valueIds = ['skillsValue', 'networkValue', 'ipValue', 'brandValue', 'literacyValue', 'healthValue'];
const textIds = ['qualifications', 'networkDetails', 'ipHoldings', 'brandPresence', 'financialGoals', 'healthDetails'];
let radarChartInstance = null;
let intangiblesData = {};
let existingIntangibles = {};

/**
 * Ensure a user is authenticated and update the UI with their display name and navigation visibility.
 *
 * If no authenticated user is returned, the browser is redirected to /auth.html and the function returns `null`.
 *
 * @returns {Object|null} The authenticated user object returned by the server, or `null` if the user was redirected due to missing authentication.
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
 * Fetches intangible asset records from the server and updates the in-memory mapping of existing records keyed by category.
 *
 * @returns {Array<Object>} The fetched array of intangible records.
 * @throws {Error} If the network request fails or the response is not OK.
 */
async function fetchIntangibles() {
    const response = await fetch('/api/intangibles');
    if (!response.ok) throw new Error('Failed to fetch intangibles');
    const data = await response.json();
    
    // Map by category key
    existingIntangibles = {};
    data.forEach(item => {
        const categoryIndex = categories.indexOf(item.category);
        if (categoryIndex !== -1) {
            const key = categoryKeys[categoryIndex];
            existingIntangibles[key] = item;
        }
    });
    
    return data;
}

/**
 * Persist an intangible category record to the backend, creating a new record or updating an existing one.
 *
 * @param {string} category - The human-readable category name corresponding to one of the configured categories.
 * @param {number|string} score - The category score (expected 0–10); numeric or numeric-string accepted.
 * @param {string} description - The textual description for the category.
 * @throws {Error} If the server responds with a non-OK status when creating or updating the record.
 */
async function saveIntangible(category, score, description) {
    // Find the key for this category
    const categoryIndex = categories.indexOf(category);
    const categoryKey = categoryKeys[categoryIndex];
    const existing = existingIntangibles[categoryKey];
    
    const formData = new URLSearchParams();
    formData.append('category', category);
    formData.append('score', score);
    formData.append('description', description);
    
    if (existing) {
        // Update existing
        const response = await fetch(`/api/intangibles/${existing.id}/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to update intangible');
    } else {
        // Create new
        const response = await fetch('/api/intangibles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to save intangible');
    }
}

/**
 * Attach input listeners to the configured sliders so changes update the visible value and refresh the UI.
 *
 * Expects global arrays `sliderIds` and `valueIds` to be defined and aligned by index; each slider element with an ID from `sliderIds`
 * will update the corresponding value span from `valueIds` on user input and invoke `updateDisplay()`.
 */
function initializeSliders() {
    sliderIds.forEach((sliderId, index) => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueIds[index]);
        slider.addEventListener('input', (e) => {
            valueSpan.textContent = e.target.value;
            updateDisplay();
        });
    });
}

/**
 * Validate inputs, persist all six category assessments to the backend, and refresh the UI.
 *
 * Validates that every score is greater than 0 and every description is non-empty. If validation fails,
 * shows a modal with an explanatory message and aborts. If validation succeeds, saves each category's
 * score and description, reloads the latest assessment data, updates visible breakdowns and charts,
 * and shows a success modal. If saving fails, displays an alert indicating the failure.
 */
async function saveIntangibles() {
    console.log('saveIntangibles called');

    // Validate inputs
    const scores = sliderIds.map(id => parseInt(document.getElementById(id).value));
    if (scores.some(score => score <= 0)) {
        showModal('Please set all scores above 0 before saving.');
        return;
    }

    const descriptions = textIds.map(id => document.getElementById(id).value.trim());
    if (descriptions.some(desc => desc === '')) {
        showModal('Please fill in all descriptions before saving.');
        return;
    }

    try {
        // Save each category
        const savePromises = categories.map((category, index) => {
            const score = parseInt(document.getElementById(sliderIds[index]).value);
            const description = document.getElementById(textIds[index]).value;
            return saveIntangible(category, score, description);
        });
        
        await Promise.all(savePromises);
        
        // Refresh data
        await fetchIntangibles();
        updateDisplay();
        showModal('Assessment saved successfully!');
    } catch (error) {
        console.error('Failed to save intangibles:', error);
        alert('Failed to save assessment. Please try again.');
    }
}

/**
 * Restore the assessment form to its default state and refresh the UI.
 *
 * Clears all category description textareas, sets every slider and its displayed value to 5, and calls updateDisplay() to refresh the breakdown, charts, and summary.
 */
function resetForm() {
    console.log('resetForm called');
    // Clear textareas
    textIds.forEach(id => {
        document.getElementById(id).value = '';
    });
    
    // Reset sliders to 5
    sliderIds.forEach((sliderId, index) => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueIds[index]);
        slider.value = 5;
        valueSpan.textContent = '5';
    });
    
    updateDisplay();
}

/**
 * Refreshes the Intangible Assets UI so the score breakdown, charts, and average/wealth summary reflect current inputs.
 */
function updateDisplay() {
    updateBreakdown();
    updateCharts();
    updateSummary();
}

/**
 * Compute the arithmetic mean of the slider values referenced by `sliderIds`.
 *
 * Reads the current numeric values from the DOM elements whose IDs are listed in `sliderIds`
 * and returns the average formatted with one decimal place.
 * @returns {string} The average slider score formatted with one decimal place (e.g., "7.5").
 */
function calculateAverageScore() {
    const scores = sliderIds.map(id => parseInt(document.getElementById(id).value));
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

/**
 * Map an average score to a wealth level label.
 * @param {number|string} average - Average score (or numeric string) in the 0–10 range to evaluate.
 * @returns {string} `Outstanding` if average >= 9, `Strong` if average >= 7, `Moderate` if average >= 5, `Developing` otherwise.
 */
function getWealthLevel(average) {
    const avg = parseFloat(average);
    if (avg >= 9) return 'Outstanding';
    if (avg >= 7) return 'Strong';
    if (avg >= 5) return 'Moderate';
    return 'Developing';
}

/**
 * Update the page summary to reflect the current average score and corresponding wealth level.
 *
 * Sets the text of #totalScore and #averageScore to "<average>/10" and sets #category and #wealthLevel
 * to the wealth level label derived from that average.
 */
function updateSummary() {
    const average = calculateAverageScore();
    document.getElementById('totalScore').textContent = average + '/10';
    document.getElementById('category').textContent = getWealthLevel(average);
    document.getElementById('averageScore').textContent = average + '/10';
    document.getElementById('wealthLevel').textContent = getWealthLevel(average);
}

/**
 * Render a score breakdown for each category into the #breakdownDetails element.
 *
 * Reads current slider values and injects HTML that lists each category's score (x/10)
 * and its percentage of a 10-point scale, replacing the existing contents of the
 * element with id "breakdownDetails".
 */
function updateBreakdown() {
    const breakdown = document.getElementById('breakdownDetails');
    const scores = sliderIds.map(id => parseInt(document.getElementById(id).value));

    let html = '<h3>Score Breakdown by Category</h3><div class="breakdown-list">';
    categories.forEach((cat, i) => {
        const percentage = (scores[i] / 10 * 100).toFixed(0);
        html += `
            <div class="breakdown-item">
                <div class="breakdown-label">${cat}</div>
                <div class="breakdown-value">${scores[i]}/10 <span class="breakdown-percent">(${percentage}%)</span></div>
            </div>
        `;
    });
    html += '</div>';

    breakdown.innerHTML = html;
}

/**
 * Render the radar chart for current category scores and make the charts section visible.
 *
 * Updates the charts section display, refreshes the summary, and recreates the Chart.js radar chart
 * using current slider values; any existing chart instance is destroyed before a new one is created.
 */
function updateCharts() {
    const chartsSection = document.getElementById('chartsSection');
    const scores = sliderIds.map(id => parseInt(document.getElementById(id).value));
    
    chartsSection.style.display = 'grid';
    updateSummary();

    const ctx = document.getElementById('radarChart');
    if (!ctx) return;

    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    radarChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'radar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Intangible Wealth Scores',
                data: scores,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#e74c3c',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 2,
                        font: { color: '#bbb', size: 11 }
                    },
                    grid: { color: '#444' },
                    angleLines: { color: '#444' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#fff',
                        font: { size: 12 },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: '#2a2a2a',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#e74c3c',
                    borderWidth: 1
                }
            }
        }
    });
}

/**
 * Show the tab content element with the given id and mark its corresponding tab button active.
 * @param {string} tabName - The id of the tab content element to show; the tab button whose text includes this name (case-insensitive) will also be marked active.
 */
function switchTab(tabName) {
    console.log('switchTab called with', tabName);
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
    try {
        const user = await requireUser();
        if (!user) return;

        initializeSliders();

        const saveBtn = document.getElementById('saveAssessmentBtn');
        const resetBtn = document.getElementById('resetFormBtn');
        const modalOkBtn = document.getElementById('modalOkBtn');
        const tabButtons = document.querySelectorAll('.tab-btn');

        if (saveBtn) saveBtn.addEventListener('click', saveIntangibles);
        if (resetBtn) resetBtn.addEventListener('click', resetForm);
        if (modalOkBtn) modalOkBtn.addEventListener('click', closeModal);
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                if (tabName) switchTab(tabName);
            });
        });
        
        // Load existing data
        await fetchIntangibles();
        
        // Populate form with existing data
        categories.forEach((category, index) => {
            const key = categoryKeys[index];
            const existing = existingIntangibles[key];
            if (existing) {
                document.getElementById(sliderIds[index]).value = existing.score;
                document.getElementById(valueIds[index]).textContent = existing.score;
                document.getElementById(textIds[index]).value = existing.description || '';
            } else {
                // Set defaults
                document.getElementById(sliderIds[index]).value = 5;
                document.getElementById(valueIds[index]).textContent = '5';
                document.getElementById(textIds[index]).value = '';
            }
        });
        
        updateDisplay();
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
});

/**
 * Display the validation modal and set its message.
 * @param {string} message - The text to show inside the modal.
 */
function showModal(message) {
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('validationModal').style.display = 'flex';
}

/**
 * Closes the validation modal by hiding it from view.
 */
function closeModal() {
    document.getElementById('validationModal').style.display = 'none';
}
