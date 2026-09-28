# 前端本地开发启动（Windows PowerShell）

本项目在 `package.json` 中声明 Bun 1.3.9。日常启动使用第二个独立 PowerShell 终端，后端终端继续保持运行。

## 首次准备或锁文件变化后

```powershell
Set-Location "F:\Main\huimu-ai-canvas\web"

$projectRoot = "F:\Main\huimu-ai-canvas"
$bunBin = Join-Path $projectRoot ".local\toolchains\bun-windows-x64"
if (!(Test-Path (Join-Path $bunBin "bun.exe"))) {
    throw "未找到新项目自己的 Bun：$bunBin\bun.exe。请先安装或复制独立工具链。"
}
$env:PATH = $bunBin + ";" + $env:PATH
$env:BUN_INSTALL_CACHE_DIR = Join-Path $projectRoot ".local\cache\bun"

$proxyScript = Join-Path $projectRoot "scripts\windows-proxy.ps1"
if (Test-Path $proxyScript) {
    . $proxyScript
    Import-CanvasWindowsProxy
}

bun --version
bun install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "前端依赖安装失败，请先排查 Bun、锁文件或网络" }
```

便携 Bun 应放在 `F:\Main\huimu-ai-canvas\.local\toolchains\bun-windows-x64`。如果系统 `PATH` 已有兼容版本，也可以直接使用；不要引用其他项目的工具目录。

## 日常启动

```powershell
Set-Location "F:\Main\huimu-ai-canvas\web"

$projectRoot = "F:\Main\huimu-ai-canvas"
$bunBin = Join-Path $projectRoot ".local\toolchains\bun-windows-x64"
if (!(Test-Path (Join-Path $bunBin "bun.exe"))) {
    throw "未找到新项目自己的 Bun：$bunBin\bun.exe。请先安装或复制独立工具链。"
}
$env:PATH = $bunBin + ";" + $env:PATH
$env:BUN_INSTALL_CACHE_DIR = Join-Path $projectRoot ".local\cache\bun"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8080"
$env:VITE_CANVAS_BACKEND_URL = "/api"

bun --bun run dev --host 127.0.0.1 --strictPort
```

前端固定使用 `http://127.0.0.1:3000/`；`/api` 代理到后端 `http://127.0.0.1:8080`。`--strictPort` 会在 3000 被占用时直接报错，不会悄悄换端口。

另开非服务终端可验证前端代理：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health/ready" -TimeoutSec 15 | ConvertTo-Json -Depth 6
```

停止前端：在前端服务终端按 `Ctrl+C`。
