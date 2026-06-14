"use client";

import { useEffect, useRef } from "react";
import { editorStateToDocument, serializePersistStable } from "@/lib/documentPersistence";
import { getPaytmCraftPublicEnv, isPaytmCraftHttpApiMode, isPaytmCraftRealtimeEnabled } from "@/lib/env";
import {
  connectRealtimeSync,
  disconnectRealtimeSync,
  getRealtimeSyncStatus,
  publishRealtimeAwareness,
  pushRealtimeDocument,
  subscribeRealtimeSyncStatus,
} from "@/lib/realtimeSyncClient";
import { toPersistSlice, useEditorStore } from "@/stores/useEditorStore";

const PUSH_DEBOUNCE_MS = 600;

/**
 * Connects Yjs/WebSocket sync when `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` is set
 * and an API-backed file session is active.
 */
export function EditorRealtimeSync() {
  const apiFileId = useEditorStore((s) => s.apiFileId);
  const isApiBackedFile = useEditorStore((s) => s.isApiBackedFile);
  const showPresence = useEditorStore((s) => s.showPresence);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const pan = useEditorStore((s) => s.pan);
  const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef("");

  const enabled =
    isPaytmCraftHttpApiMode() && isPaytmCraftRealtimeEnabled() && isApiBackedFile && Boolean(apiFileId);

  useEffect(() => {
    if (!enabled || !apiFileId) return;

    const syncUrl = getPaytmCraftPublicEnv().syncUrl;
    const disconnect = connectRealtimeSync(apiFileId, syncUrl, {
      onDocument: (doc) => {
        if (!doc) return;
        useEditorStore.getState().applyPersistedDocumentIfClean(doc);
      },
      onPresence: (users) => {
        if (!useEditorStore.getState().showPresence) return;
        useEditorStore.getState().setPresenceUsers(users);
      },
      onStatus: (status) => {
        useEditorStore.setState({ realtimeSyncStatus: status });
      },
    });

    const unsubStatus = subscribeRealtimeSyncStatus((status) => {
      useEditorStore.setState({ realtimeSyncStatus: status });
    });

    return () => {
      unsubStatus();
      disconnect();
      disconnectRealtimeSync();
      useEditorStore.setState({ realtimeSyncStatus: "idle" });
      if (useEditorStore.getState().showPresence) {
        useEditorStore.getState().clearPresence();
      }
    };
  }, [enabled, apiFileId]);

  useEffect(() => {
    if (!enabled || getRealtimeSyncStatus() !== "connected") return;

    return useEditorStore.subscribe((state, prev) => {
      if (!prev) return;
      if (state.figImportInProgress || state.documentHydrating) return;

      const slice = toPersistSlice(state);
      const fp = serializePersistStable(slice);
      const fpPrev = serializePersistStable(toPersistSlice(prev));
      if (fp === fpPrev || fp === lastPushedRef.current) return;

      if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
      pushDebounceRef.current = setTimeout(() => {
        pushDebounceRef.current = null;
        const live = useEditorStore.getState();
        if (live.figImportInProgress) return;
        const doc = editorStateToDocument(toPersistSlice(live));
        lastPushedRef.current = serializePersistStable(toPersistSlice(live));
        pushRealtimeDocument(doc);
      }, PUSH_DEBOUNCE_MS);
    });
  }, [enabled, apiFileId]);

  useEffect(() => {
    if (!enabled || !showPresence || getRealtimeSyncStatus() !== "connected") return;
    publishRealtimeAwareness({
      clientId: "local-you",
      name: "You",
      color: "#38bdf8",
      cursor: { x: pan.x, y: pan.y },
      selectedNodeIds: selectedIds,
      status: "editing",
    });
  }, [enabled, showPresence, selectedIds, pan.x, pan.y]);

  return null;
}
