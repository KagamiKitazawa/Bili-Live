import dotenv from "dotenv";

dotenv.config();

export const PORT = Number(process.env.PORT) || 4000;
export const BILI_COOKIE = process.env.BILI_COOKIE || "";
export const BILI_USER_AGENT =
  process.env.BILI_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36";
// 默认请求最高画质（原画），除非显式在 .env 中覆盖
export const DEFAULT_QUALITY = Number(process.env.DEFAULT_QUALITY) || 10000;
export const UPTIME_KUMA_URL = process.env.UPTIME_KUMA_URL;
export const UPTIME_KUMA_TOKEN = process.env.UPTIME_KUMA_TOKEN;
export const DEBUG_STREAM = process.env.DEBUG_STREAM === "true";
