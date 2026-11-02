@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.13 或以上版本，然后重新打开此文件。
  pause
  exit /b 1
)
echo 拾光客服即将启动。请保持此窗口打开。
echo 在浏览器访问 http://127.0.0.1:3188
node --env-file-if-exists=.env server/index.mjs
pause
