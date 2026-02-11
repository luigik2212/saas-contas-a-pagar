(async () => {
  const me = await checkAuth();
  if (!me) return;
  const month = new URLSearchParams(window.location.search).get('month') || new Date().toISOString().slice(0, 7);
  document.getElementById('title').textContent = `Relatório de Contas - ${month}`;

  const res = await api(`/api/bills?month=${month}&status=all&page=1`);
  const rows = res.data.map((b) => `
    <tr>
      <td>${b.title}</td>
      <td>${money(b.amount_cents)}</td>
      <td>${String(b.due_date).slice(0,10)}</td>
      <td>${b.status}</td>
      <td>${b.category_name || '-'}</td>
    </tr>
  `).join('');
  document.getElementById('rows').innerHTML = rows;

  setTimeout(() => window.print(), 400);
})();
