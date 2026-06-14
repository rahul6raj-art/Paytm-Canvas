import { createClient, type RedisClientType } from "redis";

const PRESENCE_TTL_SEC = 60;

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

async function getRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (client?.isOpen) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const next = createClient({ url });
      next.on("error", (err) => console.error("[craft-realtime] redis", err));
      await next.connect();
      client = next as RedisClientType;
      return client;
    } catch (e) {
      console.warn("[craft-realtime] redis unavailable", e);
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

function presenceKey(fileId: string, clientId: string): string {
  return `presence:file:${fileId}:${clientId}`;
}

export async function setPresence(
  fileId: string,
  clientId: string,
  payload: Record<string, unknown> | null,
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const key = presenceKey(fileId, clientId);
  if (payload == null) {
    await redis.del(key);
    return;
  }
  await redis.set(key, JSON.stringify(payload), { EX: PRESENCE_TTL_SEC });
}

export async function clearPresence(fileId: string, clientId: string): Promise<void> {
  await setPresence(fileId, clientId, null);
}
