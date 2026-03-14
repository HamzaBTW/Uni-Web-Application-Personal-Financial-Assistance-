// ─── XSS Helper ───
function esc(str) {
    if (str == null) return '—';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML || '—';
}

(async () => {
    // ─── Auth guard ───
    const me = await fetch('/api/me').then(r => r.json()).catch(() => null);
    if (!me || me.error) return window.location.href = '/auth.html';
    document.getElementById('nav-links').style.display = 'flex';

    const formPanel  = document.getElementById('form-panel');
    const formTitle  = document.getElementById('form-title');
    const form       = document.getElementById('policy-form');
    const editIdEl   = document.getElementById('edit-id');
    const tableEl    = document.getElementById('data-table');
    const tbodyEl    = document.getElementById('table-body');
    const emptyEl    = document.getElementById('empty-state');

    function openForm(policy) {
        formPanel.classList.add('open');
        if (policy) {
            formTitle.textContent = 'Edit Policy';
            editIdEl.value = policy.id;
            document.getElementById('policy_type').value   = policy.policy_type || '';
            document.getElementById('provider').value      = policy.provider || '';
            document.getElementById('premium').value       = policy.premium || '';
            document.getElementById('start_date').value    = policy.start_date || '';
            document.getElementById('renewal_date').value  = policy.renewal_date || '';
        } else {
            formTitle.textContent = 'Add Policy';
            editIdEl.value = '';
            form.reset();
        }
    }

    function closeForm() { formPanel.classList.remove('open'); form.reset(); editIdEl.value = ''; }

    async function loadData() {
        const rows = await fetch('/api/protection').then(r => r.json());
        tbodyEl.innerHTML = '';
        if (rows.length === 0) {
            tableEl.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';
        tableEl.style.display = 'table';
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${esc(r.policy_type)}</td>
                <td>${esc(r.provider)}</td>
                <td>${r.premium != null ? '£' + Number(r.premium).toFixed(2) : '—'}</td>
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

    document.getElementById('add-btn').addEventListener('click', () => openForm(null));
    document.getElementById('empty-add-btn').addEventListener('click', () => openForm(null));
    document.getElementById('cancel-btn').addEventListener('click', closeForm);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = new URLSearchParams(new FormData(form)).toString();
        const id = editIdEl.value;
        const url = id ? `/api/protection/${id}/edit` : '/api/protection';
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        closeForm();
        loadData();
    });

    loadData();
})();
