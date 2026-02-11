let currentPage = 1;
let categories = [];
let currentFilters = {
  month: new Date().toISOString().slice(0, 7),
  status: 'all',
  category_id: '',
  search: ''
};

function getStatusBadge(bill) {
  if (bill.status === 'PAID') return '<span class="badge paid">PAID</span>';
  const due = String(bill.due_date).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (due === today) return '<span class="badge today">HOJE</span>';
  if (due < today) return '<span class="badge overdue">ATRASO</span>';
  return '<span class="badge open">OPEN</span>';
}

function getCategoryOptions(selected = '') {
  const options = categories.map((cat) => `<option value="${cat.id}" ${String(selected) === String(cat.id) ? 'selected' : ''}>${ui.escapeHtml(cat.name)}</option>`).join('');
  return `<option value="">Sem categoria</option>${options}`;
}

function syncFilterForm() {
  document.getElementById('f_month').value = currentFilters.month;
  document.getElementById('f_status').value = currentFilters.status;
  document.getElementById('f_category').value = currentFilters.category_id;
  document.getElementById('f_search').value = currentFilters.search;
}

function parseFiltersFromQuery() {
  const query = ui.parseQuery();
  currentFilters.month = query.get('month') || currentFilters.month;
  currentFilters.status = query.get('status') || 'all';
  currentFilters.category_id = query.get('category_id') || '';
  currentFilters.search = query.get('search') || '';
}

function collectFiltersFromForm() {
  currentFilters = {
    month: document.getElementById('f_month').value || new Date().toISOString().slice(0, 7),
    status: document.getElementById('f_status').value,
    category_id: document.getElementById('f_category').value,
    search: document.getElementById('f_search').value.trim()
  };
  ui.updateQuery(currentFilters);
}

async function loadCategories() {
  categories = await api('/api/bills/meta/categories');
  const filterSel = document.getElementById('f_category');
  filterSel.innerHTML = '<option value="">Todas categorias</option>' + categories.map((cat) => `<option value="${cat.id}">${ui.escapeHtml(cat.name)}</option>`).join('');
}

function billModalHtml(bill = null) {
  return `
    <div class="row-2">
      <div>
        <label>Título</label>
        <input name="title" value="${ui.escapeHtml(bill?.title || '')}" required />
      </div>
      <div>
        <label>Valor (centavos)</label>
        <input name="amount_cents" type="number" min="1" value="${bill?.amount_cents || ''}" required />
      </div>
    </div>
    <div class="row-2">
      <div>
        <label>Vencimento</label>
        <input name="due_date" type="date" value="${bill ? String(bill.due_date).slice(0, 10) : ''}" required />
      </div>
      <div>
        <label>Categoria</label>
        <select name="category_id">${getCategoryOptions(bill?.category_id || '')}</select>
      </div>
    </div>
    <div>
      <label>Observações</label>
      <textarea name="notes">${ui.escapeHtml(bill?.notes || '')}</textarea>
    </div>
  `;
}

async function saveBill(formData, billId = null) {
  const payload = {
    title: formData.get('title'),
    amount_cents: Number(formData.get('amount_cents')),
    due_date: formData.get('due_date'),
    notes: formData.get('notes') || null,
    category_id: formData.get('category_id') ? Number(formData.get('category_id')) : null
  };

  if (billId) {
    await api(`/api/bills/${billId}`, { method: 'PUT', body: JSON.stringify(payload) });
    ui.toast('Conta atualizada com sucesso.');
  } else {
    await api('/api/bills', { method: 'POST', body: JSON.stringify(payload) });
    ui.toast('Conta criada com sucesso.');
  }

  ui.closeModal();
  await loadBills(1);
}

