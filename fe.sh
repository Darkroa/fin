#!/bin/bash
set -e

echo "→ Installing frontend dependencies..."
cd frontend
npm install --legacy-peer-deps

echo "→ Building frontend..."
npm run build

echo "→ Build complete. Output is in frontend/dist"
# Do NOT start a server here. Pages will deploy the dist folder.
