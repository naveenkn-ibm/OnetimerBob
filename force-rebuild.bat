@echo off
echo 🔄 Force Rebuild Script - Clearing all caches and rebuilding
echo ============================================================

cd frontend

echo.
echo 1️⃣ Removing node_modules\.vite cache...
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo 2️⃣ Removing dist directory...
if exist dist rmdir /s /q dist

echo.
echo ✅ Cache cleared! Now restart the dev server:
echo.
echo    cd frontend
echo    npm run dev
echo.
echo Then hard refresh your browser (Ctrl+Shift+R)
pause

@REM Made with Bob
