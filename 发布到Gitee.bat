@echo off
chcp 65001 >nul
title 金星教育系统 - 发布到 Gitee
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-gitee.ps1"
