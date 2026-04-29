#!/bin/bash

echo "🔄 Force Rebuild Script - Clearing all caches and rebuilding"
echo "============================================================"

# Navigate to frontend directory
cd frontend

echo ""
echo "1️⃣ Removing node_modules/.vite cache..."
rm -rf node_modules/.vite

echo "2️⃣ Removing dist directory..."
rm -rf dist

echo "3️⃣ Clearing Vite cache..."
npx vite --clearScreen false --force

echo ""
echo "✅ Cache cleared! Now restart the dev server:"
echo ""
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "Then hard refresh your browser (Ctrl+Shift+R)"

# Made with Bob
