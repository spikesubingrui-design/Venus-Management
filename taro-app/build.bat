@echo off
chcp 65001
echo 正在编译小程序...
cd /d "%~dp0"
call npm run dev:weapp
pause
