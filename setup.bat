@echo off
REM One-time setup for Windows: Python packages, .env, database, demo data, Node packages.
REM Start MySQL first (e.g. "Start All" in Laragon), then double-click this file.
setlocal
cd /d "%~dp0"

echo.
echo === 1/5  Backend: Python virtual environment ===
if not exist backend\.venv (
    python -m venv backend\.venv || goto :error
)
backend\.venv\Scripts\python -m pip install --upgrade pip >nul
backend\.venv\Scripts\python -m pip install -q -r backend\requirements.txt || goto :error

echo.
echo === 2/5  Backend: settings file ===
if not exist backend\.env (
    copy backend\.env.example backend\.env >nul
    echo Created backend\.env  ^(edit DATABASE_URL if your MySQL user has a password^)
) else (
    echo backend\.env already exists - keeping it
)

echo.
echo === 3/5  Database tables ===
pushd backend
.venv\Scripts\python -m flask --app run.py init-db || (popd & goto :error)

echo.
echo === 4/5  Demo account and sample documents ===
.venv\Scripts\python -m flask --app run.py seed-demo || (popd & goto :error)
popd

echo.
echo === 5/5  Frontend: Node packages ===
pushd frontend
call npm install || (popd & goto :error)
popd

echo.
echo Setup complete. Run start-dev.bat to launch the app.
echo Demo login: demo@fileai.test / Demo@12345
pause
exit /b 0

:error
echo.
echo Setup stopped because of an error (see the messages above).
echo - Is MySQL running?  - Are Python 3.11+ and Node.js 20+ installed?
pause
exit /b 1
