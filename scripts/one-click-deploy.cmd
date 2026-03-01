@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0one-click-deploy.ps1" %*
exit /b %ERRORLEVEL%
