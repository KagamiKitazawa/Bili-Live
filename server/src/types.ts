export interface Room {
  id: number;
  title: string;
  anchor: string;
  group?: string;
}

export interface StreamInfo {
  roomId: number;
  title: string;
  cover: string;
  liveStatus: 0 | 1 | 2;
  playUrl: string;
  protocol: "hls" | "flv";
  // 原始最高画质流（通常为 HEVC 高码率），用于 mpv 或转码
  sourceUrl?: string;
  sourceProtocol?: "hls" | "flv";
}

export interface LiveStatusEvent {
  type: "refresh" | "error";
  roomId: number;
  liveStatus?: 0 | 1 | 2;
  message?: string;
}
