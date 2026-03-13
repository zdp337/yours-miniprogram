/**
 * 全局类型定义 — Yours·凝刻
 */

import { Context } from 'koa';

/** API 统一响应格式 */
export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

/** 带用户信息的 Context */
export interface AuthContext extends Context {
  state: {
    user: {
      id: number;
      openId: string;
    };
  };
}

/** 微信登录 code2Session 返回值 */
export interface WxSessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/** JWT payload */
export interface JwtPayload {
  userId: number;
  openId: string;
  iat?: number;
  exp?: number;
}
