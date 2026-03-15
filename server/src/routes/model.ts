/**
 * 3D 模型路由 — Yours·凝刻
 * AI 生成 / 状态查询 / 重试 / 模型列表
 */

import Router from 'koa-router';
import { authMiddleware } from '../middlewares/auth';
import * as modelService from '../services/model';
import { AuthContext } from '../types';

const router = new Router({ prefix: '/api/model' });

// 所有接口需要登录
router.use(authMiddleware);

/**
 * POST /api/model/generate
 * 发起 AI 3D 模型生成
 */
router.post('/generate', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const { photoId } = ctx.request.body as { photoId: number };

  if (!photoId) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少照片 ID' };
    return;
  }

  try {
    const result = await modelService.createGenerateTask(user.id, photoId);
    ctx.body = {
      code: 0,
      data: result,
      message: '生成任务已创建',
    };
  } catch (err: any) {
    if (err.message === 'TODAY_LIMIT_EXCEEDED') {
      ctx.body = {
        code: 4001,
        data: null,
        message: '今日免费次数已用完，明天再来试试吧~',
      };
      return;
    }
    throw err;
  }
});

/**
 * GET /api/model/:id/status
 * 查询模型生成状态（前端轮询）
 */
router.get('/:id/status', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const modelId = parseInt(ctx.params.id, 10);
  const result = await modelService.getModelStatus(user.id, modelId);

  ctx.body = {
    code: 0,
    data: result,
    message: 'success',
  };
});

/**
 * POST /api/model/:id/retry
 * 重试生成
 */
router.post('/:id/retry', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const modelId = parseInt(ctx.params.id, 10);

  try {
    const result = await modelService.retryGenerate(user.id, modelId);
    ctx.body = {
      code: 0,
      data: result,
      message: '重试已发起',
    };
  } catch (err: any) {
    if (err.message === 'RETRY_LIMIT_EXCEEDED') {
      ctx.body = {
        code: 4002,
        data: null,
        message: '该照片重试次数已达上限，请更换照片再试',
      };
      return;
    }
    if (err.message === 'TODAY_LIMIT_EXCEEDED') {
      ctx.body = {
        code: 4001,
        data: null,
        message: '今日免费次数已用完，明天再来试试吧~',
      };
      return;
    }
    throw err;
  }
});

/**
 * GET /api/model/list
 * 获取用户模型列表
 */
router.get('/list', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const list = await modelService.getModelList(user.id);

  ctx.body = {
    code: 0,
    data: { list },
    message: 'success',
  };
});

/**
 * GET /api/model/:id/detail
 * 获取模型详情
 */
router.get('/:id/detail', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const modelId = parseInt(ctx.params.id, 10);
  const result = await modelService.getModelDetail(user.id, modelId);

  ctx.body = {
    code: 0,
    data: result,
    message: 'success',
  };
});

/**
 * DELETE /api/model/:id
 * 删除模型
 */
router.delete('/:id', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const modelId = parseInt(ctx.params.id, 10);

  try {
    const result = await modelService.deleteModel(user.id, modelId);
    ctx.body = {
      code: 0,
      data: result,
      message: '删除成功',
    };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: err.message };
  }
});

export default router;
