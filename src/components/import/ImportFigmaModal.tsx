"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { verifyFigmaAccessToken } from "@/lib/figmaApi/verifyFigmaConnection";
import { fetchFigmaServerConfig } from "@/lib/figmaApi/figmaServerConfig";
import {
  clearFigmaConnection,
  hasPersistedFigmaAccessToken,
  isFigmaDesignUrl,
  isFigmaTokenInvalidError,
  readFigmaAccessToken,
  readFigmaConnectionProfile,
  writeFigmaAccessToken,
  writeFigmaConnectionProfile,
  type FigmaConnectionProfile,
} from "@/lib/figmaImportConnection";
import { parseFigmaFileKey, parseFigmaUrl } from "@/integrations/figma/parse-figma-url";
import { FigmaLogoMark } from "@/components/import/FigmaLogoMark";
import { cn } from "@/lib/utils";

type ImportFigmaModalProps = {
  onImportFigFile: (file: File) => Promise<void>;
};

type ServerFigmaUser = {
  id: string;
  email: string;
  handle: string;
  imgUrl?: string;
};

function modKeyLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) {
    return "⌘";
  }
  return "Ctrl";
}

function formatFigmaAccountLabel(profile: FigmaConnectionProfile | ServerFigmaUser): string {
  const handle = profile.handle;
  const email = profile.email;
  if (handle && handle !== email.split("@")[0]) {
    return `${handle} (${email})`;
  }
  return email;
}

const fieldClass =
  "h-9 w-full rounded-lg border border-app-border bg-app-field px-3 text-app-field-fg outline-none placeholder:text-app-subtle focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

