#!/bin/bash
set -e

echo "=== Evolution Api Build========="

cd /home/runner/workspace


#───────────────────────────────────────────Evolution install────────────────

echo "→ Installing evolution-api dependencies..."
cd /home/runner/workspace/evolution-api
npm install 

echo "→ Building evolution ..."
npm run build
echo "→ EvolutionApi built to dist ..."


#───────────────────────────────────────────────Evolution db───────────────

echo "→ Running dbPrisma Migration ..."

export DATABASE_PROVIDER="${DATABASE_PROVIDER:-postgresql}"

echo "→ Generate Prisma client ..."
npm run db:generate

echo "→ Deploy migrations ..."
npm run db:deploy


#──────────────────────────────────────────────Run Evolution Server ──────────


echo "→ Building production app ..."
npm run build

echo "→ Starting production server ..."
npm run start:prod





