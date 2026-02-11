# SaaS Contas a Pagar - Sprint 1 (UI Refactor)

## Rodar em desenvolvimento
1. Instale dependências e configure o banco:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```
2. Edite `backend/.env` com credenciais MySQL e execute schema (`backend/schema.sql`).
3. Suba o app:
   ```bash
   cd backend
   npm run dev
   ```
4. Acesse `http://localhost:3000`.

## Onde ajustar cores e branding
- **Paleta e tokens visuais:** `frontend/public/css/styles.css` (`:root`).
- **Logo / nome do produto no shell:** `frontend/public/js/ui.js` (função `initAppShell`).
- **Páginas públicas (login/print):** `frontend/public/pages/login.html` e `frontend/public/pages/print.html`.

## Sidebar colapsável
- Persistência via `localStorage` na chave `sf_sidebar_collapsed`.
- Implementação em `frontend/public/js/ui.js` (`initAppShell` + `applySidebarState`).
- Desktop: colapsa para ~72px.
- Mobile: vira drawer com botão hamburger e fecha ao navegar/ESC.

## Filtros de Contas (drawer)
- Botão **Filtros** abre drawer lateral (desktop) ou bottom-sheet (mobile).
- Estado de filtros fica em query string (`month`, `status`, `category_id`, `search`) e é reaplicado ao recarregar.
- Ações:
  - **Aplicar**: salva filtros e recarrega lista.
  - **Limpar**: volta para mês atual e status `all`.
