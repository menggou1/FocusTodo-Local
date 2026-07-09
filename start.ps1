try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

    $banner = @"
╔══════════════════════════════════════╗
║       专注清单 FocusTodo 本地版      ║
║      仅限学习研究，24小时内删除      ║
╚══════════════════════════════════════╝
"@
    Write-Host ''
    Write-Host $banner
    Write-Host '正在启动本地服务器...'

    if (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host '使用 Python HTTP 服务器'
        Write-Host '请在浏览器打开: http://127.0.0.1:5500/index.html'
        Write-Host '按 Ctrl+C 停止服务器'
        Write-Host ''
        python -m http.server 5500
    }
    elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        Write-Host '使用 Node.js http-server'
        Write-Host '请在浏览器打开: http://127.0.0.1:5500/index.html'
        Write-Host '按 Ctrl+C 停止服务器'
        Write-Host ''
        npx http-server -p 5500 -c-1
    }
    else {
        Write-Host '[错误] 未找到 Python 或 Node.js，请安装其中之一后重试。'
        Write-Host 'Python: https://www.python.org/downloads/'
        Write-Host 'Node.js: https://nodejs.org/'
        Read-Host '按 Enter 退出'
    }
}
catch {
    Write-Host ''
    Write-Host '[错误] 启动失败：' $_.Exception.Message
    Read-Host '按 Enter 退出'
}