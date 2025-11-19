import { Router, Request, Response } from "express";
import EventEmitter from "events";
import { fetchLiveStatus } from "./biliApi";
import { LiveStatusEvent } from "./types";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

function keepAlive(res: Response) {
  res.write(":\n\n");
}

export function createSseRouter() {
  const router = Router();
  router.get("/", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    const listener = (event: LiveStatusEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    emitter.on("live-update", listener);
    const interval = setInterval(() => keepAlive(res), 25000);
    req.on("close", () => {
      clearInterval(interval);
      emitter.off("live-update", listener);
    });
  });
  return router;
}

export function broadcast(event: LiveStatusEvent) {
  emitter.emit("live-update", event);
}

export function startRoomWatcher(roomIds: number[], intervalMs = 60_000) {
  const states = new Map<number, 0 | 1 | 2>();

  const run = async () => {
    for (const id of roomIds) {
      try {
        const status = await fetchLiveStatus(id);
        const prev = states.get(id);
        states.set(id, status);
        if (prev === undefined || prev !== status) {
          broadcast({ type: "refresh", roomId: id, liveStatus: status });
        }
      } catch (error) {
        broadcast({
          type: "error",
          roomId: id,
          message: (error as Error).message
        });
      }
    }
  };

  run();
  setInterval(run, intervalMs);
}
