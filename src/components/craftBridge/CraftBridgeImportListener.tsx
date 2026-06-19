"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEditorStore } from "@/stores/useEditorStore";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import { applyBridgePendingImport } from "@/lib/craftBridge/applyBridgePendingImport";
import { normalizeCodeRoundTripLink } from "@/lib/craftBridge/normalizeLink";
import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";

type PendingResponse = {
  pending: CraftBridgePendingImport | null;
};

const POLL_MS = 2000;

/** Applies CLI/API pending imports on the open Craft editor (poll) or via /editor?bridgeImport=1. */
export function CraftBridgeImportListener() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastConsumedBridgeIdRef = useRef<string | null>(null);
  const consumingRef = useRef(false);
  const setCodeRoundTripSourceHeader = useEditorStore((s) => s.setCodeRoundTripSourceHeader);
  const setCodeRoundTripLink = useEditorStore((s) => s.setCodeRoundTripLink);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const setCraftBridgeInboundActive = useEditorStore((s) => s.setCraftBridgeInboundActive);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);

  const consumePending = useCallback(
    async (source: "route" | "poll" = "route") => {
      if (consumingRef.current) return;

      let pending: CraftBridgePendingImport | null = null;
      try {
        const res = await bridgeFetch("/api/craft-bridge/pending-import");
        if (!res.ok) {
          if (source === "route") {
            setCraftBridgeSyncStatus(
              "error",
              "Could not load pending import. Is Craft running (npm run dev)?",
            );
          }
          return;
        }
        const body = (await res.json()) as PendingResponse;
        pending = body.pending;
        if (!pending?.slice) {
          if (source === "route") {
            setCraftBridgeSyncStatus(
              "error",
              "No pending screen to import. Push again from Cursor (right-click page folder → Push to Craft).",
            );
          }
          return;
        }

        if (source === "route") {
          const routeBridgeId = searchParams.get("bridgeId");
          if (routeBridgeId && routeBridgeId !== pending.id) {
            setCraftBridgeSyncStatus(
              "error",
              "Pending import expired or was replaced. Push again from Cursor.",
            );
            return;
          }
        }

        if (lastConsumedBridgeIdRef.current === pending.id) return;

        consumingRef.current = true;
        setCraftBridgeInboundActive(true);

        const applied = await applyBridgePendingImport(pending);
        if (!applied.ok) {
          lastConsumedBridgeIdRef.current = pending.id;
          setCraftBridgeSyncStatus("error", applied.error);
          return;
        }

        useEditorStore.getState().saveToLocal();

        if (pending.sourceHeader) {
          setCodeRoundTripSourceHeader(pending.sourceHeader);
        }

        try {
          if (pending.link?.sourcePath && pending.link.repoRoot) {
            const nextLink = normalizeCodeRoundTripLink({
              sourcePath: pending.link.sourcePath,
              repoRoot: pending.link.repoRoot,
              cssPaths: pending.link.cssPaths,
              previewUrl: pending.link.previewUrl,
              syncMode: "manual",
              watchSource: false,
            })!;
            setCodeRoundTripLink(nextLink);

            const params = new URLSearchParams({
              repoRoot: nextLink.repoRoot,
              sourcePath: nextLink.sourcePath,
            });
            const readRes = await bridgeFetch(`/api/craft-bridge/read-source?${params}`);
            if (readRes.ok) {
              const read = (await readRes.json()) as { hash?: string };
              if (read.hash) {
                updateCodeRoundTripLink({
                  lastImportedHash: read.hash,
                  lastExportedHash: read.hash,
                });
              }
            }
          }
        } catch {
          /* link/hash seed must not block a successful canvas import */
        }

        const defaultMessage =
          applied.mode === "append"
            ? `Placed screen beside existing canvas (${applied.layerCount} layers).`
            : applied.mode === "replace-root"
              ? `Updated existing screen artboard (${applied.layerCount} layers).`
              : `Imported ${applied.layerCount} layers onto canvas.`;

        setCraftBridgeSyncStatus(
          "synced",
          pending.message?.trim() ? pending.message.trim() : defaultMessage,
        );

        lastConsumedBridgeIdRef.current = pending.id;

        await bridgeFetch("/api/craft-bridge/pending-import", { method: "DELETE" });

        if (source === "route") {
          const next = new URLSearchParams(searchParams.toString());
          next.delete("bridgeImport");
          next.delete("bridgeId");
          const qs = next.toString();
          router.replace(qs ? `/editor?${qs}` : "/editor");
        }
      } catch (e) {
        setCraftBridgeSyncStatus(
          "error",
          e instanceof Error ? e.message : "Bridge import failed.",
        );
      } finally {
        consumingRef.current = false;
        window.setTimeout(() => setCraftBridgeInboundActive(false), 2500);
      }
    },
    [
      router,
      searchParams,
      setCodeRoundTripLink,
      updateCodeRoundTripLink,
      setCodeRoundTripSourceHeader,
      setCraftBridgeInboundActive,
      setCraftBridgeSyncStatus,
    ],
  );

  useEffect(() => {
    if (searchParams.get("bridgeImport") !== "1") return;
    const bridgeId = searchParams.get("bridgeId");
    if (bridgeId && lastConsumedBridgeIdRef.current === bridgeId) return;
    setCraftBridgeInboundActive(true);
    void consumePending("route");
  }, [searchParams, consumePending, setCraftBridgeInboundActive]);

  useEffect(() => {
    const poll = () => {
      if (searchParams.get("bridgeImport") === "1") return;
      if (consumingRef.current) return;
      const st = useEditorStore.getState();
      if (st.documentHydrating || st.craftBridgeInboundActive) return;
      void consumePending("poll");
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [searchParams, consumePending]);

  return null;
}
