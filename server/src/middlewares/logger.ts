/**
 * 请求日志中间件 — Yours·凝刻
 */

import { Context, Next } from 'koa';

export const requestLogger = async (ctx: Context, next: Next): Promise<void> => {
  const start = Date.now();

  await next();

  const ms = Date.now() - start;
  const { method, url, status } = ctx;
  console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} - ${ms}ms`);
};
