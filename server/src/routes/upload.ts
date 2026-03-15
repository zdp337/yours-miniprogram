/**
 * 文件上传路由 — Yours·凝刻
 * 处理小程序 wx.uploadFile 的 multipart 上传
 */

import Router from 'koa-router';
import { authMiddleware } from '../middlewares/auth';
import { uploadFile, generatePhotoKey } from '../services/cos';
import { AuthContext } from '../types';

const router = new Router({ prefix: '/api/photo' });

/**
 * POST /api/photo/upload-file
 * 接收小程序 wx.uploadFile 的文件
 * 注意：需要 koa-body 或类似中间件解析 multipart
 * 此处提供接口定义，实际 multipart 解析需要额外中间件
 */
router.post('/upload-file', authMiddleware, async (ctx) => {
  const { user } = (ctx as unknown as AuthContext).state;

  // 获取上传的文件
  const file = (ctx.request as any).files?.file;

  if (!file) {
    ctx.status = 400;
    ctx.body = { code: 400, data: null, message: '未接收到文件' };
    return;
  }

  try {
    const fs = await import('fs');
    const buffer = fs.readFileSync(file.filepath || file.path);
    const filename = file.originalFilename || file.name || 'photo.jpg';
    const key = generatePhotoKey(user.id, filename);

    const url = await uploadFile(key, buffer, file.mimetype || 'image/jpeg');

    // 清理临时文件
    try {
      fs.unlinkSync(file.filepath || file.path);
    } catch {}

    ctx.body = {
      code: 0,
      data: { url, key },
      message: 'success',
    };
  } catch (err: any) {
    console.error('[Upload] 文件上传失败:', err);
    ctx.status = 500;
    ctx.body = { code: 500, data: null, message: '文件上传失败' };
  }
});

export default router;
