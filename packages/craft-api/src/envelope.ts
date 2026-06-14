export function jsonV1Data<T>(data: T, status = 200) {
  return { status, body: { data } };
}

export function jsonV1Error(code: string, message: string, status: number) {
  return { status, body: { error: { code, message } } };
}

export function nextRevision(current: string): string {
  const n = Number(current);
  return String(Number.isFinite(n) ? n + 1 : 1);
}
