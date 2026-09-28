# 后端本地开发启动（Windows PowerShell）

本项目声明 Go 1.25.0，并使用需要 CGO/GCC 的 SQLite 驱动。日常启动保持一个独立 PowerShell 终端；不要在这个终端连接旧项目或外部数据库。

## 首次准备或依赖变化后

```powershell
Set-Location "F:\Main\huimu-ai-canvas\backend"

$projectRoot = "F:\Main\huimu-ai-canvas"
$compilerBin = Join-Path $projectRoot ".local\toolchains\w64devkit\bin"
if (!(Test-Path (Join-Path $compilerBin "gcc.exe"))) {
    throw "未找到新项目自己的 GCC：$compilerBin\gcc.exe。请先安装或复制独立工具链。"
}
$env:PATH = $compilerBin + ";" + $env:PATH

$proxyScript = Join-Path $projectRoot "scripts\windows-proxy.ps1"
if (Test-Path $proxyScript) {
    . $proxyScript
    Import-CanvasWindowsProxy
}

go version
gcc --version

$env:GOPATH = Join-Path $projectRoot ".local\cache\go"
$env:GOMODCACHE = Join-Path $projectRoot ".local\cache\go-mod"
$env:GOCACHE = Join-Path $projectRoot ".local\cache\go-build"
$env:GOTMPDIR = Join-Path $projectRoot ".local\cache\go-tmp"
if ([string]::IsNullOrWhiteSpace($env:GOPROXY)) {
    $env:GOPROXY = "https://goproxy.cn,direct"
}

New-Item -ItemType Directory -Force -Path $env:GOTMPDIR | Out-Null
go mod download
if ($LASTEXITCODE -ne 0) { throw "Go 依赖下载失败，请先排查网络或工具链" }
```

便携 GCC 应放在 `F:\Main\huimu-ai-canvas\.local\toolchains\w64devkit`。如果系统 `PATH` 已有可用 GCC，也可以直接使用；不要引用其他项目的工具目录。

## 日常启动

```powershell
Set-Location "F:\Main\huimu-ai-canvas\backend"

$projectRoot = "F:\Main\huimu-ai-canvas"
$compilerBin = Join-Path $projectRoot ".local\toolchains\w64devkit\bin"
if (!(Test-Path (Join-Path $compilerBin "gcc.exe"))) {
    throw "未找到新项目自己的 GCC：$compilerBin\gcc.exe。请先安装或复制独立工具链。"
}
$env:PATH = $compilerBin + ";" + $env:PATH

$proxyScript = Join-Path $projectRoot "scripts\windows-proxy.ps1"
if (Test-Path $proxyScript) {
    . $proxyScript
    Import-CanvasWindowsProxy
}

$env:CGO_ENABLED = "1"
$env:CC = "gcc"

$env:GOPATH = Join-Path $projectRoot ".local\cache\go"
$env:GOMODCACHE = Join-Path $projectRoot ".local\cache\go-mod"
$env:GOCACHE = Join-Path $projectRoot ".local\cache\go-build"
$env:GOTMPDIR = Join-Path $projectRoot ".local\cache\go-tmp"
if ([string]::IsNullOrWhiteSpace($env:GOPROXY)) {
    $env:GOPROXY = "https://goproxy.cn,direct"
}

$env:CANVAS_BACKEND_DATA_DIR = Join-Path $projectRoot ".local\project-workbench-debug"
$env:CANVAS_BACKEND_ADDR = "127.0.0.1:8080"
$env:CANVAS_DATABASE_DRIVER = "sqlite"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:REDIS_URL -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $env:GOTMPDIR, $env:CANVAS_BACKEND_DATA_DIR | Out-Null
go run ./cmd/server
```

看到 `backend listening on 127.0.0.1:8080` 后保持此终端运行。SQLite 数据库、上传资源、插件运行数据和迁移备份都只写入 `F:\Main\huimu-ai-canvas\.local\project-workbench-debug`。

另开非服务终端可检查就绪状态：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/health/ready" -TimeoutSec 15 | ConvertTo-Json -Depth 6
```

停止后端：在后端服务终端按 `Ctrl+C`，等待 `backend stopped gracefully`。
