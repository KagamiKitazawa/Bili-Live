export interface Room {
  id: number;
  title: string;
  anchor: string;
  group?: string;
}

export interface StreamPayload {
  roomId: number;
  title: string;
  cover: string;
  liveStatus: number;
  playUrl: string;
  protocol: "hls" | "flv";
  sourceUrl?: string;
  sourceProtocol?: "hls" | "flv";
}

export interface LiveEvent {
  type: "refresh" | "error";
  roomId: number;
  liveStatus?: number;
  message?: string;
}

const envBase: string | undefined = import.meta.env.VITE_API_BASE;
const apiBase =
  envBase && envBase !== "/"
    ? envBase.replace(/\/$/, "")
    : "/api";

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(`${apiBase}/rooms`);
  if (!res.ok) throw new Error("无法读取房间列表");
  return res.json();
}

export async function fetchStream(roomId: number): Promise<StreamPayload> {
  const res = await fetch(`${apiBase}/rooms/${roomId}/stream`);
  if (!res.ok) throw new Error("未能获取播放地址");
  return res.json();
}

export function openEvents(onMessage: (event: LiveEvent) => void) {
  const source = new EventSource(`${apiBase}/events`);
  source.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  return () => source.close();
}

