@echo off
chcp 65001 >nul
title 金星教育系统 - GitHub Pages 部署

echo.
echo ============================================
echo   金星教育系统 - GitHub Pages 部署工具
echo ============================================
echo.

set "DIST_DIR=%~dp0dist"
set "TEMP_DIR=%TEMP%\gh-pages-deploy"
set "REPO_URL=https://github.com/SpikeSubingrui-design/Venus-Management.git"

:: 检查 dist 目录
if not exist "%DIST_DIR%" (
    echo [!] dist 目录不存在，正在构建...
    call npm run build
    if errorlevel 1 (
        echo.
        echo ❌ 构建失败！
        pause
        exit /b 1
    )
)

echo [1/5] 清理临时目录...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

echo [2/5] 克隆 GitHub 仓库 gh-pages 分支...
git clone --branch gh-pages --single-branch "%REPO_URL%" "%TEMP_DIR%" 2>nul
if errorlevel 1 (
    echo       gh-pages 分支不存在，创建新分支...
    git clone "%REPO_URL%" "%TEMP_DIR%"
    cd /d "%TEMP_DIR%"
    git checkout --orphan gh-pages
    git rm -rf . 2>nul
) else (
    cd /d "%TEMP_DIR%"
)

echo [3/5] 清空旧文件...
for /f "delims=" %%i in ('dir /b /a-d 2^>nul') do if not "%%i"==".git" del /q "%%i"
for /d %%i in (*) do if not "%%i"==".git" rmdir /s /q "%%i"

echo [4/5] 复制新文件...
xcopy "%DIST_DIR%\*" "%TEMP_DIR%\" /E /I /Y /Q

:: 创建 .nojekyll 文件
echo. > "%TEMP_DIR%\.nojekyll"

echo [5/5] 提交并推送...
git add -A
git commit -m "Deploy: %date% %time%"
git push origin gh-pages --force

if errorlevel 1 (
    echo.
    echo ❌ 推送失败！请检查 GitHub 凭据。
) else (
    echo.
    echo ============================================
    echo   ✅ 部署成功！
    echo ============================================
    echo.
    echo 访问地址: https://spikesubingrui-design.github.io/Venus-Management/
    echo.
)

:: 返回原目录
cd /d "%~dp0"

echo.
pause
