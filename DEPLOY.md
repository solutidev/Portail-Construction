# Production install (Docker + GitHub + Postgres)

Production stores **all business data in Postgres** (Docker service `db`, volume `frx_pgdata`).  
The browser no longer holds users, projects, or invoices. Updating the app image does **not** wipe that volume.

Local App Builder / `npm run dev` still uses PGlite in the browser.

## One-time install

On the server (Docker Engine + Compose plugin):

```bash
sudo git clone --branch main https://github.com/solutidev/Portail-Construction.git /opt/frx-portal
cd /opt/frx-portal
sudo cp .env.example .env
sudo nano .env   # set POSTGRES_PASSWORD and match it in DATABASE_URL
sudo bash scripts/install.sh
```

Open `http://<server>:8080`. The first visit creates the administrator against Postgres.

## Update when GitHub has new commits

```bash
sudo bash /opt/frx-portal/scripts/update.sh
```

That script pulls `main`, rebuilds the app, and leaves the Postgres volume and `.env` untouched.

## Data you will not lose

| What | Where | Survives `update.sh`? |
|---|---|---|
| Users, projects, invoices, ACLs | Postgres volume `frx_pgdata` | Yes |
| SharePoint files | SharePoint | Yes |
| Secrets | `/opt/frx-portal/.env` | Yes (never overwritten) |

## Local production build (no Docker)

Set `DATABASE_URL` to a reachable Postgres instance, then:

```bash
npm ci
npm run build
npm start
```
