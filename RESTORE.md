# DCC Card Battle — Shared Backup

This is a persistent backup of the **Dungeon Crawler Carl card game** project, kept in
`~/shared/` so it survives AgentSpace/DevSpace loss (the working copy lives in the
non-persistent `/workspace/card-battle`).

**Last synced:** see timestamp in `BACKUP_INFO.txt`.

## What's here
A full mirror of `/workspace/card-battle` **except** `node_modules` (regenerable) — including:
- All source (`src/`), client (`public/` incl. 182 card art PNGs + audio), data (`data/`), tools (`tools/`)
- All docs: `CONTEXT.md` (master state), `BACKLOG.md`, `BALANCE_REPORT.md`, resources
- Full git history (`.git/`)

The live save file is separately at `~/shared/dcc-save.json`.

## How to restore into a fresh space
```bash
# 1. Copy the backup into the workspace
mkdir -p /workspace/card-battle
rsync -a ~/shared/dcc-card-battle/ /workspace/card-battle/

# 2. Reinstall dependencies
cd /workspace/card-battle && npm install

# 3. Start the server
node server.js > server.log 2>&1 &
# Open via the DevSpaces Connect button (port 3000)
```
Git history is intact, so `git log`, `git checkout`, etc. all work after restore.

## Keeping this backup current
Run the sync script after major changes:
```bash
cd /workspace/card-battle && bash tools/backup-to-shared.sh
```
The agent runs this automatically after major milestones.

## Quick orientation (read these first after a restore)
1. `CONTEXT.md` — full game state, mechanics, how to run, file map
2. `BACKLOG.md` — what's done and what's next
3. `BALANCE_REPORT.md` — latest balance-tester output
