import type { RoomCase } from "@/engine/types";
import { room01 } from "./room01-clockmaker";
import { room02 } from "./room02-librarian";
import { room03 } from "./room03-liar";
import { room04 } from "./room04-red-herring";
import { room05 } from "./room05-loop";

export const ROOMS: RoomCase[] = [room01, room02, room03, room04, room05];

export function getRoom(id: string): RoomCase | undefined {
  return ROOMS.find((r) => r.id === id);
}

export { room01, room02, room03, room04, room05 };
