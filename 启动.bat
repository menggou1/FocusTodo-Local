@echo off
chcp 65001 >nul
title 专注清单 - 本地服务器
echo.
echo ╔══════════════════════════════════════╗
echo ║       专注清单 FocusTodo 本地版     ║
echo ║     仅限学习研究，24小时内删除      ║
echo ╚══════════════════════════════════════╝
echo.
echo 正在启动本地服务器...

:: 尝试 Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用 Python HTTP 服务器
    echo 请在浏览器打开: http://localhost:8080/index.html
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server 8080
    goto :end
)

:: 尝试 npx http-server
npx --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用 Node.js http-server
    echo 请在浏览器打开: http://localhost:8080/index.html
    echo 按 Ctrl+C 停止服务器
    echo.
    npx http-server -p 8080 -c-1
    goto :end
)

:: 都没找到
echo [错误] 未找到 Python 或 Node.js，请安装其中之一后重试。
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
pause
:end
