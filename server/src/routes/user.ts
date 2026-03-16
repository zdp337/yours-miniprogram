/**
 * 用户路由 — Yours·凝刻
 */

import Router from 'koa-router';
import { authMiddleware, generateToken } from '../middlewares/auth';
import * as userService from '../services/user';
import { AuthContext } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = new Router({ prefix: '/api/user' });

/**
 * POST /api/user/login
 * 微信登录
 */
router.post('/login', async (ctx) => {
  const { code } = ctx.request.body as { code: string };

  if (!code) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少 code 参数' };
    return;
  }

  const result = await userService.wxLogin(code);

  ctx.body = {
    code: 0,
    data: result,
    message: result.isNewUser ? '注册成功' : '登录成功',
  };
});

/**
 * POST /api/user/dev-login
 * 开发模式免登录（仅测试环境使用，绕过微信 code2Session）
 */
router.post('/dev-login', async (ctx) => {
  const devOpenId = 'dev_test_user_001';

  // 查找或创建测试用户
  let user = await prisma.user.findUnique({ where: { openId: devOpenId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        openId: devOpenId,
        nickname: '测试用户',
        avatarUrl: '',
      },
    });
  }

  const token = generateToken(Number(user.id), devOpenId);

  ctx.body = {
    code: 0,
    data: {
      token,
      userInfo: {
        id: Number(user.id),
        openId: user.openId,
        nickname: user.nickname || '测试用户',
        avatarUrl: user.avatarUrl || '',
        phone: user.phone || null,
      },
      isNewUser: false,
    },
    message: '开发模式登录成功',
  };
});

/**
 * POST /api/user/bindPhone
 * 绑定手机号
 */
router.post('/bindPhone', authMiddleware, async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const { code } = ctx.request.body as { code: string };

  if (!code) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少 code 参数' };
    return;
  }

  const result = await userService.bindPhone(user.id, code);

  ctx.body = {
    code: 0,
    data: result,
    message: '手机号绑定成功',
  };
});

/**
 * GET /api/user/info
 * 获取用户信息
 */
router.get('/info', authMiddleware, async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const result = await userService.getUserInfo(user.id);

  ctx.body = {
    code: 0,
    data: result,
    message: 'success',
  };
});

/**
 * PUT /api/user/info
 * 更新用户信息（昵称、头像）
 */
router.put('/info', authMiddleware, async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const { nickname, avatarUrl } = ctx.request.body as {
    nickname?: string;
    avatarUrl?: string;
  };

  const result = await userService.updateUserInfo(user.id, {
    nickname,
    avatarUrl,
  });

  ctx.body = {
    code: 0,
    data: result,
    message: '更新成功',
  };
});

export default router;
