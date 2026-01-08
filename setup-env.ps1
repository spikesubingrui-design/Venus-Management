# 金星教育系统 - 环境配置脚本
# 运行方式: 右键点击此文件，选择"使用 PowerShell 运行"

$envContent = @"
API_KEY=4af189ab-83aa-4a05-8e97-9104e9a9fcf6
DOUBAO_API_KEY=4af189ab-83aa-4a05-8e97-9104e9a9fcf6
NODE_ENV=development
"@

$envPath = Join-Path $PSScriptRoot ".env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8

Write-Host "✅ .env 文件已创建成功！" -ForegroundColor Green
Write-Host "API Key: 4af189ab-83aa-4a05-8e97-9104e9a9fcf6" -ForegroundColor Cyan
Write-Host ""
Write-Host "现在可以运行: npm run dev 启动开发服务器" -ForegroundColor Yellow
Write-Host ""
Read-Host "按回车键关闭此窗口"




