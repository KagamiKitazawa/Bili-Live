import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import roomsRouter from "./routes/rooms";
import { PORT } from "./config";
import { createSseRouter, startRoomWatcher } from "./sse";
import { listRooms } from "./rooms";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// Static HLS output for transcoded streams
app.use("/hls", express.static(path.resolve(process.cwd(), "hls")));

app.use("/api/rooms", roomsRouter);
app.use("/api/events", createSseRouter());

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ message: err.message || "服务器错误" });
  }
);

app.listen(PORT, () => {
  console.log(`Bili aggregator server running on http://localhost:${PORT}`);
  startRoomWatcher(listRooms().map((room) => room.id));
});