async function confirmStatusAction(bill, action) {
  const isPay = action === 'pay';
  const text = isPay ? 'Confirmar pagamento desta conta?' : 'Reabrir esta conta para OPEN?';
  ui.openModal({
    title: isPay ? 'Confirmar pagamento' : 'Reabrir conta',
    submitText: isPay ? 'Confirmar' : 'Reabrir',
    bodyHtml: `
      <p>${text}</p>
      <p class="muted">${new Date().toLocaleString('pt-BR')}</p>
    `,
    onSubmit: async () => {
      if (isPay) await api(`/api/bills/${bill.id}/pay`, { method: 'POST', body: JSON.stringify({}) });
      else await api(`/api/bills/${bill.id}/reopen`, { method: 'POST', body: JSON.stringify({}) });
      ui.closeModal();
      ui.toast('Status alterado com sucesso.');
      await loadBills(currentPage);
    }
  });
}

async function deleteBill(id) {
  ui.openModal({
    title: 'Excluir conta',
    submitText: 'Excluir',
    submitClass: 'btn-danger',
    bodyHtml: '<p>Tem certeza que deseja excluir esta conta?</p>',
    onSubmit: async () => {
      await api(`/api/bills/${id}`, { method: 'DELETE' });
      ui.closeModal();
      ui.toast('Conta excluída.');
      await loadBills(currentPage);
    }
  });
}

