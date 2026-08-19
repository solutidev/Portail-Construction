# Production install (Docker + GitHub)

The portal stores **business data in the browser** (IndexedDB `app-db`).  
Updating the Docker image only replaces the app files. It does **not** wipe users, projects, or SharePoint ACLs.

## One-time install

On the server (Docker Engine + Compose plugin):

```bash
REPO_URL=https://github.com/YOUR_ORG/YOUR_REPO.git \
INSTALL_DIR=/opt/frx-portal \
GIT_BRANCH=main \
bash -c 'curl -fsSL "$REPO_URL/raw/main/scripts/install.sh" | sudo -E bash'
```

Or clone first, then:

```bash
git clone https://github.com/YOUR_ORG/YOUR_REPO.git /opt/frx-portal
cd /opt/frx-portal
cp .env.example .env
# edit .env if you need a different host port
sudo bash scripts/install.sh   # if already cloned, just:
sudo docker compose up -d --build
```

Open `http://<server>:8080`. If the database is empty, create the first administrator.

## Update when GitHub has new commits

```bash
sudo bash /opt/frx-portal/scripts/update.sh
```

That script:

1. `git pull` on the configured branch  
2. Rebuilds and restarts **only** the app container  
3. Leaves `.env` and browser data untouched  

Optional: run it from cron or a GitHub webhook.

## Data you will not lose

| What | Where | Survives `update.sh`? |
|---|---|---|
| Users, projects, invoices, ACLs | Each user’s browser IndexedDB | Yes, same URL / same machine profile |
| SharePoint files | SharePoint | Yes |
| Secrets | `/opt/frx-portal/.env` | Yes (never overwritten) |

**Caveat:** IndexedDB is per browser profile. Clearing site data, a new PC, or a different browser starts empty. Keep an admin account and treat SharePoint as the document system of record.

## Local production build (no Docker)

```bash
npm ci
npm run build
npm start
```

Serves `dist/` and `/api/sharepoint` + `/api/mail/send` on port 3000.
