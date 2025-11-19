# Bili-Live 聚合面板

自建的哔哩哔哩直播聚合平台，后端负责代理官方接口并汇总播放地址，前端提供干净的宫格式播放器。

## 目录结构

```
.
├─ server   # Node.js + Express 后端
└─ web      # Vite + React 前端
```

## 后端 (server)

1. 进入 `server` 目录并配置环境变量：
   ```bash
   cp .env.example .env
   ```
2. 在 `.env` 中写入自己的 `BILI_COOKIE`（需包含 `SESSDATA`、`bili_jct`、`DedeUserID` 等），可按需调整 `DEFAULT_QUALITY`。
3. 编辑 `rooms.json`，填入想聚合的直播房间列表。
4. 安装依赖并启动：
   ```bash
   npm install
   npm run dev
   ```
   生产模式：`npm run build && npm start`。

### API

- `GET /api/rooms`：返回本地配置的房间。
- `GET /api/rooms/:id/stream`：根据 Cookie 请求真实播放地址。
- `GET /api/events`：SSE 推送开播/下播状态。

## 前端 (web)

1. 进入 `web`，安装依赖并启动 Vite：
   ```bash
   npm install
   npm run dev
   ```
2. 默认通过 Vite 代理把 `/api` 指向 `http://localhost:4000`。生产环境可设置 `VITE_API_BASE` 覆盖 API 地址。
3. 构建上线：
   ```bash
   npm run build
   npm run preview
   ```
   将 `dist` 内容部署到任意静态服务器即可。

## 配置与部署建议

- 后端持有登录 Cookie，务必放在受信任的机器，并启用 HTTPS。
- SSE 轮询周期可在 `server/src/sse.ts` 的 `startRoomWatcher` 中调整，或替换为 Uptime-Kuma Webhook。
- 如需容器化，可分别为 `server` 与前端静态资源编写 `Dockerfile`，或自建 `docker-compose.yml`。

## 技术栈

- Backend：Node.js、Express、Axios、Server-Sent Events
- Frontend：React 18、Vite、Hls.js、Flv.js

欢迎扩展录播、弹幕、账号切换等更多功能。
