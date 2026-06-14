import type { PresenceStatus } from "@/lib/presence";

export type RealtimeSyncStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type RealtimeAwarenessPayload = {
  clientId: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodeIds?: string[];
  status?: PresenceStatus;
};

export type RealtimeWireMessage =
  | { type: "join"; room: string; clientId: string }
  | { type: "sync"; room: string; update: string }
  | { type: "awareness"; room: string; clientId: string; payload: RealtimeAwarenessPayload | null };

export function realtimeRoomForFile(fileId: string): string {
  return `file:${fileId.trim()}`;
}

export function parseRealtimeWireMessage(raw: string): RealtimeWireMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const type = o.type;
    if (type === "join") {
      if (typeof o.room !== "string" || typeof o.clientId !== "string") return null;
      return { type: "join", room: o.room, clientId: o.clientId };
    }
    if (type === "sync") {
      if (typeof o.room !== "string" || typeof o.update !== "string") return null;
      return { type: "sync", room: o.room, update: o.update };
    }
    if (type === "awareness") {
      if (typeof o.room !== "string" || typeof o.clientId !== "string") return null;
      const payload = o.payload;
      if (payload === null) {
        return { type: "awareness", room: o.room, clientId: o.clientId, payload: null };
      }
      if (!payload || typeof payload !== "object") return null;
      const p = payload as Record<string, unknown>;
      if (typeof p.clientId !== "string" || typeof p.name !== "string" || typeof p.color !== "string") {
        return null;
      }
      return {
        type: "awareness",
        room: o.room,
        clientId: o.clientId,
        payload: {
          clientId: p.clientId,
          name: p.name,
          color: p.color,
          cursor:
            p.cursor &&
            typeof p.cursor === "object" &&
            typeof (p.cursor as { x?: unknown }).x === "number" &&
            typeof (p.cursor as { y?: unknown }).y === "number"
              ? { x: (p.cursor as { x: number }).x, y: (p.cursor as { y: number }).y }
              : undefined,
          selectedNodeIds: Array.isArray(p.selectedNodeIds)
            ? p.selectedNodeIds.filter((id): id is string => typeof id === "string")
            : undefined,
          status:
            p.status === "viewing" ||
            p.status === "editing" ||
            p.status === "commenting" ||
            p.status === "idle"
              ? p.status
              : undefined,
        },
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeRealtimeWireMessage(message: RealtimeWireMessage): string {
  return JSON.stringify(message);
}
