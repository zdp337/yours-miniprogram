/**
 * 收货地址路由 — Yours·凝刻
 */

import Router from 'koa-router';
import { authMiddleware } from '../middlewares/auth';
import * as addressService from '../services/address';
import { AuthContext } from '../types';

const router = new Router({ prefix: '/api/address' });

// 所有地址接口都需要登录
router.use(authMiddleware);

/**
 * GET /api/address/list
 * 获取地址列表
 */
router.get('/list', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const list = await addressService.getAddressList(user.id);

  ctx.body = {
    code: 0,
    data: { list },
    message: 'success',
  };
});

/**
 * GET /api/address/:id
 * 获取地址详情
 */
router.get('/:id', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const addressId = parseInt(ctx.params.id, 10);
  const result = await addressService.getAddressById(user.id, addressId);

  ctx.body = {
    code: 0,
    data: result,
    message: 'success',
  };
});

/**
 * POST /api/address
 * 新增地址
 */
router.post('/', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const body = ctx.request.body as {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    isDefault?: boolean;
  };

  // 参数校验
  if (!body.name || !body.phone || !body.province || !body.city || !body.district || !body.detail) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '地址信息不完整' };
    return;
  }

  const result = await addressService.createAddress(user.id, body);

  ctx.body = {
    code: 0,
    data: result,
    message: '添加成功',
  };
});

/**
 * PUT /api/address/:id
 * 更新地址
 */
router.put('/:id', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const addressId = parseInt(ctx.params.id, 10);
  const body = ctx.request.body as {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    isDefault?: boolean;
  };

  const result = await addressService.updateAddress(user.id, addressId, body);

  ctx.body = {
    code: 0,
    data: result,
    message: '更新成功',
  };
});

/**
 * DELETE /api/address/:id
 * 删除地址
 */
router.del('/:id', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const addressId = parseInt(ctx.params.id, 10);
  const result = await addressService.deleteAddress(user.id, addressId);

  ctx.body = {
    code: 0,
    data: result,
    message: '删除成功',
  };
});

/**
 * PUT /api/address/:id/default
 * 设置默认地址
 */
router.put('/:id/default', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const addressId = parseInt(ctx.params.id, 10);
  const result = await addressService.setDefaultAddress(user.id, addressId);

  ctx.body = {
    code: 0,
    data: result,
    message: '设置成功',
  };
});

export default router;
