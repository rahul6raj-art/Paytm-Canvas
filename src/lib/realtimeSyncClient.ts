import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import type { PresenceUser } from "@/lib/presence";
import {
  parseRealtimeWireMessage,
  realtimeRoomForFile,
  serializeRealtimeWireMessage,
  type RealtimeAwarenessPayload,
  type RealtimeSyncStatus,
} from "@/lib/realtimeSyncProtocol";
import {
  applyYDocUpdate,
  createDocumentYDoc,
  encodeYDocState,
  observeDocumentYDoc,
  readDocumentFromYDoc,
  writeDocumentToYDoc,
} from "@/lib/yjsDocumentChannel";
import { base64ToUint8, uint8ToBase64 } from "@/lib/yjsWireCodec";

export type RealtimeSyncHandlers = {
  onDocument?: (document: PaytmCraftDocument | null) => void;
  onPresence?: (users: PresenceUser[]) => void;
  onStatus?: (status: RealtimeSyncStatus) => void;
};

type ActiveSession = {
  fileId: string;
  room: string;
  clientId: string;
  socket: WebSocket;
  ydoc: Y.Doc;
  unobserveDoc: () => void;
  peers: Map<string, RealtimeAwarenessPayload>;
  applyingRemote: boolean;
  suppressObserveEmit: boolean;
};

let activeSession: ActiveSession | null = null;
let status: RealtimeSyncStatus = "idle";
const statusListeners = new Set<(s: RealtimeSyncStatus) => void>();

function setStatus(next: RealtimeSyncStatus): void {
  status = next;
  for (const listener of statusListeners) listener(next);
}

export function getRealtimeSyncStatus(): RealtimeSyncStatus {
  return status;
}

export function subscribeRealtimeSyncStatus(listener: (status: RealtimeSyncStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

function awarenessToPresenceUsers(peers: Map<string, RealtimeAwarenessPayload>): PresenceUser[] {
  const now = new Date().toISOString();
  return [...peers.values()].map((p) => ({
    id: p.clientId,
    name: p.name,
    color: p.color,
    cursor: p.cursor ?? { x: 0, y: 0 },
    selectedNodeIds: p.selectedNodeIds ?? [],
    status: p.status ?? "viewing",
    lastSeenAt: now,
  }));
}

function emitPresence(session: ActiveSession, handlers: RealtimeSyncHandlers): void {
  handlers.onPresence?.(awarenessToPresenceUsers(session.peers));
}

function sendAwareness(session: ActiveSession, payload: RealtimeAwarenessPayload | null): void {
  if (session.socket.readyState !== WebSocket.OPEN) return;
  session.socket.send(
    serializeRealtimeWireMessage({
      type: "awareness",
      room: session.room,
      clientId: session.clientId,
      payload,
    }),
  );
}

function sendSyncUpdate(session: ActiveSession, update: Uint8Array): void {
  if (session.socket.readyState !== WebSocket.OPEN) return;
  session.socket.send(
    serializeRealtimeWireMessage({
      type: "sync",
      room: session.room,
      update: uint8ToBase64(update),
    }),
  );
}

function handleSocketMessage(session: ActiveSession, handlers: RealtimeSyncHandlers, data: string): void {
  const message = parseRealtimeWireMessage(data);
  if (!message || message.room !== session.room) return;

  if (message.type === "sync") {
    session.applyingRemote = true;
    try {
      applyYDocUpdate(session.ydoc, base64ToUint8(message.update));
    } finally {
      session.applyingRemote = false;
    }
    return;
  }

  if (message.type === "awareness" && message.clientId !== session.clientId) {
    if (message.payload === null) {
      session.peers.delete(message.clientId);
    } else {
      session.peers.set(message.clientId, message.payload);
    }
    emitPresence(session, handlers);
  }
}

/**
 * Open a Yjs-backed WebSocket session for `fileId`. Returns a disconnect function.
 * Browser-only — no-ops when `window` or `WebSocket` is unavailable.
 */
export function connectRealtimeSync(
  fileId: string,
  syncUrl: string,
  handlers: RealtimeSyncHandlers = {},
): () => void {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    return () => {};
  }

  disconnectRealtimeSync();

  const room = realtimeRoomForFile(fileId);
  const clientId = `client-${Math.random().toString(36).slice(2, 10)}`;
  const ydoc = createDocumentYDoc();
  let socket: WebSocket;

  try {
    socket = new WebSocket(syncUrl);
  } catch (e) {
    console.warn("[Paytm Craft] realtime connect failed", e);
    setStatus("error");
    return () => {};
  }

  const session: ActiveSession = {
    fileId,
    room,
    clientId,
    socket,
    ydoc,
    unobserveDoc: () => {},
    peers: new Map(),
    applyingRemote: false,
    suppressObserveEmit: false,
  };
  activeSession = session;
  setStatus("connecting");
  handlers.onStatus?.("connecting");

  session.unobserveDoc = observeDocumentYDoc(ydoc, (doc) => {
    if (session.suppressObserveEmit) return;
    handlers.onDocument?.(doc);
    if (session.applyingRemote) return;
    sendSyncUpdate(session, encodeYDocState(session.ydoc));
  });

  socket.addEventListener("open", () => {
    setStatus("connected");
    handlers.onStatus?.("connected");
    socket.send(
      serializeRealtimeWireMessage({
        type: "join",
        room,
        clientId,
      }),
    );
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    handleSocketMessage(session, handlers, event.data);
  });

  socket.addEventListener("close", () => {
    if (activeSession === session) {
      setStatus("disconnected");
      handlers.onStatus?.("disconnected");
      activeSession = null;
    }
  });

  socket.addEventListener("error", () => {
    if (activeSession === session) {
      setStatus("error");
      handlers.onStatus?.("error");
    }
  });

  return () => {
    if (activeSession !== session) return;
    sendAwareness(session, null);
    session.unobserveDoc();
    socket.close();
    activeSession = null;
    setStatus("idle");
    handlers.onStatus?.("idle");
  };
}

export function disconnectRealtimeSync(): void {
  if (!activeSession) return;
  const session = activeSession;
  sendAwareness(session, null);
  session.unobserveDoc();
  session.socket.close();
  activeSession = null;
  setStatus("idle");
}

/** Push the current document into the active Yjs room (debounced callers should throttle). */
export function pushRealtimeDocument(document: PaytmCraftDocument): void {
  if (!activeSession) return;
  activeSession.suppressObserveEmit = true;
  try {
    writeDocumentToYDoc(activeSession.ydoc, document);
    sendSyncUpdate(activeSession, encodeYDocState(activeSession.ydoc));
  } finally {
    activeSession.suppressObserveEmit = false;
  }
}

export function publishRealtimeAwareness(payload: RealtimeAwarenessPayload): void {
  if (!activeSession) return;
  sendAwareness(activeSession, payload);
}

export function isRealtimeSyncConnected(): boolean {
  return status === "connected" && activeSession != null;
}
