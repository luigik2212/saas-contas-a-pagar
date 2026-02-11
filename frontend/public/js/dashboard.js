function dashboardCard(title, value, subtitle = '', attrs = '') {
  return `
    <article class="card" ${attrs}>
      <p class="card-title">${title}</p>
      <p class="metric-value">${value}</p>
      ${subtitle ? `<p class="metric-sub">${subtitle}</p>` : ''}
    </article>
  `;
}

function drawChart(canvas, items) {
  const ctx = canvas.getContext('2d');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (!items.length) {
    ctx.fillStyle = '#a9a9c2';
    ctx.fillText('Sem dados no período', 12, 24);
    return;
  }

  const max = Math.max(...items.map((it) => Number(it.total || 0)), 1);
  const stepX = width / Math.max(items.length - 1, 1);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7C3AED';
  ctx.beginPath();

  items.forEach((item, index) => {
    const x = index * stepX;
    const y = height - ((Number(item.total || 0) / max) * (height - 24)) - 12;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

async function loadDashboard() {
  const me = await checkAuth();
  if (!me) return;

  const shell = ui.initAppShell({
    page: 'dashboard',
    title: 'Dashboard',
    actionsHtml: `
      <input type="month" id="month" style="width: 140px;" />
      <a class="btn btn-secondary" href="/pages/contas.html">Ir para Contas</a>
    `
  });
  ui.initModal();
  shell.setUser(me);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  const monthInput = document.getElementById('month');
  const queryMonth = ui.parseQuery().get('month');
  monthInput.value = queryMonth || new Date().toISOString().slice(0, 7);

  async function renderData() {
    ui.updateQuery({ month: monthInput.value });
    const data = await api(`/api/dashboard?month=${monthInput.value}`);

    const diff = data.comparison.diff_percent == null
      ? '—'
      : `${data.comparison.diff_percent > 0 ? '+' : ''}${data.comparison.diff_percent}%`;

    shell.content.innerHTML = `
      <section class="grid grid-4">
        ${dashboardCard('Em aberto', money(data.totals.total_open), 'Contas OPEN')}
        ${dashboardCard('Pago', money(data.totals.total_paid), 'Contas PAID')}
        ${dashboardCard('Atraso', money(data.totals.total_overdue), '', 'id="goOverdue" style="cursor:pointer;"')}
        ${dashboardCard('Vence hoje', String(data.totals.due_today_count), '', 'id="goToday" style="cursor:pointer;"')}
      </section>

      <section class="grid grid-2">
        <article class="card">
          <p class="card-title">Comparação com mês anterior</p>
          <p class="metric-value">${money(data.comparison.diff_value)}</p>
          <p class="metric-sub">Variação: ${diff}</p>
        </article>
        <article class="card">
          <p class="card-title">Próximos vencimentos (Top 5)</p>
          <ul class="list-compact" id="upcomingList"><li class="muted">Carregando...</li></ul>
        </article>
      </section>

      <article class="card">
        <p class="card-title">Somatório por dia</p>
        <div class="chart-wrap"><canvas id="dailyChart"></canvas></div>
      </article>
    `;

    drawChart(document.getElementById('dailyChart'), data.chart);
    document.getElementById('goOverdue')?.addEventListener('click', () => {
      window.location.href = `/pages/contas.html?month=${monthInput.value}&status=overdue`;
    });
    document.getElementById('goToday')?.addEventListener('click', () => {
      window.location.href = `/pages/contas.html?month=${monthInput.value}&status=today`;
    });

    const openBills = await api(`/api/bills?month=${monthInput.value}&status=open&page=1`);
    const topFive = openBills.data.slice(0, 5);
    const list = document.getElementById('upcomingList');
    list.innerHTML = topFive.length
      ? topFive.map((item) => `
          <li class="list-item">
            <div>
              <strong>${ui.escapeHtml(item.title)}</strong>
              <p class="muted">${ui.formatDate(item.due_date)}</p>
            </div>
            <a class="btn btn-secondary" href="/pages/contas.html?month=${monthInput.value}&search=${encodeURIComponent(item.title)}">Ver</a>
          </li>
        `).join('')
      : '<li class="muted">Sem contas em aberto.</li>';
  }

  monthInput.addEventListener('change', renderData);
  await renderData();
}

loadDashboard().catch((err) => ui.toast(err.message, 'error'));
