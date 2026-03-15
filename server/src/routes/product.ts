/**
 * 产品配置路由 — Yours·凝刻
 * 产品配置 / 价格计算
 */

import Router from 'koa-router';
import { authMiddleware } from '../middlewares/auth';
import * as productService from '../services/product';

const router = new Router({ prefix: '/api/product' });

/**
 * GET /api/product/config
 * 获取产品配置（尺寸/打印类型/包装盒颜色/套餐）
 * 无需登录
 */
router.get('/config', async (ctx) => {
  const config = productService.getProductConfig();
  ctx.body = {
    code: 0,
    data: config,
    message: 'success',
  };
});

/**
 * POST /api/product/calculate
 * 价格计算
 */
router.post('/calculate', authMiddleware, async (ctx) => {
  const input = ctx.request.body as productService.PriceCalcInput;

  if (!input.figurineSize) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '请选择手办尺寸' };
    return;
  }

  try {
    const result = productService.calculatePrice(input);
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

export default router;
