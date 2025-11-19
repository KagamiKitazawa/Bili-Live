import type { Room, StreamPayload } from "../api";
import { RoomPlayer } from "./RoomPlayer";

interface Props {
  room: Room;
  stream?: StreamPayload | null;
  status: "live" | "offline" | "loading" | "error";
  onPlay: () => void;
  error?: string;
}

export function RoomCard({ room, stream, status, onPlay, error }: Props) {
  const handleCopyMpv = () => {
    if (!stream) {
      alert("请先刷新流，再复制 mpv 命令");
      return;
    }
    const url = stream.sourceUrl || stream.playUrl;
    const cmd = `mpv "${url}"`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(
        () => alert("已复制 mpv 命令到剪贴板"),
        () => alert("复制失败，可以手动复制：\n" + cmd)
      );
    } else {
      alert("请手动复制 mpv 命令：\n" + cmd);
    }
  };

  const handleOpenHevc = () => {
    if (!stream) {
      alert("请先刷新流，再使用 HEVC 播放");
      return;
    }
    const url = stream.sourceUrl || stream.playUrl;
    window.open(url, "_blank");
  };

  return (
    <div className={`card card-${status}`}>
      <header>
        <div>
          <p className="room-title">{room.title}</p>
          <p className="room-anchor">{room.anchor}</p>
        </div>
        <span className={`badge ${status}`}>{label(status)}</span>
      </header>
      {stream ? (
        <RoomPlayer stream={stream} />
      ) : (
        <div className="placeholder">
          {status === "offline" && <p>未开播</p>}
          {status === "loading" && <p>加载中...</p>}
          {status === "error" && <p>{error || "加载失败"}</p>}
          {status === "live" && <p>等待播放器...</p>}
          <button onClick={onPlay}>刷新</button>
        </div>
      )}
      <div className="controls" style={{ marginTop: "0.5rem", gap: "0.5rem" }}>
        <button onClick={onPlay}>播放 AVC</button>
        <button onClick={handleCopyMpv}>复制 mpv 命令</button>
        <button onClick={handleOpenHevc}>HEVC 播放</button>
      </div>
    </div>
  );
}

function label(status: Props["status"]) {
  switch (status) {
    case "live":
      return "Live";
    case "offline":
      return "Offline";
    case "loading":
      return "Loading";
    case "error":
    default:
      return "Error";
  }
}

