@echo off
REM Starts the Flask API (port 5000) and the React app (port 5173) in two windows,
REM then opens the browser. Make sure MySQL is running and setup.bat has been run once.
cd /d "%~dp0"

start "FileAI API (Flask :5000)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python -m flask --app run.py run --port 5000"
start "FileAI Web (React :5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for the servers to start...
timeout /t 6 /nobreak >nul
start "" http://localhost:5173
