/**
 * 订单路由 — Yours·凝刻
 * 创建 / 支付 / 列表 / 详情 / 取消 / 确认收货 / 退款
 */

import Router from 'koa-router';
import { authMiddleware } from '../middlewares/auth';
import * as orderService from '../services/order';
import { AuthContext } from '../types';

const router = new Router({ prefix: '/api/order' });

// 所有接口需要登录
router.use(authMiddleware);

/**
 * POST /api/order/create
 * 创建订单
 */
router.post('/create', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const body = ctx.request.body as any;

  const {
    modelId,
    addressId,
    figurineSize,
    modelPhotoPrint,
    originalPhotoPrint,
    packageBox,
    packageDealId,
    remark,
  } = body;

  if (!modelId || !addressId || !figurineSize) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少必要参数' };
    return;
  }

  try {
    const result = await orderService.createOrder(user.id, {
      modelId,
      addressId,
      figurineSize,
      modelPhotoPrint,
      originalPhotoPrint,
      packageBox,
      packageDealId,
      remark,
    });

    ctx.body = {
      code: 0,
      data: result,
      message: '订单创建成功',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

/**
 * POST /api/order/:id/pay
 * 模拟支付（MVP 阶段）
 */
router.post('/:id/pay', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const orderId = parseInt(ctx.params.id, 10);

  try {
    const result = await orderService.mockPayment(user.id, orderId);
    ctx.body = {
      code: 0,
      data: result,
      message: '支付成功',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

/**
 * GET /api/order/list
 * 获取订单列表
 */
router.get('/list', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const { status, page = '1', pageSize = '10' } = ctx.query as Record<string, string>;

  const result = await orderService.getOrderList(
    user.id,
    status,
    parseInt(page, 10),
    parseInt(pageSize, 10)
  );

  ctx.body = {
    code: 0,
    data: result,
    message: 'success',
  };
});

/**
 * GET /api/order/:id/detail
 * 获取订单详情
 */
router.get('/:id/detail', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const orderId = parseInt(ctx.params.id, 10);

  try {
    const result = await orderService.getOrderDetail(user.id, orderId);
    ctx.body = {
      code: 0,
      data: result,
      message: 'success',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

/**
 * POST /api/order/:id/cancel
 * 取消订单
 */
router.post('/:id/cancel', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const orderId = parseInt(ctx.params.id, 10);

  try {
    const result = await orderService.cancelOrder(user.id, orderId);
    ctx.body = {
      code: 0,
      data: result,
      message: '订单已取消',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

/**
 * POST /api/order/:id/confirm
 * 确认收货
 */
router.post('/:id/confirm', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const orderId = parseInt(ctx.params.id, 10);

  try {
    const result = await orderService.confirmReceive(user.id, orderId);
    ctx.body = {
      code: 0,
      data: result,
      message: '已确认收货',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

/**
 * POST /api/order/:id/refund
 * 申请退款
 */
router.post('/:id/refund', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const orderId = parseInt(ctx.params.id, 10);
  const { reason, description } = ctx.request.body as { reason: string; description?: string };

  if (!reason) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '请选择退款原因' };
    return;
  }

  try {
    const result = await orderService.applyRefund(user.id, orderId, reason, description);
    ctx.body = {
      code: 0,
      data: result,
      message: '退款申请已提交',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

export default router;
