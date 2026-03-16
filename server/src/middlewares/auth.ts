/**
 * JWT 鉴权中间件 — Yours·凝刻
 */

import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'yours-dev-secret';

// 启动时打印 JWT 配置（仅前几位，安全考虑）
console.log(`[Auth] JWT_SECRET 已加载, 前6位: "${JWT_SECRET.slice(0, 6)}...", 长度: ${JWT_SECRET.length}`);
console.log(`[Auth] JWT_EXPIRES_IN: ${process.env.JWT_EXPIRES_IN || '7d (默认)'}`);

/**
 * JWT 鉴权中间件
 * 从 Authorization header 中提取并验证 token
 */
export const authMiddleware = async (ctx: Context, next: Next): Promise<void> => {
  const authorization = ctx.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    console.error(`[Auth] 401 无token: ${ctx.method} ${ctx.path}, Authorization: "${authorization || '(空)'}"`);
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
  } catch (err: any) {
    console.error(`[Auth] 401 token验证失败: ${ctx.method} ${ctx.path}, token前10位: "${token.slice(0, 10)}...", 错误: ${err.message}`);
    ctx.status = 401;
    ctx.body = { code: 401, data: null, message: `登录已过期，请重新登录` };
    return;
  }

  // next() 放在 try-catch 外面，后续路由的异常不会被当作 401
  await next();
};

/**
 * 生成 JWT token
 */
export const generateToken = (userId: number, openId: string): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  console.log(`[Auth] 签发token: userId=${userId}, openId=${openId}, expiresIn=${expiresIn}, secret前6位="${JWT_SECRET.slice(0, 6)}..."`);
  return jwt.sign({ userId, openId }, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};
