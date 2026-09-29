@echo off
echo Starting NiftyWatch backend...
cd /d "%~dp0backend"
if not exist .venv (
  python -m venv .venv
  call .venv\Scripts\activate
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate
)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
