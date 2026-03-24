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

// Fetch intangibles data
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

// Save intangible data
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

// Initialize sliders
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

// Save intangibles assessment
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

// Reset form
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

// Update display
function updateDisplay() {
    updateBreakdown();
    updateCharts();
    updateSummary();
}

// Calculate average score
function calculateAverageScore() {
    const scores = sliderIds.map(id => parseInt(document.getElementById(id).value));
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

// Get wealth level
function getWealthLevel(average) {
    const avg = parseFloat(average);
    if (avg >= 9) return 'Outstanding';
    if (avg >= 7) return 'Strong';
    if (avg >= 5) return 'Moderate';
    return 'Developing';
}

// Update summary
function updateSummary() {
    const average = calculateAverageScore();
    document.getElementById('totalScore').textContent = average + '/10';
    document.getElementById('category').textContent = getWealthLevel(average);
    document.getElementById('averageScore').textContent = average + '/10';
    document.getElementById('wealthLevel').textContent = getWealthLevel(average);
}

// Update breakdown
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

// Update radar chart
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

// Switch tabs
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

// Modal functions
function showModal(message) {
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('validationModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('validationModal').style.display = 'none';
}
