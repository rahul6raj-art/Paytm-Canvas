#!/usr/bin/env node
/**
 * Dev-only Yjs relay for Paytm Craft realtime sync (phase 2.5).
 *
 *   node scripts/mock-yjs-sync-server.mjs
 *   NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=ws://localhost:3001/yjs npm run dev
 */
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { createServer } from "node:http";

const PORT = Number(process.env.PAYTM_CRAFT_SYNC_PORT ?? 3001);
const PATH = "/yjs";

/** @type {Map<string, { doc: import('yjs').Doc, sockets: Set<import('ws').WebSocket> }>} */
const rooms = new Map();

function roomState(room) {
  let state = rooms.get(room);
  if (!state) {
    state = { doc: new Y.Doc(), sockets: new Set() };
    rooms.set(room, state);
  }
  return state;
}

function sendJson(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(room, message, except) {
  const state = rooms.get(room);
  if (!state) return;
  const raw = JSON.stringify(message);
  for (const socket of state.sockets) {
    if (socket !== except && socket.readyState === socket.OPEN) {
      socket.send(raw);
    }
  }
}

function uint8ToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Paytm Craft mock Yjs sync server\n");
});

const wss = new WebSocketServer({ server: httpServer, path: PATH });

wss.on("connection", (socket) => {
  let joinedRoom = null;
  let clientId = null;

  socket.on("message", (data) => {
    const raw = typeof data === "string" ? data : data.toString();
    const message = parseMessage(raw);
    if (!message || typeof message.type !== "string") return;

    if (message.type === "join") {
      if (typeof message.room !== "string" || typeof message.clientId !== "string") return;
      joinedRoom = message.room;
      clientId = message.clientId;
      const state = roomState(joinedRoom);
      state.sockets.add(socket);
      sendJson(socket, {
        type: "sync",
        room: joinedRoom,
        update: uint8ToBase64(Y.encodeStateAsUpdate(state.doc)),
      });
      return;
    }

    if (!joinedRoom || message.room !== joinedRoom) return;

    if (message.type === "sync" && typeof message.update === "string") {
      const state = roomState(joinedRoom);
      Y.applyUpdate(state.doc, base64ToUint8(message.update));
      broadcast(joinedRoom, message, socket);
      return;
    }

    if (message.type === "awareness" && typeof message.clientId === "string") {
      broadcast(joinedRoom, message, socket);
    }
  });

  socket.on("close", () => {
    if (!joinedRoom || !clientId) return;
    const state = rooms.get(joinedRoom);
    if (!state) return;
    state.sockets.delete(socket);
    broadcast(joinedRoom, {
      type: "awareness",
      room: joinedRoom,
      clientId,
      payload: null,
    });
    if (state.sockets.size === 0) {
      rooms.delete(joinedRoom);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[mock-yjs-sync] ws://localhost:${PORT}${PATH}`);
});
