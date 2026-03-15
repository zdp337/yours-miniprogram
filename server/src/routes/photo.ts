/**
 * 照片路由 — Yours·凝刻
 * 照片上传 / 历史管理 / 每日次数
 */

import Router from 'koa-router';
import { authMiddleware } from '../middlewares/auth';
import * as photoService from '../services/photo';
import * as cosService from '../services/cos';
import { AuthContext } from '../types';

const router = new Router({ prefix: '/api/photo' });

// 所有接口需要登录
router.use(authMiddleware);

/**
 * GET /api/photo/list
 * 获取历史照片列表（最近20张）
 */
router.get('/list', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const list = await photoService.getPhotoList(user.id);

  ctx.body = {
    code: 0,
    data: { list },
    message: 'success',
  };
});

/**
 * GET /api/photo/usage
 * 获取今日剩余生成次数
 */
router.get('/usage', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const usage = await photoService.getDailyUsage(user.id);

  ctx.body = {
    code: 0,
    data: usage,
    message: 'success',
  };
});

/**
 * POST /api/photo/upload-url
 * 获取 COS 上传签名 URL（小程序直传）
 */
router.post('/upload-url', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const { filename, type = 'original' } = ctx.request.body as {
    filename: string;
    type?: 'original' | 'cropped';
  };

  if (!filename) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少文件名' };
    return;
  }

  const key =
    type === 'cropped'
      ? cosService.generateCroppedKey(user.id, filename)
      : cosService.generatePhotoKey(user.id, filename);

  const contentType = filename.toLowerCase().endsWith('.png')
    ? 'image/png'
    : 'image/jpeg';

  const signData = await cosService.getUploadSignUrl(key, contentType);

  ctx.body = {
    code: 0,
    data: {
      ...signData,
      key,
      fileUrl: `https://${process.env.COS_BUCKET || 'yours-1234567890'}.cos.${
        process.env.COS_REGION || 'ap-guangzhou'
      }.myqcloud.com/${key}`,
    },
    message: 'success',
  };
});

/**
 * POST /api/photo
 * 创建照片记录（上传完成后调用）
 */
router.post('/', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const { originalUrl, croppedUrl } = ctx.request.body as {
    originalUrl: string;
    croppedUrl?: string;
  };

  if (!originalUrl) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少照片 URL' };
    return;
  }

  const result = await photoService.createPhoto(user.id, originalUrl, croppedUrl);

  ctx.body = {
    code: 0,
    data: result,
    message: '照片上传成功',
  };
});

/**
 * PUT /api/photo/:id/crop
 * 更新照片裁剪结果
 */
router.put('/:id/crop', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const photoId = parseInt(ctx.params.id, 10);
  const { croppedUrl } = ctx.request.body as { croppedUrl: string };

  if (!croppedUrl) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '缺少裁剪照片 URL' };
    return;
  }

  const result = await photoService.updateCroppedUrl(user.id, photoId, croppedUrl);

  ctx.body = {
    code: 0,
    data: result,
    message: '裁剪结果已保存',
  };
});

/**
 * GET /api/photo/:id
 * 获取照片详情
 */
router.get('/:id', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const photoId = parseInt(ctx.params.id, 10);
  const result = await photoService.getPhotoById(user.id, photoId);

  ctx.body = {
    code: 0,
    data: result,
    message: 'success',
  };
});

/**
 * DELETE /api/photo/:id
 * 删除照片
 */
router.del('/:id', async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;
  const photoId = parseInt(ctx.params.id, 10);
  const result = await photoService.deletePhoto(user.id, photoId);

  // 异步删除 COS 文件（不阻塞响应）
  if (result.originalUrl) {
    const key = result.originalUrl.split('.myqcloud.com/')[1];
    if (key) cosService.deleteFile(key).catch(() => {});
  }
  if (result.croppedUrl) {
    const key = result.croppedUrl.split('.myqcloud.com/')[1];
    if (key) cosService.deleteFile(key).catch(() => {});
  }

  ctx.body = {
    code: 0,
    data: null,
    message: '删除成功',
  };
});

export default router;
