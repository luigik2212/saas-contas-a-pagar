let currentPage = 1;

function statusBadge(b) {
  if (b.status === 'PAID') return '<span class="badge paid">PAGO</span>';
  const due = String(b.due_date).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (due === today) return '<span class="badge today">HOJE</span>';
  if (due < today) return '<span class="badge overdue">ATRASO</span>';
  return '<span class="badge open">ABERTO</span>';
}

async function loadCategories() {
  const cats = await api('/api/bills/meta/categories');
  const sel = document.getElementById('category_id');
  const fil = document.getElementById('f_category');
  const opts = cats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.innerHTML = '<option value="">Sem categoria</option>' + opts;
  fil.innerHTML = '<option value="">Todas categorias</option>' + opts;
}

async function loadBills(page = 1) {
  currentPage = page;
  const me = await checkAuth();
  if (!me) return;

  const q = new URLSearchParams({
    month: document.getElementById('f_month').value || new Date().toISOString().slice(0, 7),
    status: document.getElementById('f_status').value,
    page: String(page)
  });
  const cat = document.getElementById('f_category').value;
  const search = document.getElementById('f_search').value;
  if (cat) q.set('category_id', cat);
  if (search) q.set('search', search);

  const res = await api(`/api/bills?${q.toString()}`);
  document.getElementById('rows').innerHTML = res.data.map((b) => `
    <tr>
      <td>${b.title}<br><small>${b.category_name || '-'}</small></td>
      <td>${money(b.amount_cents)}</td>
      <td>${String(b.due_date).slice(0, 10)}</td>
      <td>${statusBadge(b)}</td>
      <td class="actions">
        ${b.status === 'OPEN' ? `<button onclick="payBill(${b.id})">Pagar</button>` : `<button class="secondary" onclick="reopenBill(${b.id})">Reabrir</button>`}
        <button class="danger" onclick="deleteBill(${b.id})">Excluir</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('pageInfo').textContent = `Página ${res.pagination.page} / ${Math.max(1, Math.ceil(res.pagination.total / res.pagination.limit))}`;
}

async function createBill(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    amount_cents: Number(document.getElementById('amount_cents').value),
    due_date: document.getElementById('due_date').value,
    notes: document.getElementById('notes').value || null,
    category_id: document.getElementById('category_id').value ? Number(document.getElementById('category_id').value) : null
  };
  await api('/api/bills', { method: 'POST', body: JSON.stringify(payload) });
  e.target.reset();
  await loadBills(1);
}

async function payBill(id) {
  await api(`/api/bills/${id}/pay`, { method: 'POST', body: JSON.stringify({}) });
  await loadBills(currentPage);
}

async function reopenBill(id) {
  await api(`/api/bills/${id}/reopen`, { method: 'POST', body: JSON.stringify({}) });
  await loadBills(currentPage);
}

async function deleteBill(id) {
  if (!confirm('Excluir conta?')) return;
  await api(`/api/bills/${id}`, { method: 'DELETE' });
  await loadBills(currentPage);
}

async function exportCsv() {
  const month = document.getElementById('f_month').value;
  const status = document.getElementById('f_status').value;
  window.open(`/api/export/csv?month=${month}&status=${status}`, '_blank');
}

document.getElementById('billForm').addEventListener('submit', createBill);
document.getElementById('filterBtn').addEventListener('click', () => loadBills(1));
document.getElementById('prevBtn').addEventListener('click', () => loadBills(Math.max(1, currentPage - 1)));
document.getElementById('nextBtn').addEventListener('click', () => loadBills(currentPage + 1));
document.getElementById('exportBtn').addEventListener('click', exportCsv);
document.getElementById('printBtn').addEventListener('click', () => window.open('/pages/print.html', '_blank'));
document.getElementById('logoutBtn').addEventListener('click', logout);

(async () => {
  document.getElementById('f_month').value = new Date().toISOString().slice(0, 7);
  await loadCategories();
  await loadBills(1);
})();
