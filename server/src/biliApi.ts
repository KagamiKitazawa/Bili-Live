import axios from "axios";
import NodeCache from "node-cache";
import crypto from "crypto"; // 新增：用于 MD5 计算
import { BILI_COOKIE, BILI_USER_AGENT, DEFAULT_QUALITY, DEBUG_STREAM } from "./config";
import { StreamInfo } from "./types";

const cache = new NodeCache({ stdTTL: 45 });

// Wbi 签名所需的 Mixin Key 置换表
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
];

const http = axios.create({
  baseURL: "https://api.live.bilibili.com",
  timeout: 10000,
  headers: {
    "User-Agent": BILI_USER_AGENT,
    Cookie: BILI_COOKIE,
    Referer: "https://live.bilibili.com/",
    Origin: "https://live.bilibili.com" // 建议加上 Origin
  }
});

// 另外创建一个用于访问 api.bilibili.com 的实例 (用于获取 nav 信息)
const httpClientApi = axios.create({
  baseURL: "https://api.bilibili.com",
  timeout: 10000,
  headers: {
    "User-Agent": BILI_USER_AGENT,
    Cookie: BILI_COOKIE,
    Referer: "https://www.bilibili.com/"
  }
});

// --- Wbi 签名相关逻辑 Start ---

// 对 imgKey 和 subKey 进行字符顺序混淆
function getMixinKey(orig: string): string {
  let temp = "";
  for (const i of mixinKeyEncTab) {
    if (i < orig.length) {
      temp += orig[i];
    }
  }
  return temp.slice(0, 32);
}

// 缓存 Wbi Keys，避免频繁请求 /nav
let wbiKeysCache: { imgKey: string; subKey: string } | null = null;
let wbiKeysLastUpdate = 0;

async function getWbiKeys() {
  const now = Date.now();
  // 缓存 4 小时 (参考 BililiveRecorder)
  if (wbiKeysCache && now - wbiKeysLastUpdate < 4 * 60 * 60 * 1000) {
    return wbiKeysCache;
  }

  try {
    const { data } = await httpClientApi.get("/x/web-interface/nav");
    if (data.code !== 0) {
      throw new Error(data.message || "获取导航信息失败");
    }

    const wbiImg = data.data?.wbi_img;
    if (!wbiImg) throw new Error("未找到 wbi_img 字段");

    const imgUrl = wbiImg.img_url;
    const subUrl = wbiImg.sub_url;

    const imgKey = imgUrl.substring(
      imgUrl.lastIndexOf("/") + 1,
      imgUrl.lastIndexOf(".")
    );
    const subKey = subUrl.substring(
      subUrl.lastIndexOf("/") + 1,
      subUrl.lastIndexOf(".")
    );

    wbiKeysCache = { imgKey, subKey };
    wbiKeysLastUpdate = now;
    return wbiKeysCache;
  } catch (e) {
    console.error("[biliApi] 获取 Wbi Key 失败:", e);
    // 如果获取失败，尝试返回旧值，或者抛出异常
    if (wbiKeysCache) return wbiKeysCache;
    throw e;
  }
}

