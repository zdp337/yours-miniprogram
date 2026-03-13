/**
 * 用户服务 — Yours·凝刻
 * 微信登录 / 手机号绑定 / 用户信息管理
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { WxSessionResult } from '../types';
import { generateToken } from '../middlewares/auth';

const prisma = new PrismaClient();

const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';

/**
 * 微信登录
 * 1. 用 code 换取 openId
 * 2. 查找或创建用户
 * 3. 返回 JWT token + 用户信息
 */
export const wxLogin = async (code: string) => {
  // 调用微信 code2Session 接口
  const wxRes = await axios.get<WxSessionResult>(
    'https://api.weixin.qq.com/sns/jscode2session',
    {
      params: {
        appid: WX_APPID,
        secret: WX_SECRET,
        js_code: code,
        grant_type: 'authorization_code',
      },
    }
  );

  if (wxRes.data.errcode) {
    throw new Error(`微信登录失败: ${wxRes.data.errmsg}`);
  }

  const { openid: openId, unionid: unionId } = wxRes.data;

  // 查找或创建用户
  let user = await prisma.user.findUnique({
    where: { openId },
  });

  let isNewUser = false;

  if (!user) {
    user = await prisma.user.create({
      data: {
        openId,
        unionId: unionId || null,
      },
    });
    isNewUser = true;
  }

  // 生成 JWT token
  const token = generateToken(Number(user.id), user.openId);

  return {
    token,
    userInfo: {
      id: Number(user.id),
      openId: user.openId,
      nickname: user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      phone: user.phone || null,
    },
    isNewUser,
  };
};

/**
 * 绑定手机号
 * 使用微信手机号快速验证组件的 code
 */
export const bindPhone = async (userId: number, code: string) => {
  // 先获取 access_token
  const tokenRes = await axios.get(
    'https://api.weixin.qq.com/cgi-bin/token',
    {
      params: {
        grant_type: 'client_credential',
        appid: WX_APPID,
        secret: WX_SECRET,
      },
    }
  );

  if (!tokenRes.data.access_token) {
    throw new Error('获取 access_token 失败');
  }

  // 用 code 换取手机号
  const phoneRes = await axios.post(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${tokenRes.data.access_token}`,
    { code }
  );

  if (phoneRes.data.errcode !== 0) {
    throw new Error(`获取手机号失败: ${phoneRes.data.errmsg}`);
  }

  const phone = phoneRes.data.phone_info.purePhoneNumber;

  // 更新用户手机号
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { phone },
  });

  return { phone };
};

/**
 * 获取用户信息
 */
export const getUserInfo = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  return {
    id: Number(user.id),
    openId: user.openId,
    nickname: user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || null,
    createdAt: user.createdAt,
  };
};

/**
 * 更新用户信息（昵称、头像）
 */
export const updateUserInfo = async (
  userId: number,
  data: { nickname?: string; avatarUrl?: string }
) => {
  const user = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: {
      nickname: data.nickname,
      avatarUrl: data.avatarUrl,
    },
  });

  return {
    id: Number(user.id),
    nickname: user.nickname || '',
    avatarUrl: user.avatarUrl || '',
  };
};
