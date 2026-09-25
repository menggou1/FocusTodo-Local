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

    $siteUrl = 'http://127.0.0.1:5500/index.html'

    try {
        Start-Job -ScriptBlock {
            param($url)
            Start-Sleep -Seconds 1
            Start-Process $url
        } -ArgumentList $siteUrl | Out-Null
    }
    catch {
        Write-Host '[提示] 自动打开浏览器失败，将继续启动服务器。'
    }

    if (Get-Command npx -ErrorAction SilentlyContinue) {
        Write-Host '使用 Node.js http-server (缓存已禁用)'
        Write-Host "请在浏览器打开: $siteUrl"
        Write-Host '按 Ctrl+C 停止服务器'
        Write-Host ''
        npx http-server -a 127.0.0.1 -p 5500 -c-1
    }
    elseif (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host '使用 Python HTTP 服务器'
        Write-Host "请在浏览器打开: $siteUrl"
        Write-Host '按 Ctrl+C 停止服务器'
        Write-Host '提示: 修改文件后请用 Ctrl+Shift+R 强制刷新浏览器'
        Write-Host ''
        python -m http.server 5500 --bind 127.0.0.1
    }
    else {
        Write-Host '[错误] 未找到 Node.js 或 Python，请安装其中之一后重试。'
        Write-Host 'Node.js: https://nodejs.org/'
        Write-Host 'Python: https://www.python.org/downloads/'
        Read-Host '按 Enter 退出'
    }
}
catch {
    Write-Host ''
    Write-Host '[错误] 启动失败：' $_.Exception.Message
    Read-Host '按 Enter 退出'
}
