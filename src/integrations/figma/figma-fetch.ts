import https from "node:https";

export function formatFigmaFetchError(error: unknown): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const cause = err.cause instanceof Error ? err.cause : err;
  const code =
    "code" in cause && typeof cause.code === "string" ? cause.code : null;

  if (code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY") {
    return (
      "SSL certificate check failed (common on corporate VPN). " +
      "Add FIGMA_SKIP_TLS_VERIFY=true to .env.local and restart the dev server, " +
      "or ask IT for your company root CA and set NODE_EXTRA_CA_CERTS."
    );
  }

  return err.message || "Network request to Figma failed.";
}

function skipTlsVerify(): boolean {
  return process.env.FIGMA_SKIP_TLS_VERIFY === "true";
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

/** HTTPS fetch with optional corporate-network TLS workaround (FIGMA_SKIP_TLS_VERIFY=true). */
export async function figmaFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input);
  const method = init?.method ?? "GET";
  const headerRecord = headersToRecord(init?.headers);

  try {
    return await new Promise<Response>((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method,
          headers: headerRecord,
          rejectUnauthorized: !skipTlsVerify(),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks);
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value == null) continue;
              if (Array.isArray(value)) {
                for (const v of value) responseHeaders.append(key, v);
              } else {
                responseHeaders.set(key, value);
              }
            }
            resolve(
              new Response(body, {
                status: res.statusCode ?? 500,
                statusText: res.statusMessage,
                headers: responseHeaders,
              }),
            );
          });
        },
      );

      req.on("error", (error) => {
        reject(new Error(formatFigmaFetchError(error), { cause: error }));
      });

      const body = init?.body;
      if (body != null && method !== "GET" && method !== "HEAD") {
        if (typeof body === "string") {
          req.write(body);
        } else if (body instanceof Uint8Array) {
          req.write(body);
        }
      }

      req.end();
    });
  } catch (error) {
    throw new Error(formatFigmaFetchError(error), { cause: error });
  }
}
