import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRooms, fetchStream, openEvents, type Room, type StreamPayload } from "./api";
import { RoomCard } from "./components/RoomCard";

type StatusState = "live" | "offline" | "loading" | "error";

interface StatusEntry {
  state: StatusState;
  error?: string;
}

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [streams, setStreams] = useState<Record<number, StreamPayload | null>>({});
  const [statusMap, setStatusMap] = useState<Record<number, StatusEntry>>({});
  const [onlyLive, setOnlyLive] = useState(false);

  useEffect(() => {
    fetchRooms().then(setRooms).catch((err) => {
      console.error(err);
    });
  }, []);

  const setStatus = useCallback((roomId: number, state: StatusState, error?: string) => {
    setStatusMap((prev) => ({ ...prev, [roomId]: { state, error } }));
  }, []);

  const requestStream = useCallback(
    async (roomId: number) => {
      setStatus(roomId, "loading");
      try {
        const data = await fetchStream(roomId);
        setStreams((prev) => ({ ...prev, [roomId]: data }));
        setStatus(roomId, "live");
      } catch (error) {
        setStreams((prev) => ({ ...prev, [roomId]: null }));
        setStatus(roomId, "error", (error as Error).message);
      }
    },
    [setStatus]
  );

  useEffect(() => {
    const close = openEvents((event) => {
      if (event.type === "refresh") {
        if (event.liveStatus === 1) {
          requestStream(event.roomId);
        } else {
          setStreams((prev) => ({ ...prev, [event.roomId]: null }));
          setStatus(event.roomId, "offline");
        }
      } else if (event.type === "error") {
        setStatus(event.roomId, "error", event.message);
      }
    });
    return close;
  }, [requestStream, setStatus]);

  useEffect(() => {
    rooms.forEach((room) => {
      requestStream(room.id);
    });
  }, [rooms, requestStream]);

  const filteredRooms = useMemo(() => {
    if (!onlyLive) return rooms;
    return rooms.filter((room) => statusMap[room.id]?.state === "live");
  }, [rooms, statusMap, onlyLive]);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>哔哩直播聚合</h1>
        <div className="controls">
          <label>
            <input
              type="checkbox"
              checked={onlyLive}
              onChange={(e) => setOnlyLive(e.target.checked)}
            />
            仅显示直播中
          </label>
          <button onClick={() => rooms.forEach((room) => requestStream(room.id))}>
            刷新全部
          </button>
        </div>
      </header>
      <div className="grid">
        {filteredRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            stream={streams[room.id]}
            status={statusMap[room.id]?.state || "offline"}
            error={statusMap[room.id]?.error}
            onPlay={() => requestStream(room.id)}
          />
        ))}
      </div>
    </div>
  );
}

