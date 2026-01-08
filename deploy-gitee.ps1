# ============================================
# 金星教育系统 - Gitee 一键部署脚本
# ============================================
# 使用方法: 右键点击此文件 -> "使用 PowerShell 运行"
# 或在终端运行: .\deploy-gitee.ps1
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  金星教育系统 - Gitee 部署工具  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 获取当前时间作为提交信息
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$defaultMessage = "更新: $timestamp"

# 询问提交信息（可选）
Write-Host "[1/5] 请输入提交说明 (直接回车使用默认):" -ForegroundColor Yellow
Write-Host "      默认: $defaultMessage" -ForegroundColor Gray
$commitMessage = Read-Host "      输入"

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = $defaultMessage
}

Write-Host ""
Write-Host "[2/5] 正在构建生产版本..." -ForegroundColor Yellow

# 构建项目
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ 构建失败！请检查错误信息。" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "✅ 构建成功！" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] 添加文件到 Git..." -ForegroundColor Yellow

# Git 操作
git add .

Write-Host ""
Write-Host "[4/5] 提交更改..." -ForegroundColor Yellow
Write-Host "      提交信息: $commitMessage" -ForegroundColor Gray

git commit -m "$commitMessage"

Write-Host ""
Write-Host "[5/5] 推送到 Gitee..." -ForegroundColor Yellow

git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  推送失败，尝试推送到 master 分支..." -ForegroundColor Yellow
    git push origin master
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ 推送失败！请检查：" -ForegroundColor Red
        Write-Host "   1. 是否已配置 Gitee 远程仓库" -ForegroundColor Gray
        Write-Host "   2. 是否有推送权限" -ForegroundColor Gray
        Write-Host "   3. 网络是否正常" -ForegroundColor Gray
        Read-Host "按回车键退出"
        exit 1
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ 部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "提交信息: $commitMessage" -ForegroundColor Cyan
Write-Host ""

# 显示远程仓库地址
Write-Host "远程仓库地址:" -ForegroundColor Yellow
git remote -v

Write-Host ""
Read-Host "按回车键退出"
