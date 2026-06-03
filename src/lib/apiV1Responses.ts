import { NextResponse } from "next/server";

export type ApiV1ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type ApiV1SuccessBody<T> = {
  data: T;
};

export function jsonV1Data<T>(data: T, init?: { status?: number }): NextResponse<ApiV1SuccessBody<T>> {
  return NextResponse.json({ data }, { status: init?.status ?? 200 });
}

export function jsonV1Error(code: string, message: string, status: number): NextResponse<ApiV1ErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}