// 计算 w_rid 和 wts
async function signWbi(params: Record<string, any>) {
  const keys = await getWbiKeys();
  const mixinKey = getMixinKey(keys.imgKey + keys.subKey);
  const currTime = Math.round(Date.now() / 1000);
  
  // 1. 添加 wts 字段
  const newParams = { ...params, wts: currTime };
  
  // 2. 对参数 key 进行排序
  const sortedKeys = Object.keys(newParams).sort();
  
  // 3. 拼接参数字符串，并过滤特殊字符
  let queryStr = "";
  for (const key of sortedKeys) {
    const value = newParams[key];
    // 过滤逻辑参考 BililiveRecorder (Wbi.cs) 和标准实现
    const safeValue = value.toString().replace(/[!'()*]/g, ""); 
    if (queryStr.length > 0) {
        queryStr += "&";
    }
    queryStr += `${key}=${safeValue}`;
  }

  // 4. 拼接 mixinKey 并计算 MD5
  const strToHash = queryStr + mixinKey;
  const w_rid = crypto.createHash("md5").update(strToHash).digest("hex");

  return {
    ...newParams,
    w_rid
  };
}

// --- Wbi 签名相关逻辑 End ---

async function getRealRoomId(roomId: number): Promise<{
  roomId: number;
  title: string;
  cover: string;
  liveStatus: 0 | 1 | 2;
}> {
  const { data } = await http.get("/room/v1/Room/room_init", {
    params: { id: roomId }
  });

  if (data.code !== 0) {
    throw new Error(data.message || "无法获取房间信息");
  }

  return {
    roomId: data.data.room_id,
    title: data.data.title,
    cover: data.data.keyframe,
    liveStatus: data.data.live_status
  };
}

function parseOriginBitrate(extra: string | undefined): number {
  if (!extra) return 0;
  const match = extra.match(/origin_bitrate=(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseQn(extra: string | undefined): number {
  if (!extra) return 0;
  const match = extra.match(/qn=(\d+)/);
  return match ? Number(match[1]) : 0;
}

interface Candidate {
  protocol: "hls" | "flv";
  url: string;
  codecName: string;
  originBitrate: number;
  qn: number;
}

function selectPlayUrl(play: any) {
  const streams = play?.data?.playurl_info?.playurl?.stream ?? [];
  const candidates: Candidate[] = [];

  for (const stream of streams) {
    const protocolName: string | undefined = stream?.protocol_name;
    const formats = stream?.format ?? [];

    for (const format of formats) {
      const formatName: string | undefined = format?.format_name;

      let protocol: "hls" | "flv";
      if (protocolName === "http_hls" || formatName === "ts" || formatName === "m3u8") {
        protocol = "hls";
      } else {
        protocol = "flv";
      }

      const codecs = format?.codec ?? [];
      for (const codec of codecs) {
        const urlInfo = codec?.url_info?.[0];
        if (!urlInfo) continue;

        const extra: string | undefined = urlInfo.extra;
        const originBitrate = parseOriginBitrate(extra);
        const currentQn: number | undefined =
          typeof codec.current_qn === "number" ? codec.current_qn : undefined;
        const qn = currentQn && currentQn > 0 ? currentQn : parseQn(extra);

        const host: string = urlInfo.host;
        const baseUrl: string = codec.base_url;
        const url = `${host}${baseUrl}${extra || ""}`;
        const codecName: string = (codec.codec_name || "").toString();

        candidates.push({
          protocol,
          url,
          codecName,
          originBitrate,
          qn: Number.isFinite(qn) ? qn : 0
        });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  const sortByBitrateThenQn = (a: Candidate, b: Candidate) => {
    if (a.originBitrate !== b.originBitrate) {
      return b.originBitrate - a.originBitrate;
    }
    if (a.qn !== b.qn) {
      return b.qn - a.qn;
    }
    return 0;
  };

  const avcCandidates = candidates.filter(
    (c) => c.codecName.toLowerCase() !== "hevc"
  );
  const hevcCandidates = candidates.filter(
    (c) => c.codecName.toLowerCase() === "hevc"
  );

  const avcBest = avcCandidates.length ? [...avcCandidates].sort(sortByBitrateThenQn)[0] : undefined;
  const hevcBest = hevcCandidates.length ? [...hevcCandidates].sort(sortByBitrateThenQn)[0] : undefined;

  const browser = avcBest || hevcBest || candidates[0];
  const best = hevcBest || avcBest || candidates[0];

  if (DEBUG_STREAM) {
    console.debug("[biliApi] stream candidates:", candidates);
    console.debug("[biliApi] browser candidate:", browser);
    console.debug("[biliApi] best candidate:", best);
  }

  return {
    browser,
    best
  };
}

export async function fetchStream(roomId: number, qn?: number): Promise<StreamInfo> {
  if (!BILI_COOKIE) {
    throw new Error("服务端缺少 BILI_COOKIE，无法请求哔哩接口");
  }

  const quality = qn || DEFAULT_QUALITY;
  const cacheKey = `${roomId}_${quality}`;
  const cached = cache.get<StreamInfo>(cacheKey);
  if (cached) {
    return cached;
  }

  const meta = await getRealRoomId(roomId);

  // --- 修改开始：使用 Wbi 签名构建参数 ---
  
  const rawParams = {
    room_id: meta.roomId,
    protocol: "0,1",
    format: "0,1,2",
    codec: "0,1,2", // 确保请求 AV1/HEVC/AVC
    qn: quality,
    platform: "web",
    ptype: 8,
    dolby: 5,
    panorama: 1
  };

  // 计算带有 w_rid 和 wts 的参数
  const signedParams = await signWbi(rawParams);

  const { data: play } = await http.get("/xlive/web-room/v2/index/getRoomPlayInfo", {
    params: signedParams
  });

  // --- 修改结束 ---

  if (play.code !== 0) {
    throw new Error(play.message || "无法获取播放地址");
  }

  const selected = selectPlayUrl(play);
  if (!selected) {
    throw new Error("未能解析可用的播放地址");
  }

  const info: StreamInfo = {
    roomId: meta.roomId,
    title: meta.title,
    cover: meta.cover,
    liveStatus: meta.liveStatus,
    // 浏览器默认走 AVC（或退到任意一条）
    playUrl: selected.browser.url,
    protocol: selected.browser.protocol,
    // 源流使用最佳候选（优先 HEVC + 最高码率）
    sourceUrl: selected.best.url,
    sourceProtocol: selected.best.protocol
  };

  if (DEBUG_STREAM) {
    console.debug(
      `[biliApi] room=${roomId} real=${meta.roomId} quality=${quality} browserProtocol=${selected.browser.protocol} browserUrl=${selected.browser.url} bestProtocol=${selected.best.protocol} bestUrl=${selected.best.url}`
    );
  }

  cache.set(cacheKey, info);
  return info;
}

export async function fetchLiveStatus(roomId: number): Promise<0 | 1 | 2> {
  const info = await getRealRoomId(roomId);
  return info.liveStatus;
}
