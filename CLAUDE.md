# Mirocard2 — Claude Code Setup

## Runtime host (backend + Caddy)

| Parameter | Value |
|-----------|-------|
| LAN IP | `192.168.1.163` |
| Tailscale IP | `100.124.69.40` |
| Tailscale hostname | `mazpc.taile45e98.ts.net` (Funnel → :8080) |
| SSH port | 22 |
| User | `dmazn` |
| Password | `241078diMA` |
| Project path | `C:/Users/dmazn/Projects/Mirocard2` |
| Frontend dist | `C:/Users/dmazn/Projects/Mirocard2/dist` |
| Backend API | `127.0.0.1:3012` (Caddy reverse-proxies `/api/*`) |
| LAN URL | `http://192.168.1.163:8080/` |
| Public URL | `https://mirocard.kaplieva.help/` |

**НЕ использовать Synology (192.168.1.87) — бекенд давно перенесён на 192.168.1.163.**

## SSH из Python

```python
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.1.163', port=22, username='dmazn', password='241078diMA')
```

## Деплой

```bash
npm run deploy:prod    # сборка + загрузка на 192.168.1.163
npm run deploy:verify  # проверка обоих URL
```

Перед деплоем: `git status --short`, commit, потом скрипт. Dirty worktree без `--allow-dirty` не пройдёт.

Секрет: `.env` (gitignored) с `MIROCARD_DEPLOY_PASSWORD=241078diMA`. Если пропал — восстановить из `.env.example`.

Детали: `DEPLOYMENT.md`.

## Backend (Node.js)

Сервис запущен как Windows Scheduled Task или вручную на 192.168.1.163.
Слушает `127.0.0.1:3012`. Логи смотреть там же через SSH.

## Важно

- Synology (192.168.1.87) — другой проект (SmartCRM), не трогать отсюда
- Два процесса бекенда = конфликт — убивать старые перед запуском нового
- `npm run deploy:verify` должен подтвердить оба URL после каждого деплоя
