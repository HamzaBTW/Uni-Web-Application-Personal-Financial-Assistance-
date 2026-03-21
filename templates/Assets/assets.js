const categories = [
    'Cash & savings',
    'Investments',
    'Property',
    'Vehicles',
    'Valuables'
];

function formatGBP(value) {
    return '\u00A3' + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        .map((category) => `<div class="category-chip"><strong>${escapeHtml(category)}</strong><span>${formatGBP(totalsByCategory[category])}</span></div>`)
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
            <td>${formatGBP(row.value)}</td>
            <td><button class="action-btn" data-id="${Number(row.id)}">Delete</button></td>
        </tr>`;
    }).join('');
}

function renderTotals(rows) {
    const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    const totalAssetsEl = document.getElementById('total-assets');
    const countEl = document.getElementById('asset-count');

    if (totalAssetsEl) totalAssetsEl.textContent = formatGBP(total);
    if (countEl) countEl.textContent = String(rows.length);
}

async function fetchAssets() {
    const response = await fetch('/api/assets');
    if (!response.ok) throw new Error('Failed to fetch assets');
    return response.json();
}

async function refreshAssets() {
    const rows = await fetchAssets();
    renderTotals(rows);
    renderCategoryBreakdown(rows);
    renderRows(rows);
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

        await refreshAssets();

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                setMessage('Saving...');
                try {
                    const formData = Object.fromEntries(new FormData(form).entries());
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

initAssetsPage();
