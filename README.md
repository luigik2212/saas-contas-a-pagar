# SaaS Contas a Pagar - Sprint 1

## 1) Pré-requisitos
- Node.js 18+
- MySQL 8+
- PowerShell (Windows)

## 2) Instalação (PowerShell)
```powershell
cd .\backend
npm install
Copy-Item .env.example .env
```

Edite o arquivo `.env` com credenciais do seu MySQL.

## 3) Criar banco e tabelas
```powershell
# opção 1 (mysql client)
mysql -u root -p < .\schema.sql

# opção 2: copiar e executar o SQL do arquivo backend\schema.sql no seu cliente MySQL
```

## 4) Rodar aplicação
```powershell
cd .\backend
npm run dev
```

O backend serve também o frontend estático.
Abra no navegador: `http://localhost:3000`

## 5) Fluxo
1. Registrar usuário em `/pages/login.html`.
2. Sistema cria categorias padrão por usuário.
3. Usar dashboard e contas.

## Segurança e multiusuário
- Sessões em cookie `httpOnly` com `express-session` + `connect-mysql2`.
- Rotas protegidas em `/api/*` (exceto login/register).
- Isolamento total por `user_id` em tabelas e queries.
- Acesso a recurso de outro usuário retorna `404` por `WHERE id = ? AND user_id = ?`.
