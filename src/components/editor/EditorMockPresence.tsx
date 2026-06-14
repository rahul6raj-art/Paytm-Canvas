"use client";

import { useEffect, useRef } from "react";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import {
  MOCK_PRESENCE_TEMPLATES,
  collectVisibleNodeIds,
  filterExistingNodeIds,
  topLevelFrameCenters,
  type PresenceStatus,
  type PresenceUser,
} from "@/lib/presence";

const TICK_MS = 320;
const ACTIVITY_GAP_MS = 2800;

function pick<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function statusLabel(s: PresenceStatus): string {
  switch (s) {
    case "viewing":
      return "is viewing";
    case "editing":
      return "is editing";
    case "commenting":
      return "is commenting";
    case "idle":
      return "is idle";
    default:
      return "is here";
  }
}

type Sim = {
  angle: number;
  radius: number;
  speed: number;
  selectedIds: string[];
  status: PresenceStatus;
  frameAnchorIdx: number;
  ticksUntilSel: number;
  ticksUntilStatus: number;
  lastFrameName: string;
};

export function EditorMockPresence() {
  const showPresence = useEditorStore((s) => s.showPresence);
  const realtimeSyncStatus = useEditorStore((s) => s.realtimeSyncStatus);
  const prototypePreview = useEditorStore((s) => s.prototypePreview);
  const documentHydrationRevision = useEditorStore((s) => s.documentHydrationRevision);

  const simsRef = useRef<Sim[]>([]);
  const templateCountRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const bootedRef = useRef(false);

  useEffect(() => {
    bootedRef.current = false;
    simsRef.current = [];
    templateCountRef.current = 0;
  }, [documentHydrationRevision]);

  useEffect(() => {
    if (!showPresence || prototypePreview) return;
    if (realtimeSyncStatus === "connected") return;

    const count = 2 + Math.floor(Math.random() * 3);
    templateCountRef.current = Math.min(count, MOCK_PRESENCE_TEMPLATES.length);
    simsRef.current = Array.from({ length: templateCountRef.current }, (_, i) => ({
      angle: (Math.PI * 2 * i) / templateCountRef.current,
      radius: 85 + i * 38,
      speed: 0.011 + i * 0.0025,
      selectedIds: [],
      status: MOCK_PRESENCE_TEMPLATES[i]!.status,
      frameAnchorIdx: i,
      ticksUntilSel: 8 + i * 3,
      ticksUntilStatus: 40 + i * 11,
      lastFrameName: "",
    }));

    const pushThrottled = (text: string) => {
      const now = Date.now();
      if (now - lastActivityAtRef.current < ACTIVITY_GAP_MS) return;
      lastActivityAtRef.current = now;
      useEditorStore.getState().appendPresenceActivity(text);
    };

    const id = window.setInterval(() => {
      const st = useEditorStore.getState();
      if (!st.showPresence || st.prototypePreview) return;

      const { nodes, childOrder } = st;
      const frames = topLevelFrameCenters(nodes, childOrder, ROOT);
      const pool = collectVisibleNodeIds(nodes, childOrder, ROOT).filter((nid) => nid !== ROOT);

      const fallback = { frameId: "", name: "Canvas", cx: 480, cy: 420 };

      if (!bootedRef.current && templateCountRef.current > 0) {
        bootedRef.current = true;
        const t0 = MOCK_PRESENCE_TEMPLATES[0]!;
        st.appendPresenceActivity(`${t0.name} joined the file`);
        lastActivityAtRef.current = Date.now();
      }

      const templates = MOCK_PRESENCE_TEMPLATES.slice(0, templateCountRef.current);
      const sims = simsRef.current;
      const nowIso = new Date().toISOString();

      const users: PresenceUser[] = templates.map((tpl, i) => {
        const sim = sims[i]!;
        const anchor = frames[sim.frameAnchorIdx % Math.max(frames.length, 1)] ?? fallback;
        sim.angle += sim.speed;
        const wobble = Math.sin(sim.angle * 1.7) * 22;
        const cx = anchor.cx + Math.cos(sim.angle) * sim.radius + wobble;
        const cy = anchor.cy + Math.sin(sim.angle * 0.92) * (sim.radius * 0.62);

        sim.ticksUntilSel -= 1;
        if (sim.ticksUntilSel <= 0 && pool.length > 0) {
          sim.ticksUntilSel = 18 + Math.floor(Math.random() * 28);
          if (Math.random() < 0.55) {
            const nid = pick(pool)!;
            const prev = sim.selectedIds[0];
            sim.selectedIds = [nid];
            if (prev !== nid) {
              const nn = nodes[nid];
              pushThrottled(`${tpl.name} selected ${nn?.name ?? "Layer"}`);
            }
          } else {
            sim.selectedIds = [];
          }
        }

        sim.ticksUntilStatus -= 1;
        if (sim.ticksUntilStatus <= 0) {
          sim.ticksUntilStatus = 55 + Math.floor(Math.random() * 80);
          const statuses: PresenceStatus[] = ["viewing", "editing", "commenting", "idle"];
          const next = pick(statuses)!;
          if (next !== sim.status) {
            sim.status = next;
            pushThrottled(`${tpl.name} ${statusLabel(next)}${anchor.name ? ` · ${anchor.name}` : ""}`);
          }
        }

        if (anchor.name && anchor.name !== sim.lastFrameName && Math.random() < 0.08) {
          sim.lastFrameName = anchor.name;
          pushThrottled(`${tpl.name} is viewing ${anchor.name}`);
        }

        sim.selectedIds = filterExistingNodeIds(sim.selectedIds, nodes);

        return {
          id: tpl.id,
          name: tpl.name,
          avatar: tpl.avatar,
          color: tpl.color,
          cursor: { x: cx, y: cy },
          selectedNodeIds: [...sim.selectedIds],
          status: sim.status,
          lastSeenAt: nowIso,
        } satisfies PresenceUser;
      });

      st.updateMockPresence(users);
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [showPresence, prototypePreview, documentHydrationRevision, realtimeSyncStatus]);

  return null;
}
