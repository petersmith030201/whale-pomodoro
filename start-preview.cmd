@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo Python 3 was not found. Install Python 3 or use another local HTTP server.
  pause
  exit /b 1
)
echo Starting Whale Focus local preview at http://127.0.0.1:4173/
echo Keep this window open while previewing. Press Ctrl+C to stop.
python -c "import functools,http.server,threading,webbrowser; server=http.server.ThreadingHTTPServer(('127.0.0.1',4173),functools.partial(http.server.SimpleHTTPRequestHandler,directory='.')); threading.Timer(0.8,lambda:webbrowser.open('http://127.0.0.1:4173/')).start(); server.serve_forever()"
if errorlevel 1 (
  echo Preview stopped or port 4173 is already in use. See the message above.
  pause
)
endlocal
