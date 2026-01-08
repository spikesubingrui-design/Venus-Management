@echo off
chcp 65001 >nul
SETLOCAL

ECHO.
ECHO ========================================
ECHO   金星幼儿园管理系统 - GitHub 发布脚本
ECHO ========================================
ECHO.

cd /d "E:\Spike\03_Work_Business\Projects\金星幼儿园\Gemini"

:: 1. 构建生产版本
ECHO [1/4] 正在构建生产版本...
call npm run build
IF %ERRORLEVEL% NEQ 0 (
    ECHO 错误：构建失败！
    PAUSE
    EXIT /B 1
)
ECHO ✓ 构建完成

:: 2. 添加所有文件
ECHO.
ECHO [2/4] 正在添加文件到 Git...
git add .
ECHO ✓ 文件已添加

:: 3. 提交更改
ECHO.
ECHO [3/4] 正在提交更改...
set DATETIME=%DATE:~0,4%-%DATE:~5,2%-%DATE:~8,2% %TIME:~0,2%:%TIME:~3,2%
git commit -m "部署更新: %DATETIME%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO 提示：没有新的更改需要提交
)

:: 4. 推送到 GitHub
ECHO.
ECHO [4/4] 正在推送到 GitHub...
git push origin master
IF %ERRORLEVEL% NEQ 0 (
    ECHO 错误：推送失败！请检查网络连接。
    PAUSE
    EXIT /B 1
)

ECHO.
ECHO ========================================
ECHO   ✅ 发布成功！
ECHO ========================================
ECHO.
ECHO 仓库地址: https://github.com/spikesubingrui-design/Venus-Management
ECHO.
ECHO 如需启用 GitHub Pages:
ECHO   1. 打开仓库 Settings
ECHO   2. 点击 Pages
ECHO   3. Source 选择 "GitHub Actions" 或 "Deploy from a branch"
ECHO.

PAUSE
ENDLOCAL
