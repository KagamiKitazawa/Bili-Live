import { useEffect, useRef } from "react";
import Hls from "hls.js";
import flvjs from "flv.js";
import type { StreamPayload } from "../api";

interface Props {
  stream: StreamPayload;
  autoPlay?: boolean;
  muted?: boolean;
}

export function RoomPlayer({ stream, autoPlay = true, muted = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    let flv: flvjs.Player | null = null;

    if (stream.protocol === "hls") {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(stream.playUrl);
        hls.attachMedia(video);
      } else {
        video.src = stream.playUrl;
      }
    } else if (stream.protocol === "flv") {
      if (flvjs.isSupported()) {
        flv = flvjs.createPlayer({ type: "flv", url: stream.playUrl, isLive: true });
        flv.attachMediaElement(video);
        flv.load();
      } else {
        console.warn("FLV.js 不支持当前浏览器");
      }
    }

    return () => {
      hls?.destroy();
      flv?.destroy();
    };
  }, [stream.playUrl, stream.protocol]);

  return (
    <div className="player">
      <video
        ref={videoRef}
        poster={stream.cover}
        controls
        playsInline
        autoPlay={autoPlay}
        muted={muted}
      />
      <div className="meta">
        <strong>{stream.title}</strong>
        <span>房间 {stream.roomId}</span>
      </div>
    </div>
  );
}
