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
    const form       = document.getElementById('estate-form');
    const editIdEl   = document.getElementById('edit-id');
    const tableEl    = document.getElementById('data-table');
    const tbodyEl    = document.getElementById('table-body');
    const emptyEl    = document.getElementById('empty-state');

    // Status badge with whitelisted class names
    function statusBadge(status) {
        const cls = status === 'complete' ? 'status-complete'
                  : status === 'needs review' ? 'status-review'
                  : 'status-pending';
        return `<span class="status-badge ${cls}">${esc(status)}</span>`;
    }

    function openForm(item) {
        formPanel.classList.add('open');
        if (item) {
            formTitle.textContent = 'Edit Estate Item';
            editIdEl.value = item.id;
            document.getElementById('item_type').value    = item.item_type || '';
            document.getElementById('status').value       = item.status || '';
            document.getElementById('details').value      = item.details || '';
            document.getElementById('contact_info').value = item.contact_info || '';
        } else {
            formTitle.textContent = 'Add Estate Item';
            editIdEl.value = '';
            form.reset();
        }
    }

    function closeForm() { formPanel.classList.remove('open'); form.reset(); editIdEl.value = ''; }

    async function loadData() {
        const rows = await fetch('/api/estate').then(r => r.json());
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
                <td>${esc(r.item_type)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${esc(r.details)}</td>
                <td>${esc(r.contact_info)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-ghost edit-btn">Edit</button>
                    <button class="btn btn-sm btn-danger del-btn">Delete</button>
                </td>`;
            tr.querySelector('.edit-btn').addEventListener('click', () => openForm(r));
            tr.querySelector('.del-btn').addEventListener('click', async () => {
                if (!confirm('Delete this estate item?')) return;
                await fetch(`/api/estate/${r.id}/delete`, { method: 'POST' });
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
        const url = id ? `/api/estate/${id}/edit` : '/api/estate';
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        closeForm();
        loadData();
    });

    loadData();
})();
