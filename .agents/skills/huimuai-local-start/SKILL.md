---
name: huimuai-local-start
description: 检查并指导当前影策仓库在 Windows PowerShell 中以两个独立终端启动 Go 后端和 Bun 前端；用于本地工具、依赖、隔离数据目录、Vite 代理和健康检查，不用于生产部署或业务迁移。
---

# huimu-ai-canvas 本地启动

以仓库内 [后端 README](../../../backend/README.md) 和 [前端 README](../../../web/README.md) 为日常启动入口。保持用户原有习惯：后端一个 PowerShell 终端，前端一个 PowerShell 终端；不要替换为 Docker、一键脚本或同一终端后台运行。

## 边界

- 先读根 `AGENTS.md` 和两个启动 README。当前任务优先。
- 只处理本地开发环境与启动问题；不要迁移、重构或修改业务功能，不升级依赖或改写锁文件。
- 默认不启动服务。只有用户明确要求启动、预览或联调时才运行，并先检查端口和已有进程。
- 不删除或清空现有数据库、上传文件、浏览器数据、缓存或 `node_modules`。不杀死端口占用进程；先报告进程和冲突。
- 登录凭据由用户自行输入。健康检查不等于登录、生成、上传或其他业务功能已验证。

## 必须保持的数据隔离

仓库根固定为 `F:\Main\huimu-ai-canvas`。以下目录都必须属于本仓库：

- 下载和编译缓存：`F:\Main\huimu-ai-canvas\.local\cache`
- SQLite、上传资源和运行数据：`F:\Main\huimu-ai-canvas\.local\project-workbench-debug`
- 可选便携工具：`F:\Main\huimu-ai-canvas\.local\toolchains`

不得引用其他项目的 `.local`、SQLite、资源或运行目录。宿主机后端必须显式设置 `CANVAS_BACKEND_DATA_DIR`；入口未设置时会退回 `backend/data`，因此不要裸跑 `go run ./cmd/server`。根 `.env.example` 的 `CANVAS_DATA_PATH` 不能代替这个入口变量。

本地 SQLite 模式还应显式设置 `CANVAS_DATABASE_DRIVER=sqlite`，并在当前后端终端清除继承的 `DATABASE_URL` 与 `REDIS_URL`，避免误连外部数据库。只清除当前进程环境变量，不修改系统环境。

## 启动前检查

从仓库根执行只读检查：

1. 确认 `backend/go.mod`、`web/package.json` 和 `web/bun.lock` 存在，并运行 `git status --short`；不覆盖用户已有修改。
2. 读取实际声明和配置，不凭历史版本判断：当前源码声明 Go 1.25.0、Bun 1.3.9；`web/package.json` 的开发端口是 3000，`backend/cmd/server/main.go` 的默认后端端口是 8080，`web/vite.config.ts` 默认把 `/api` 代理到 `http://127.0.0.1:8080`。
3. 检查 `go version`、`bun --version`、`gcc --version`。Windows SQLite 使用 `mattn/go-sqlite3`，所以必须有 CGO 和 GCC；基础启动不要求单独安装 SQLite、PostgreSQL 或 Redis。FFmpeg 只影响相关媒体能力，不能把缺少它误判为基础页面必然无法启动。
4. 优先检查本仓库 `.local/toolchains`，再检查系统 `PATH`。找不到工具时报告缺失，并指导用户从 Go、Bun 或 w64devkit 官方渠道安装到系统或本仓库工具目录；不要临时借用其他项目路径。
5. 检查 8080 和 3000 的监听情况，并检查当前进程是否继承 `CANVAS_BACKEND_DATA_DIR`、`CANVAS_DATABASE_DRIVER`、`DATABASE_URL`、`REDIS_URL`、`VITE_API_PROXY_TARGET`、`VITE_CANVAS_BACKEND_URL`。涉及连接串时只报告“已设置/未设置”，不打印凭据。
6. 用 `git check-ignore -v .local/ web/node_modules/` 确认运行数据和依赖被忽略；发现已跟踪运行数据时只报告，不自动删除。

## 依赖准备

工具可用后，按两个 README 的“首次准备”分别处理：

- 后端在 `backend` 运行 `go mod download`，确认退出码为 0。下载依赖不会创建业务数据库。README 中的 `GOPROXY=https://goproxy.cn` 是本机启动习惯；保留 Go 校验，不关闭 `GOSUMDB`。
- 前端在 `web` 运行 `bun install --frozen-lockfile`。锁文件不一致时停止并解释，不移除 `--frozen-lockfile`，也不改用 npm 或 pnpm。

同类失败连续三次后停止重复尝试，汇总现象、已排除项和下一条诊断假设。

## 两终端启动与验证

1. 后端终端执行 `backend/README.md` 的“日常启动”。成功标志是 `backend listening on 127.0.0.1:8080`。
2. 在非服务终端请求 `http://127.0.0.1:8080/api/health/ready`。要求 HTTP 成功、响应 `code=0`、`data.ready=true`，且数据库、运行时和 schema 检查通过。
3. 前端终端执行 `web/README.md` 的“日常启动”。固定使用 `127.0.0.1:3000` 和 `--strictPort`。
4. 请求 `http://127.0.0.1:3000/api/health/ready`，确认 Vite `/api` 代理可用。浏览器也使用 `http://127.0.0.1:3000/`，不要在同一次验证中混用 `localhost`。
5. 停止时分别在两个服务终端按 `Ctrl+C`；后端等待优雅退出日志。新 PowerShell 终端不会继承之前的进程级变量，需要重新执行对应 README。

交付时分别说明：工具是否可用、依赖是否完成、后端是否就绪、前端是否打开、代理是否通过，以及实际使用的数据目录。没有亲自执行的项目明确写“未验证”。
