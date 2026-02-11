async function loadDashboard() {
  const me = await checkAuth();
  if (!me) return;
  document.getElementById('hello').textContent = `Olá, ${me.name}`;

  const monthInput = document.getElementById('month');
  monthInput.value = monthInput.value || new Date().toISOString().slice(0, 7);
  const data = await api(`/api/dashboard?month=${monthInput.value}`);

  document.getElementById('open').textContent = money(data.totals.total_open);
  document.getElementById('paid').textContent = money(data.totals.total_paid);
  document.getElementById('overdue').textContent = money(data.totals.total_overdue);
  document.getElementById('today').textContent = data.totals.due_today_count;

  const diff = data.comparison.diff_percent == null
    ? 'Sem base no mês anterior'
    : `${money(data.comparison.diff_value)} (${data.comparison.diff_percent}%)`;
  document.getElementById('diff').textContent = diff;

  const list = document.getElementById('chartList');
  list.innerHTML = data.chart.map((item) => `<li>${item.day}: <b>${money(item.total)}</b></li>`).join('');
}

document.getElementById('month').addEventListener('change', loadDashboard);
document.getElementById('logoutBtn').addEventListener('click', logout);
loadDashboard();
