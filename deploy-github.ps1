# ============================================
# 金星教育系统 - GitHub Pages 一键部署脚本
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  金星教育系统 - GitHub Pages 部署工具  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 设置变量
$repoName = "Venus-Management"
$githubUser = "SpikeSubingrui-design"
$tempDir = "$env:TEMP\gh-pages-deploy"
$distDir = ".\dist"

# 检查 dist 目录
if (-not (Test-Path $distDir)) {
    Write-Host "[!] dist 目录不存在，正在构建..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 构建失败！" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[1/4] 准备部署目录..." -ForegroundColor Yellow

# 清理临时目录
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# 克隆仓库的 gh-pages 分支
Write-Host "[2/4] 克隆 GitHub 仓库..." -ForegroundColor Yellow
git clone --branch gh-pages --single-branch "https://github.com/$githubUser/$repoName.git" $tempDir 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "      gh-pages 分支不存在，创建新分支..." -ForegroundColor Gray
    git clone "https://github.com/$githubUser/$repoName.git" $tempDir
    Set-Location $tempDir
    git checkout --orphan gh-pages
    git rm -rf . 2>$null
} else {
    Set-Location $tempDir
    # 清空现有文件
    Get-ChildItem -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
}

Write-Host "[3/4] 复制构建文件..." -ForegroundColor Yellow

# 获取原始目录
$originalDir = (Get-Location).Path -replace [regex]::Escape($tempDir), ""
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 复制 dist 内容
Copy-Item -Path "$scriptDir\dist\*" -Destination $tempDir -Recurse -Force

# 创建 .nojekyll 文件（防止 GitHub 忽略下划线开头的文件）
New-Item -ItemType File -Path "$tempDir\.nojekyll" -Force | Out-Null

Write-Host "[4/4] 提交并推送到 GitHub..." -ForegroundColor Yellow

# Git 操作
git add -A
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Deploy: $timestamp"
git push origin gh-pages --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✅ 部署成功！" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "访问地址: https://$githubUser.github.io/$repoName/" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ 推送失败！请检查 GitHub 凭据。" -ForegroundColor Red
}

# 返回原目录
Set-Location $scriptDir

Write-Host ""