function renderRows(data) {
  const tableRows = data.map((bill) => {
    const dropdownId = `bill-${bill.id}`;
    return `
      <tr>
        <td>
          <strong>${ui.escapeHtml(bill.title)}</strong><br />
          <small class="muted">${ui.escapeHtml(bill.category_name || '-')}</small>
        </td>
        <td>${ui.formatDate(bill.due_date)}</td>
        <td>${money(bill.amount_cents)}</td>
        <td>${getStatusBadge(bill)}</td>
        <td class="row-actions">
          <div class="dropdown" data-dropdown="${dropdownId}">
            <button class="icon-btn" type="button" data-dropdown-trigger="${dropdownId}">⋯</button>
            <div class="dropdown-menu">
              <button type="button" data-action="edit" data-id="${bill.id}">Editar</button>
              ${bill.status === 'OPEN'
                ? `<button type="button" data-action="pay" data-id="${bill.id}">Pagar</button>`
                : `<button type="button" data-action="reopen" data-id="${bill.id}">Reabrir</button>`}
              <button type="button" data-action="delete" data-id="${bill.id}">Excluir</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const cards = data.map((bill) => `
    <article class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <div>
          <strong>${ui.escapeHtml(bill.title)}</strong>
          <p class="muted">${ui.escapeHtml(bill.category_name || '-')}</p>
        </div>
        ${getStatusBadge(bill)}
      </div>
      <div class="muted" style="margin:8px 0 12px;">${ui.formatDate(bill.due_date)} • ${money(bill.amount_cents)}</div>
      <div class="row-2">
        <button class="btn btn-secondary" type="button" data-action="edit" data-id="${bill.id}">Editar</button>
        ${bill.status === 'OPEN'
          ? `<button class="btn btn-primary" type="button" data-action="pay" data-id="${bill.id}">Pagar</button>`
          : `<button class="btn btn-secondary" type="button" data-action="reopen" data-id="${bill.id}">Reabrir</button>`}
      </div>
      <button class="btn btn-danger" type="button" data-action="delete" data-id="${bill.id}" style="margin-top:8px;">Excluir</button>
    </article>
  `).join('');

  return { tableRows, cards };
}

async function loadBills(page = 1) {
  currentPage = page;
  const query = new URLSearchParams({ month: currentFilters.month, status: currentFilters.status, page: String(page) });
  if (currentFilters.category_id) query.set('category_id', currentFilters.category_id);
  if (currentFilters.search) query.set('search', currentFilters.search);

  const res = await api(`/api/bills?${query.toString()}`);
  const summary = {
    open: 0,
    paid: 0,
    overdue: 0
  };

  res.data.forEach((bill) => {
    const due = String(bill.due_date).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (bill.status === 'PAID') summary.paid += Number(bill.amount_cents);
    if (bill.status === 'OPEN') {
      summary.open += Number(bill.amount_cents);
      if (due < today) summary.overdue += Number(bill.amount_cents);
    }
  });

  const { tableRows, cards } = renderRows(res.data);
  const totalPages = Math.max(1, Math.ceil(res.pagination.total / res.pagination.limit));

  document.getElementById('contasContent').innerHTML = `
    <section class="summary-strip">
      <div class="summary-item"><span>Aberto</span><strong>${money(summary.open)}</strong></div>
      <div class="summary-item"><span>Pago</span><strong>${money(summary.paid)}</strong></div>
      <div class="summary-item"><span>Atraso</span><strong>${money(summary.overdue)}</strong></div>
    </section>

    <section class="card desktop-table">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>${tableRows || '<tr><td colspan="5" class="muted">Sem resultados.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="pagination">
        <button class="btn btn-secondary" id="prevBtn" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${page} / ${totalPages}</span>
        <button class="btn btn-secondary" id="nextBtn" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
      </div>
    </section>

    <section class="mobile-cards">${cards || '<p class="muted">Sem resultados.</p>'}</section>
  `;

  ui.initDropdowns(document.getElementById('contasContent'));

  document.getElementById('prevBtn')?.addEventListener('click', () => loadBills(Math.max(1, page - 1)));
  document.getElementById('nextBtn')?.addEventListener('click', () => loadBills(Math.min(totalPages, page + 1)));

  document.getElementById('contasContent').querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const action = btn.getAttribute('data-action');
      const bill = res.data.find((item) => item.id === id);
      if (!bill) return;

      if (action === 'edit') {
        ui.openModal({
          title: 'Editar conta',
          bodyHtml: billModalHtml(bill),
          onSubmit: (formData) => saveBill(formData, id)
        });
        return;
      }
      if (action === 'pay' || action === 'reopen') {
        await confirmStatusAction(bill, action);
        return;
      }
      if (action === 'delete') {
        await deleteBill(id);
      }
    });
  });
}

async function init() {
  const me = await checkAuth();
  if (!me) return;

  const shell = ui.initAppShell({
    page: 'contas',
    title: 'Contas',
    actionsHtml: `
      <button class="btn btn-secondary" type="button" data-drawer-open="filters">Filtros</button>
      <div class="dropdown" data-dropdown="more-actions">
        <button class="btn btn-secondary" type="button" data-dropdown-trigger="more-actions">Mais</button>
        <div class="dropdown-menu">
          <button id="exportBtn" type="button">Exportar CSV</button>
          <button id="printBtn" type="button">Imprimir</button>
        </div>
      </div>
      <button class="btn btn-primary" id="newBillBtn" type="button">+ Nova conta</button>
    `
  });

  shell.setUser(me);
  shell.content.innerHTML = '<div id="contasContent" class="grid"></div>';
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  ui.initModal();
  ui.initDrawers();
  ui.initDropdowns(document.body);

  await loadCategories();
  parseFiltersFromQuery();
  syncFilterForm();
  await loadBills(1);

  document.getElementById('newBillBtn').addEventListener('click', () => {
    ui.openModal({
      title: 'Nova conta',
      bodyHtml: billModalHtml(),
      onSubmit: (formData) => saveBill(formData)
    });
  });

  document.getElementById('applyFiltersBtn').addEventListener('click', async () => {
    collectFiltersFromForm();
    ui.closeDrawer('filters');
    await loadBills(1);
  });

  document.getElementById('clearFiltersBtn').addEventListener('click', async () => {
    currentFilters = { month: new Date().toISOString().slice(0, 7), status: 'all', category_id: '', search: '' };
    syncFilterForm();
    ui.updateQuery(currentFilters);
    await loadBills(1);
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const q = new URLSearchParams({ month: currentFilters.month, status: currentFilters.status });
    if (currentFilters.category_id) q.set('category_id', currentFilters.category_id);
    window.open(`/api/export/csv?${q.toString()}`, '_blank');
  });

  document.getElementById('printBtn').addEventListener('click', () => {
    const q = new URLSearchParams({ month: currentFilters.month });
    window.open(`/pages/print.html?${q.toString()}`, '_blank');
  });
}

init().catch((err) => ui.toast(err.message, 'error'));
