# Servaster - Dialplan from Cloudflare

## Project Overview
Node.js/TypeScript project that fetches VoIP dialplan configurations from Cloudflare Workers/KV.

## Architecture
- **Cloudflare Worker** (`worker/`): Serves dialplan configs from Cloudflare KV
- **Client Service** (`src/`): Fetches and applies dialplan from the Worker
- **Shared Types** (`src/types/`): Common TypeScript interfaces

## Tech Stack
- TypeScript
- Cloudflare Workers + KV
- Wrangler CLI for deployment
- Node.js for client service

## Development
- Use `npm run dev` to start the client in dev mode
- Use `npm run worker:dev` to start the Cloudflare Worker locally
- Use `npm run build` to compile TypeScript
