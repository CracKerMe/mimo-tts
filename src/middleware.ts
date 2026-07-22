import type { Context, MiddlewareHandler } from 'hono';
import { ZodError } from 'zod';
import { randomUUID, timingSafeEqual } from 'node:crypto';

// 业务层主动抛出的 HTTP 错误（如 413 文件过大），携带可控状态码
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---- 请求 ID：贯穿日志、错误响应、限流，便于排查 ----
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);
  await next();
  c.header('X-Request-Id', requestId);
};

// ---- 鉴权：X-API-Key 校验（公网前提下的必做项）----
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function authMiddleware(requireAuth: boolean, expectedKey?: string): MiddlewareHandler {
  return async (c, next) => {
    if (!requireAuth) return next();
    const requestId = c.get('requestId') as string;
    const provided = c.req.header('x-api-key') ?? '';
    if (!expectedKey || !safeEqual(provided, expectedKey)) {
      return c.json({ error: 'unauthorized', requestId }, 401);
    }
    await next();
  };
}

// ---- 请求体大小限制（DoS 防护）----
// 依赖 Content-Length 提前拒绝超大请求；分块传输(无 Content-Length)时
// 由 parseTtsRequestBody 的按文件大小校验兜底。
export function bodyLimitMiddleware(maxSize: number): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.get('requestId') as string;
    const lenHeader = c.req.header('content-length');
    if (lenHeader) {
      const len = Number(lenHeader);
      if (Number.isFinite(len) && len > maxSize) {
        return c.json(
          { error: 'request_error', requestId, message: `请求体超过大小上限（${maxSize} 字节）` },
          413,
        );
      }
    }
    await next();
  };
}

// ---- 限流：基于 IP 的内存令牌桶（单实例足够；多实例可换 Redis）----
interface Bucket {
  tokens: number;
  last: number;
}

export function rateLimitMiddleware(max: number, windowSec: number): MiddlewareHandler {
  const store = new Map<string, Bucket>();
  const refillPerMs = max / (windowSec * 1000);

  return async (c, next) => {
    const requestId = c.get('requestId') as string;
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      'unknown';

    const now = Date.now();
    const bucket = store.get(ip) ?? { tokens: max, last: now };
    bucket.tokens = Math.min(max, bucket.tokens + (now - bucket.last) * refillPerMs);
    bucket.last = now;

    if (bucket.tokens < 1) {
      store.set(ip, bucket);
      const retryAfter = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000));
      return c.json(
        { error: 'too_many_requests', requestId },
        429,
        { 'Retry-After': String(retryAfter) },
      );
    }

    bucket.tokens -= 1;
    store.set(ip, bucket);
    await next();
  };
}

// ---- 统一错误处理（脱敏 + ZodError → 422）----
export function errorHandler(err: Error, c: Context): Response {
  const requestId = (c.get('requestId') as string) ?? 'unknown';

  // 业务主动抛出的 HTTP 错误（如 413 文件过大）：暴露受控消息
  if (err instanceof HttpError) {
    return c.json(
      { error: 'request_error', requestId, message: err.message },
      err.status as 413,
    );
  }

  // 输入校验错误：属用户可控输入，可安全暴露字段级 issue
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'validation_error',
        requestId,
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      422,
    );
  }

  // 上游 / 未知错误：仅暴露 requestId，明细仅服务端日志
  const upstreamStatus = (err as { status?: unknown }).status;
  const status =
    typeof upstreamStatus === 'number' && upstreamStatus >= 400 && upstreamStatus < 600
      ? upstreamStatus
      : 500;

  console.error(`[${requestId}]`, err);
  return c.json({ error: 'internal_error', requestId }, status as 500);
}
