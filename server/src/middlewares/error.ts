/**
 * 全局错误处理中间件 — Yours·凝刻
 */

import { Context, Next } from 'koa';

export const errorHandler = async (ctx: Context, next: Next): Promise<void> => {
  try {
    await next();
  } catch (err: any) {
    console.error('[Error]', err.message || err);

    const status = err.status || err.statusCode || 500;
    const message = err.message || '服务器内部错误';

    ctx.status = status;
    ctx.body = {
      code: status,
      data: null,
      message: process.env.NODE_ENV === 'production' ? '服务异常，请稍后重试' : message,
    };
  }
};
