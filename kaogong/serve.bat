@echo off
rem Kaogong local static server on http://127.0.0.1:8899/
rem NOTE: use serve.py (not `-m http.server`): pythonw.exe has no stderr,
rem and http.server would crash on every request -> browser served a stale
rem offline copy from the service worker cache.
start "" "C:\Users\Administrator\AppData\Local\Programs\Python\Python312\pythonw.exe" "%~dp0serve.py"
exit
