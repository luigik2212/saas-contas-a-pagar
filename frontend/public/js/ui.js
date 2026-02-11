(function () {
  const SIDEBAR_KEY = 'sf_sidebar_collapsed';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  function parseQuery() {
    return new URLSearchParams(window.location.search);
  }

  function updateQuery(params) {
    const query = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([k, v]) => {
      if (v == null || v === '') query.delete(k);
      else query.set(k, v);
    });
    const next = `${window.location.pathname}?${query.toString()}`.replace(/\?$/, '');
    window.history.replaceState({}, '', next);
  }

  function makeToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function toast(message, type = 'success') {
    const container = makeToastContainer();
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => item.classList.add('show'), 10);
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 200);
    }, 2600);
  }

  function applySidebarState(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }

  function closeMobileSidebar() {
    document.body.classList.remove('mobile-sidebar-open');
  }

  function initAppShell({ page, title, actionsHtml = '' }) {
    const shell = document.querySelector('[data-app-shell]');
    if (!shell) return;

    const active = page === 'contas' ? 'contas' : 'dashboard';
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
    if (window.innerWidth >= 960) applySidebarState(collapsed);

    shell.innerHTML = `
      <aside class="sidebar" aria-label="Menu principal">
        <div class="sidebar-top">
          <a href="/pages/dashboard.html" class="sidebar-brand" aria-label="SaldoFacil">
            <img src="/assets/logo-saldo-facil.svg" alt="SaldoFacil" class="sidebar-logo" />
            <span class="sidebar-brand-text">SaldoFacil</span>
          </a>
          <button class="icon-btn sidebar-toggle" id="sidebarToggle" aria-label="Recolher menu">☰</button>
        </div>
        <nav class="sidebar-nav">
          <a href="/pages/dashboard.html" class="sidebar-link ${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="/pages/contas.html" class="sidebar-link ${active === 'contas' ? 'active' : ''}">Contas</a>
        </nav>
        <footer class="sidebar-footer">
          <div class="sidebar-profile">
            <strong id="shellUserName">—</strong>
            <span id="shellUserEmail">—</span>
          </div>
          <button class="btn btn-secondary" id="logoutBtn" type="button">Sair</button>
        </footer>
      </aside>
      <div class="app-main">
        <header class="app-topbar no-print">
          <div class="topbar-left">
            <button class="icon-btn mobile-menu-btn" id="mobileMenuBtn" aria-label="Abrir menu">☰</button>
            <div>
              <h1>${escapeHtml(title)}</h1>
            </div>
          </div>
          <div class="topbar-actions">${actionsHtml}</div>
        </header>
        <main class="app-content" id="appContent"></main>
      </div>
      <div class="overlay" id="shellOverlay"></div>
    `;

    const toggle = document.getElementById('sidebarToggle');
    toggle?.addEventListener('click', () => {
      const next = !document.body.classList.contains('sidebar-collapsed');
      applySidebarState(next);
    });

    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.body.classList.add('mobile-sidebar-open');
    });

    document.getElementById('shellOverlay')?.addEventListener('click', () => { closeMobileSidebar(); closeAllDrawers(); closeAllDropdowns(); });
    shell.querySelectorAll('.sidebar-link').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 960) closeMobileSidebar();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMobileSidebar();
        closeModal();
        closeAllDrawers();
        closeAllDropdowns();
      }
    });

    return {
      setUser(user) {
        document.getElementById('shellUserName').textContent = user?.name || 'Usuário';
        document.getElementById('shellUserEmail').textContent = user?.email || '';
      },
      content: document.getElementById('appContent')
    };
  }

  function closeAllDropdowns() {
    document.querySelectorAll('[data-dropdown].open').forEach((el) => el.classList.remove('open'));
  }

  function initDropdowns(root = document) {
    root.querySelectorAll('[data-dropdown-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const targetId = trigger.getAttribute('data-dropdown-trigger');
        const parent = document.querySelector(`[data-dropdown="${targetId}"]`);
        if (!parent) return;
        const willOpen = !parent.classList.contains('open');
        closeAllDropdowns();
        if (willOpen) parent.classList.add('open');
      });
    });

    document.addEventListener('click', closeAllDropdowns);
  }

  function initDrawers() {
    document.querySelectorAll('[data-drawer]').forEach((drawer) => {
      const id = drawer.getAttribute('data-drawer');
      const closeBtn = drawer.querySelector('[data-drawer-close]');
      closeBtn?.addEventListener('click', () => closeDrawer(id));
    });

    document.querySelectorAll('[data-drawer-open]').forEach((btn) => {
      btn.addEventListener('click', () => openDrawer(btn.getAttribute('data-drawer-open')));
    });
  }

  function openDrawer(id) {
    const drawer = document.querySelector(`[data-drawer="${id}"]`);
    if (!drawer) return;
    drawer.classList.add('open');
    document.body.classList.add('drawer-open');
    const focusEl = drawer.querySelector('input, select, textarea, button');
    focusEl?.focus();
  }

  function closeDrawer(id) {
    const drawer = document.querySelector(`[data-drawer="${id}"]`);
    if (!drawer) return;
    drawer.classList.remove('open');
    if (!document.querySelector('.drawer.open')) document.body.classList.remove('drawer-open');
  }

  function closeAllDrawers() {
    document.querySelectorAll('.drawer.open').forEach((d) => d.classList.remove('open'));
    document.body.classList.remove('drawer-open');
  }

  function initModal() {
    const modal = document.getElementById('appModal');
    if (!modal) return;
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.hasAttribute('data-modal-close')) {
        closeModal();
      }
    });
  }

  function openModal({ title, bodyHtml, onSubmit, submitText = 'Salvar', submitClass = 'btn-primary' }) {
    const modal = document.getElementById('appModal');
    if (!modal) return;
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="icon-btn" data-modal-close aria-label="Fechar">✕</button>
        </div>
        <form id="appModalForm" class="stack-sm">
          ${bodyHtml}
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
            <button type="submit" class="btn ${submitClass}">${escapeHtml(submitText)}</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add('open');
    document.body.classList.add('modal-open');
    const firstField = modal.querySelector('input,select,textarea,button');
    firstField?.focus();

    const form = document.getElementById('appModalForm');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (onSubmit) await onSubmit(new FormData(form), form);
    });
  }

  function closeModal() {
    const modal = document.getElementById('appModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  window.ui = {
    escapeHtml,
    formatDate,
    parseQuery,
    updateQuery,
    initAppShell,
    initDropdowns,
    initDrawers,
    openDrawer,
    closeDrawer,
    closeAllDrawers,
    openModal,
    closeModal,
    toast,
    closeAllDropdowns,
    initModal
  };
})();
