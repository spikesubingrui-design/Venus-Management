@echo off
chcp 65001 >nul
title 金星教育系统 - 首次配置 Gitee

echo.
echo ============================================
echo   金星教育系统 - 首次配置 Gitee
echo ============================================
echo.
echo 请输入你的 Gitee 仓库地址
echo 例如: https://gitee.com/username/repo.git
echo.
set /p REPO_URL=仓库地址: 

if "%REPO_URL%"=="" (
    echo.
    echo ❌ 未输入仓库地址，退出。
    pause
    exit /b 1
)

echo.
echo 正在初始化 Git 仓库...
git init

echo.
echo 正在添加远程仓库...
git remote add origin %REPO_URL%

echo.
echo 正在设置默认分支为 main...
git branch -M main

echo.
echo ============================================
echo   ✅ 配置完成！
echo ============================================
echo.
echo 远程仓库已配置为: %REPO_URL%
echo.
echo 现在你可以双击 "发布到Gitee.bat" 来发布项目了！
echo.
pause
