"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { canUseRichFastPath } from "@/lib/aiGenerateFastPath";
import { AI_GENERATE_MIN_SKELETON_MS, type AIGenerateJob } from "@/lib/aiGenerateJob";
import { generateDesignFromPromptAsync } from "@/lib/aiMockGenerator";
import { useEditorStore } from "@/stores/useEditorStore";

const FAST_STEPS = [
  "Applying design tokens…",
  "Building high-fidelity layout…",
  "Finishing screen…",
] as const;

const LLM_STEPS = [
  "Calling model…",
  "Parsing layout JSON…",
  "Building canvas…",
] as const;

function stepsForJob(job: AIGenerateJob): readonly string[] {
  return canUseRichFastPath(job) ? FAST_STEPS : LLM_STEPS;
}

function waitForMinSkeleton(queuedAt: number): Promise<void> {
  const remaining = AI_GENERATE_MIN_SKELETON_MS - (Date.now() - queuedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, remaining));
}

/** Runs queued AI jobs — skeleton is applied in queueAIGenerate; this finishes generation. */
export function AIGenerateCanvasController() {
  const router = useRouter();
  const jobSeq = useEditorStore((s) => s.aiGenerateJobSeq);
  const job = useEditorStore((s) => s.aiGenerateJob);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);
  const setAIGenerateStep = useEditorStore((s) => s.setAIGenerateStep);
  const finishAIGenerate = useEditorStore((s) => s.finishAIGenerate);
  const failAIGenerate = useEditorStore((s) => s.failAIGenerate);
  const runningRef = useRef<number | null>(null);

  useEffect(() => {
    if (!job || runningRef.current === job.id) return;
    runningRef.current = job.id;

    let cancelled = false;
    const timers: number[] = [];
    const steps = stepsForJob(job);
    let stepIdx = 0;

    const bumpStep = () => {
      if (cancelled) return;
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setAIGenerateStep(steps[stepIdx]!);
    };

    const scheduleSteps = () => {
      const ms = canUseRichFastPath(job) ? 450 : 1400;
      steps.slice(1).forEach((_, i) => {
        timers.push(window.setTimeout(bumpStep, ms * (i + 1)));
      });
    };

    void (async () => {
      try {
        setAIGenerateStep(job.initialStep || steps[0]!);
        scheduleSteps();

        if (job.source === "dashboard") {
          router.push("/editor");
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        }

        const [gen] = await Promise.all([
          generateDesignFromPromptAsync(job.prompt, {
            preset: job.preset,
            style: job.style,
            model: job.model,
            contextPrompt: job.contextPrompt,
            contextAttachmentCount: job.contextAttachmentCount,
            contextImages: job.contextImages,
          }),
          waitForMinSkeleton(job.queuedAt),
        ]);

        if (cancelled) return;

        await applyGeneratedDesign(gen.slice, "replace", {
          recordHistory: job.source === "editor",
          zoomToFit: true,
        });
        finishAIGenerate();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Generation failed.";
        failAIGenerate(message, job);
      } finally {
        timers.forEach((id) => window.clearTimeout(id));
        if (runningRef.current === job.id) runningRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [
    job,
    jobSeq,
    applyGeneratedDesign,
    setAIGenerateStep,
    finishAIGenerate,
    failAIGenerate,
    router,
  ]);

  return null;
}
