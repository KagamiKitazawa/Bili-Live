import { Room } from "./types";
import rooms from "../rooms.json";

export function listRooms(): Room[] {
  return rooms as Room[];
}

export function findRoom(roomId: number): Room | undefined {
  return listRooms().find((room) => room.id === roomId);
}