export function ImportFigmaModal({ onImportFigFile }: ImportFigmaModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const open = useEditorStore((s) => s.importFigmaModalOpen);
  const closeImportFigmaModal = useEditorStore((s) => s.closeImportFigmaModal);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);
  const importFigmaFromLink = useEditorStore((s) => s.importFigmaFromLink);

  const ensureEditorRoute = useCallback(async () => {
    if (!pathname?.startsWith("/editor")) {
      router.push("/editor");
      await waitForNextPaint();
      await waitForNextPaint();
    }
  }, [pathname, router]);

  const [link, setLink] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [personalProfile, setPersonalProfile] = useState<FigmaConnectionProfile | null>(null);
  const [serverTokenConfigured, setServerTokenConfigured] = useState(false);
  const [serverTokenValid, setServerTokenValid] = useState(false);
  const [serverUser, setServerUser] = useState<ServerFigmaUser | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [figFile, setFigFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTokenField, setShowTokenField] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preserveErrorOnOpenRef = useRef(false);
  const figImportInProgress = useEditorStore((s) => s.figImportInProgress);

  const serverTokenReady = serverTokenValid || (serverTokenConfigured && Boolean(serverUser));

  const activeProfile: FigmaConnectionProfile | null =
    personalProfile ??
    (serverTokenReady && serverUser
      ? {
          id: serverUser.id,
          email: serverUser.email,
          handle: serverUser.handle,
          imgUrl: serverUser.imgUrl,
          source: "server",
        }
      : null);

  const hasPersonalConnection = personalProfile?.source === "personal";
  const savedTokenInBrowser = hasPersistedFigmaAccessToken();

  useEffect(() => {
    if (!open) {
      setLink("");
      setFileKey("");
      setFigFile(null);
      setError(null);
      setVerifying(false);
      setShowTokenField(false);
      preserveErrorOnOpenRef.current = false;
      return;
    }

    if (!preserveErrorOnOpenRef.current) setError(null);
    preserveErrorOnOpenRef.current = false;
    const storedProfile = readFigmaConnectionProfile();
    const storedToken = readFigmaAccessToken();
    setPersonalProfile(storedProfile?.source === "personal" ? storedProfile : null);
    setAccessToken("");
    setShowTokenField(!storedToken && !storedProfile);

    void fetchFigmaServerConfig({ force: true }).then((cfg) => {
      setServerTokenConfigured(cfg.serverTokenConfigured);
      setServerTokenValid(cfg.serverTokenValid);
      setServerUser(cfg.serverUser);
    });

    if (storedToken) {
      setVerifying(true);
      void verifyFigmaAccessToken(storedToken)
        .then((user) => {
          writeFigmaAccessToken(storedToken);
          writeFigmaConnectionProfile(user);
          setPersonalProfile(user.source === "personal" ? user : null);
          setShowTokenField(false);
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "Could not verify Figma token.";
          if (isFigmaTokenInvalidError(msg)) {
            clearFigmaConnection();
            setPersonalProfile(null);
            setShowTokenField(true);
            setError("Your saved Figma token expired. Paste a new token and click Verify & connect once.");
          } else {
            if (storedProfile) setPersonalProfile(storedProfile.source === "personal" ? storedProfile : null);
            setError(
              "Could not refresh your Figma connection. Your saved token is still stored — you can try Import.",
            );
          }
        })
        .finally(() => setVerifying(false));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !figImportInProgress && !verifying) {
        e.preventDefault();
        closeImportFigmaModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, figImportInProgress, verifying, closeImportFigmaModal]);

  const onClose = () => {
    if (figImportInProgress || verifying) return;
    closeImportFigmaModal();
  };

  const onUnlinkPersonal = () => {
    clearFigmaConnection();
    setPersonalProfile(null);
    setAccessToken("");
    setError(null);
  };

  const onVerifyAndConnect = async () => {
    setError(null);
    const token = accessToken.trim() || readFigmaAccessToken() || "";
    if (!token && !serverTokenReady) {
      setError("Paste your Figma personal access token first.");
      return;
    }
    setVerifying(true);
    try {
      const user = await verifyFigmaAccessToken(token || undefined);
      if (user.source === "personal" && token) {
        writeFigmaAccessToken(token);
        setAccessToken("");
        setShowTokenField(false);
      }
      writeFigmaConnectionProfile(user);
      setPersonalProfile(user.source === "personal" ? user : null);
      if (user.source === "server") {
        setServerUser({
          id: user.id,
          email: user.email,
          handle: user.handle,
          imgUrl: user.imgUrl,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify Figma token.");
    } finally {
      setVerifying(false);
    }
  };

  const runImport = useCallback(async () => {
    setError(null);

    if (figFile) {
      closeImportFigmaModal();
      useEditorStore.setState({
        figImportInProgress: true,
        figImportStatus: "Opening editor…",
        documentHydrating: false,
      });
      try {
        await ensureEditorRoute();
        await onImportFigFile(figFile);
      } catch (e) {
        preserveErrorOnOpenRef.current = true;
        setError(e instanceof Error ? e.message : "Import failed.");
        openImportFigmaModal();
      }
      return;
    }

    const trimmedLink = link.trim();
    const trimmedKey = fileKey.trim();
    if (!trimmedLink && !trimmedKey) {
      setError("Paste a Figma design link, file key, or choose a .fig file.");
      return;
    }

    if (trimmedLink && !isFigmaDesignUrl(trimmedLink) && !parseFigmaFileKey(trimmedLink)) {
      setError("Enter a valid Figma design link or file key.");
      return;
    }

    const tokenForImport = accessToken.trim() || readFigmaAccessToken() || undefined;
    if (!serverTokenReady && !tokenForImport) {
      setError(
        serverTokenConfigured
          ? "The server Figma token in .env.local is invalid. Paste a new token below and click Verify & connect."
          : "Verify your Figma token below, or set FIGMA_ACCESS_TOKEN in .env.local.",
      );
      return;
    }

    const parsedUrl =
      trimmedLink && isFigmaDesignUrl(trimmedLink) ? parseFigmaUrl(trimmedLink) : null;

    closeImportFigmaModal();
    useEditorStore.setState({
      figImportInProgress: true,
      figImportStatus: "Opening editor…",
      documentHydrating: false,
    });
    try {
      await ensureEditorRoute();
      if (accessToken.trim()) writeFigmaAccessToken(accessToken.trim());
      await importFigmaFromLink({
        accessToken: tokenForImport,
        url: parsedUrl ? trimmedLink : undefined,
        fileKey:
          trimmedKey ||
          parsedUrl?.fileKey ||
          (trimmedLink && !isFigmaDesignUrl(trimmedLink)
            ? (parseFigmaFileKey(trimmedLink) ?? undefined)
            : undefined),
        nodeId: parsedUrl?.nodeId,
      });
    } catch (e) {
      preserveErrorOnOpenRef.current = true;
      setError(e instanceof Error ? e.message : "Figma import failed.");
      openImportFigmaModal();
    }
  }, [
    figFile,
    link,
    fileKey,
    accessToken,
    serverTokenReady,
    onImportFigFile,
    closeImportFigmaModal,
    openImportFigmaModal,
    importFigmaFromLink,
    ensureEditorRoute,
  ]);

  if (!open) return null;

  const hasSource = link.trim().length > 0 || fileKey.trim().length > 0;
  const tokenReady =
    serverTokenReady ||
    accessToken.trim().length > 0 ||
    Boolean(readFigmaAccessToken());
  const canImport = Boolean(figFile || (hasSource && tokenReady));

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px] sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Figma"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[min(90dvh,620px)] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="h-0.5 w-full shrink-0 bg-gradient-to-r from-[#F24E1E] via-[#A259FF] to-[#0ACF83]"
          aria-hidden
        />

        <button
          type="button"
          onClick={onClose}
          disabled={figImportInProgress || verifying}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <div className="shrink-0 border-b border-app-border-subtle px-6 pb-3 pt-6 text-center">
          <FigmaLogoMark className="mx-auto h-16 w-16 object-contain" />
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-app-fg">
            Import from Figma
          </h2>
          <p className="mt-1 text-ui leading-snug text-app-muted">
            Paste a frame link ({modKeyLabel()}+L in Figma) or a .fig file.
          </p>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-4 my-3 overflow-hidden rounded-xl border border-app-border bg-app-inset">
            <section className="px-4 py-3">
              <h3 className="text-ui-sm font-semibold text-app-fg">Figma connection</h3>

              {activeProfile ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-ui text-app-fg">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    {verifying ? "Verifying…" : `Connected as ${formatFigmaAccountLabel(activeProfile)}`}
                    {activeProfile.source === "server" ? (
                      <span className="text-app-muted">(server token)</span>
                    ) : null}
                  </span>
                  {hasPersonalConnection ? (
                    <button
                      type="button"
                      onClick={onUnlinkPersonal}
                      className="font-medium text-red-500 hover:text-red-400"
                    >
                      unlink
                    </button>
                  ) : null}
                </div>
              ) : savedTokenInBrowser ? (
                <p className="mt-1.5 text-ui text-app-muted">
                  Token saved in this browser — paste a design link below and Import.
                </p>
              ) : (
                <p className="mt-1.5 text-ui text-app-muted">
                  Paste your token once — it stays saved in this browser.
                </p>
              )}

              {showTokenField || !savedTokenInBrowser ? (
                <>
                  <label className="mt-2 block">
                    <span className="mb-1 block section-heading">
                      Personal access token
                    </span>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => {
                        setAccessToken(e.target.value);
                        setError(null);
                      }}
                      placeholder={
                        savedTokenInBrowser
                          ? "Enter new token to replace saved token"
                          : "figd_…"
                      }
                      autoComplete="off"
                      className={cn(fieldClass, "font-mono text-ui")}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={
                      verifying ||
                      (!accessToken.trim() && !serverTokenReady && !savedTokenInBrowser)
                    }
                    onClick={() => void onVerifyAndConnect()}
                    className={cn(
                      "mt-2 w-full rounded-lg border border-app-border bg-app-raised px-3 py-1.5 text-ui font-medium text-app-fg transition-colors hover:bg-app-hover",
                      (verifying ||
                        (!accessToken.trim() && !serverTokenReady && !savedTokenInBrowser)) &&
                        "cursor-not-allowed opacity-50",
                    )}
                  >
                    {verifying ? "Verifying with Figma…" : "Verify & connect"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="mt-2 text-ui font-medium text-accent underline-offset-2 hover:underline"
                  onClick={() => setShowTokenField(true)}
                >
                  Change token
                </button>
              )}
            </section>

            <div className="border-t border-app-border-subtle bg-app-panel px-4 py-3">
              <p className="mb-2 text-ui font-semibold text-app-fg">Design link</p>
              <input
                type="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
                placeholder="https://www.figma.com/design/…"
                className={cn(fieldClass, "text-ui-sm")}
              />
              <input
                type="text"
                value={fileKey}
                onChange={(e) => {
                  setFileKey(e.target.value);
                  setError(null);
                }}
                placeholder="Or file key (e.g. AbCdEf123456)"
                className={cn(fieldClass, "mt-1.5 h-8 font-mono text-ui")}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-ui font-medium text-accent underline-offset-2 hover:text-[#0b87e0] hover:underline"
                >
                  {figFile ? figFile.name : "Choose .fig file instead…"}
                </button>
                {figFile ? (
                  <button
                    type="button"
                    onClick={() => setFigFile(null)}
                    className="text-ui text-app-subtle hover:text-app-muted"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".fig,application/octet-stream"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) {
                    setFigFile(f);
                    setError(null);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="mx-4 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-ui leading-snug text-amber-950 dark:text-amber-100">
            {error}
          </p>
        ) : null}

        <div className="shrink-0 border-t border-app-border-subtle bg-app-panel px-4 py-3">
          <button
            type="button"
            disabled={figImportInProgress || verifying || !canImport}
            onClick={() => void runImport()}
            className={cn(
              "h-10 w-full rounded-xl text-sm font-semibold shadow-sm transition-colors",
              canImport
                ? "bg-accent text-white hover:bg-[#0b87e0]"
                : "cursor-not-allowed bg-app-inset text-app-muted",
              (figImportInProgress || verifying) && "opacity-70",
            )}
          >
            Import design
          </button>
        </div>
      </div>
    </div>
  );
}
