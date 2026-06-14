import { createServer } from "node:http";
import * as Y from "yjs";
import { WebSocketServer, type WebSocket } from "ws";
import { resolveJoinAuth } from "@paytm-craft/api/auth/resolveAuth";
import { apiTokenAllowsRealtimeWrite } from "@paytm-craft/api/auth/apiTokenScope";
import type { ApiTokenScope } from "@paytm-craft/api/auth/apiTokenScope";
import type { ApiTokenResourceScope } from "@paytm-craft/api/auth/apiTokenResourceScope";
import { isSyncAnonAllowed, validateCraftSyncConfig } from "./config.js";
import { onLoadDocument, onStoreDocument } from "./persistence.js";
import { clearPresence, setPresence } from "./presence.js";
import { base64ToUint8, fileIdFromRoom, uint8ToBase64 } from "./room.js";

const PORT = Number(process.env.CRAFT_SYNC_PORT ?? 4001);
const PATH = "/yjs";
const DEBOUNCE_MS = Number(process.env.CRAFT_SYNC_DEBOUNCE_MS ?? 3000);

for (const warning of validateCraftSyncConfig()) {
  console.warn(`[craft-realtime] config: ${warning}`);
}

type RoomState = {
  fileId: string;
  doc: Y.Doc;
  sockets: Set<WebSocket>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  loading: Promise<void> | null;
};

const rooms = new Map<string, RoomState>();

function sendJson(socket: WebSocket, message: unknown) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(room: string, message: unknown, except?: WebSocket) {
  const state = rooms.get(room);
  if (!state) return;
  const raw = JSON.stringify(message);
  for (const socket of state.sockets) {
    if (socket !== except && socket.readyState === socket.OPEN) {
      socket.send(raw);
    }
  }
}

function parseMessage(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function schedulePersist(state: RoomState) {
  if (state.persistTimer) clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(() => {
    state.persistTimer = null;
    void onStoreDocument(state.fileId, state.doc).catch((e) => {
      console.error("[craft-realtime] persist failed", state.fileId, e);
    });
  }, DEBOUNCE_MS);
}

async function ensureRoom(room: string): Promise<RoomState | null> {
  const fileId = fileIdFromRoom(room);
  if (!fileId) return null;

  let state = rooms.get(room);
  if (state) return state;

  state = {
    fileId,
    doc: new Y.Doc(),
    sockets: new Set(),
    persistTimer: null,
    loading: null,
  };
  rooms.set(room, state);

  state.loading = (async () => {
    state!.doc = await onLoadDocument(fileId);
  })();
  await state.loading;
  state.loading = null;
  return state;
}

type JoinScope = ApiTokenScope | "full";

type JoinAuth = {
  scope: JoinScope;
  resourceScopes: ApiTokenResourceScope[];
};

async function authorizeJoin(sessionToken: string | undefined): Promise<JoinAuth | null> {
  if (isSyncAnonAllowed()) return { scope: "full", resourceScopes: [] };
  if (!sessionToken) return null;
  const auth = await resolveJoinAuth(sessionToken);
  if (!auth) return null;
  return { scope: auth.scope, resourceScopes: auth.resourceScopes };
}

function joinScopeAllowsWrite(auth: JoinAuth): boolean {
  if (auth.scope === "full") return true;
  return apiTokenAllowsRealtimeWrite(auth.scope, auth.resourceScopes);
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Paytm Craft realtime sync (Postgres-backed)\n");
});

const wss = new WebSocketServer({ server: httpServer, path: PATH });

wss.on("connection", (socket) => {
  let joinedRoom: string | null = null;
  let clientId: string | null = null;
  let joinedFileId: string | null = null;
  let joinAuth: JoinAuth | null = null;

  socket.on("message", (data) => {
    void (async () => {
      const raw = typeof data === "string" ? data : data.toString();
      const message = parseMessage(raw);
      if (!message || typeof message.type !== "string") return;

      if (message.type === "join") {
        if (typeof message.room !== "string" || typeof message.clientId !== "string") return;
        const sessionToken =
          typeof message.sessionToken === "string" ? message.sessionToken : undefined;
        const auth = await authorizeJoin(sessionToken);
        if (!auth) {
          sendJson(socket, { type: "error", code: "UNAUTHORIZED", message: "Sign in required" });
          socket.close();
          return;
        }

        const state = await ensureRoom(message.room);
        if (!state) {
          sendJson(socket, { type: "error", code: "INVALID_ROOM", message: "Invalid room" });
          return;
        }

        joinedRoom = message.room;
        clientId = message.clientId;
        joinedFileId = state.fileId;
        joinAuth = auth;
        state.sockets.add(socket);

        sendJson(socket, {
          type: "sync",
          room: joinedRoom,
          update: uint8ToBase64(Y.encodeStateAsUpdate(state.doc)),
        });
        return;
      }

      if (!joinedRoom || message.room !== joinedRoom) return;
      const state = rooms.get(joinedRoom);
      if (!state) return;

      if (
        (message.type === "sync" || message.type === "awareness") &&
        joinAuth &&
        !joinScopeAllowsWrite(joinAuth)
      ) {
        sendJson(socket, {
          type: "error",
          code: "FORBIDDEN",
          message: "API token is read-only",
        });
        return;
      }

      if (message.type === "sync" && typeof message.update === "string") {
        Y.applyUpdate(state.doc, base64ToUint8(message.update));
        schedulePersist(state);
        broadcast(joinedRoom, message, socket);
        return;
      }

      if (message.type === "awareness" && typeof message.clientId === "string") {
        if (joinedFileId) {
          const payload =
            message.payload && typeof message.payload === "object"
              ? (message.payload as Record<string, unknown>)
              : null;
          await setPresence(joinedFileId, message.clientId, payload);
        }
        broadcast(joinedRoom, message, socket);
      }
    })().catch((e) => console.error("[craft-realtime] message error", e));
  });

  socket.on("close", () => {
    if (!joinedRoom || !clientId) return;
    const state = rooms.get(joinedRoom);
    if (!state) return;
    state.sockets.delete(socket);
    if (joinedFileId) void clearPresence(joinedFileId, clientId);
    broadcast(joinedRoom, {
      type: "awareness",
      room: joinedRoom,
      clientId,
      payload: null,
    });
    if (state.sockets.size === 0) {
      if (state.persistTimer) {
        clearTimeout(state.persistTimer);
        void onStoreDocument(state.fileId, state.doc).catch((e) => {
          console.error("[craft-realtime] final persist failed", state.fileId, e);
        });
      }
      rooms.delete(joinedRoom);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `[craft-realtime] ws://localhost:${PORT}${PATH} (debounce ${DEBOUNCE_MS}ms, anon=${isSyncAnonAllowed() ? "on" : "off"})`,
  );
});
