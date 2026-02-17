# Servaster — Asterisk configs from Cloudflare

## Project Overview
Node.js/TypeScript system for centralized Asterisk config management via Cloudflare Workers/KV.
Configs are stored in Cloudflare KV, served via Worker API at `config.sgoip.com`, and pulled by a lightweight polling agent on each server.

## Architecture
- **Cloudflare Worker** (`worker/index.ts`): Multi-config API — stores/serves any `.conf` files per server via KV
- **Client binary** (`src/`): Polls Worker, writes changed configs to disk. Silent when no updates.
- **Shared Types** (`src/types/`): ConfigEntry, ServerAssignment, ServerBundle
- **Upload script** (`scripts/upload-configs.sh`): Bulk upload all `.conf` from a server to Cloudflare

## Key concepts
- `ConfigType` = any string (maps to `{type}.conf` on disk)
- `ServerAssignment` = which config types a server should pull
- `ServerBundle` = all assigned configs for a server in one response
- Versioning per config with conditional fetch (ETag/304)
- Auth via Bearer token on all endpoints (except /health)

## Tech Stack
- TypeScript, Node.js
- Cloudflare Workers + KV
- esbuild for single-file bundle
- Wrangler CLI for deployment
- GitHub Actions for CI/CD

## Development
- `npm run dev` — client in dev mode
- `npm run worker:dev` — Worker locally on :8787
- `npm run bundle` — build `dist/servaster.js`
- `npm run worker:deploy` — deploy Worker to Cloudflare
