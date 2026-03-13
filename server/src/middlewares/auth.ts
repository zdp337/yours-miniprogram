/**
 * JWT 鉴权中间件 — Yours·凝刻
 */

import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'yours-dev-secret';

/**
 * JWT 鉴权中间件
 * 从 Authorization header 中提取并验证 token
 */
export const authMiddleware = async (ctx: Context, next: Next): Promise<void> => {
  const authorization = ctx.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { code: 401, data: null, message: '未登录，请先登录' };
    return;
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    ctx.state.user = {
      id: payload.userId,
      openId: payload.openId,
    };
    await next();
  } catch (err) {
    ctx.status = 401;
    ctx.body = { code: 401, data: null, message: '登录已过期，请重新登录' };
  }
};

/**
 * 生成 JWT token
 */
export const generateToken = (userId: number, openId: string): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId, openId }, JWT_SECRET, { expiresIn });
};
