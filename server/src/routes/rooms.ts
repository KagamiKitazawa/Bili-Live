import { Router } from "express";
import { spawn } from "child_process";
import { listRooms, findRoom } from "../rooms"; // 修正：使用 listRooms 和 findRoom
import { fetchStream } from "../biliApi";
import { BILI_USER_AGENT, PORT } from "../config";
import { ensureTranscode } from "../transcode"; // 保留你原有的转码导入

const router = Router();

// 获取房间列表
router.get("/", (_req, res) => {
  res.json(listRooms()); // 修正：调用 listRooms()
});

// --- 新增功能：Emby IPTV M3U 订阅接口 ---
router.get("/iptv.m3u", (req, res) => {
  const rooms = listRooms(); // 修正：调用 listRooms()
  // 获取当前服务器的 host，优先使用请求头中的 host，否则回退到 localhost
  const host = req.headers.host || `localhost:${PORT}`;
  
  let m3u = "#EXTM3U\n";

  rooms.forEach((room) => {
    // 生成 Emby 友好的元数据
    m3u += `#EXTINF:-1 tvg-id="${room.id}" tvg-name="${room.title}" tvg-logo="${room.cover}" group-title="BilibiliLive", ${room.title}\n`;
    // 指向本地的中转流地址
    m3u += `http://${host}/api/rooms/stream/${room.id}\n`;
  });

  res.header("Content-Type", "application/x-mpegurl");
  res.send(m3u);
});

// --- 新增功能：流媒体中转 (Relay) 接口 ---
// 专门用于 Emby 的 MPEG-TS 流
router.get("/stream/:roomId", async (req, res) => {
  const roomId = Number(req.params.roomId);
  
  try {
    console.log(`[Relay] 正在为房间 ${roomId} 建立中转...`);
    // 1. 获取真实的直播流地址
    const info = await fetchStream(roomId);
    const streamUrl = info.sourceUrl; 

    if (!streamUrl) {
      res.status(404).send("Stream not found or offline");
      return;
    }

    // 2. 设置响应头，告诉 Emby 这是一个视频流
    res.header("Content-Type", "video/mp2t");

    // 3. 启动 FFmpeg 进行拉流和封装 (Remux)
    const ffmpeg = spawn("ffmpeg", [
      "-headers",
      `Referer: https://live.bilibili.com/\r\nUser-Agent: ${BILI_USER_AGENT}\r\n`,
      "-i",
      streamUrl,
      "-c",
      "copy", 
      "-f",
      "mpegts",
      "pipe:1",
    ]);

    // 4. 将 FFmpeg 的输出直接通过管道 (Pipe) 发送给 Response
    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on("data", (data) => {
      // 调试时可取消注释
      // console.log(`[FFmpeg Error] ${data}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`[Relay] 房间 ${roomId} 中转结束，退出码: ${code}`);
      res.end();
    });

    // 当客户端（Emby）断开连接时，杀掉 FFmpeg 进程
    req.on("close", () => {
      console.log(`[Relay] 客户端断开连接，停止房间 ${roomId} 的推流`);
      ffmpeg.kill("SIGKILL");
    });

  } catch (error: any) {
    console.error(`[Relay] 房间 ${roomId} 中转失败:`, error.message);
    if (!res.headersSent) {
        res.status(500).send(error.message);
    }
  }
});

// 保留你原有的路由：浏览器直接播放
router.get("/:id/stream", async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    if (!findRoom(roomId)) {
      return res.status(404).json({ message: "房间不存在于本地配置" });
    }
    const info = await fetchStream(roomId);
    res.json(info);
  } catch (error) {
    next(error);
  }
});

// 保留你原有的路由：HLS 转码
router.get("/:id/hls", async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    if (!findRoom(roomId)) {
      return res.status(404).json({ message: "房间不存在于本地配置" });
    }
    const info = await fetchStream(roomId);
    const source = info.sourceUrl || info.playUrl;
    if (!source) {
      return res.status(500).json({ message: "当前房间没有可用的源流地址" });
    }
    const hlsUrl = ensureTranscode(roomId, source);
    res.json({ hlsUrl });
  } catch (error) {
    next(error);
  }
});

export default router;
