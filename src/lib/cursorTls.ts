let tlsWorkaroundApplied = false;

/** True when corporate VPN / proxy breaks Node TLS (same workaround as Figma import). */
export function skipTlsVerifyForCursor(): boolean {
  return (
    process.env.CURSOR_SKIP_TLS_VERIFY === "true" ||
    process.env.FIGMA_SKIP_TLS_VERIFY === "true"
  );
}

/** Apply dev-only TLS workaround before @cursor/sdk network calls. */
export function applyCursorTlsWorkaround(): void {
  if (!skipTlsVerifyForCursor() || tlsWorkaroundApplied) return;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  tlsWorkaroundApplied = true;
}

function errorChain(error: unknown): Error[] {
  const out: Error[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    out.push(current);
    current = current.cause;
  }
  return out;
}

export function formatCursorTlsError(error: unknown): string | null {
  for (const err of errorChain(error)) {
    const code =
      "code" in err && typeof err.code === "string" ? err.code : null;
    if (
      code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
      /unable to get local issuer certificate/i.test(err.message)
    ) {
      return (
        "SSL certificate check failed reaching Cursor (common on corporate VPN). " +
        "FIGMA_SKIP_TLS_VERIFY=true is already in .env.local — restart `npm run dev` to apply. " +
        "Or ask IT for your company root CA and set NODE_EXTRA_CA_CERTS."
      );
    }
  }

  return null;
}
