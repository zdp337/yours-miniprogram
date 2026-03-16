/**
 * 文件上传路由 — Yours·凝刻
 * 处理小程序 wx.uploadFile 的 multipart 上传
 * 开发模式：文件存到服务器本地；生产模式：上传到 COS
 */

import Router from 'koa-router';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../middlewares/auth';
import { AuthContext } from '../types';

const router = new Router({ prefix: '/api/photo' });

// 本地上传目录
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/photo/upload-file
 * 接收小程序 wx.uploadFile 的文件
 * 开发模式：存到本地 uploads/ 目录，返回 HTTP 访问 URL
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
    const buffer = fs.readFileSync(file.filepath || file.path);
    const ext = path.extname(file.originalFilename || file.name || '.jpg') || '.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `user_${user.id}_${timestamp}_${random}${ext}`;

    // 存到本地
    const savePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(savePath, buffer);

    // 生成访问 URL（通过服务器 IP 直接访问）
    const port = process.env.PORT || '3001';
    const url = `http://43.138.185.112:${port}/uploads/${filename}`;

    // 清理临时文件
    try {
      fs.unlinkSync(file.filepath || file.path);
    } catch {}

    console.log('[Upload] 文件已保存:', savePath, '→', url);

    ctx.body = {
      code: 0,
      data: { url, key: filename },
      message: 'success',
    };
  } catch (err: any) {
    console.error('[Upload] 文件上传失败:', err);
    ctx.status = 500;
    ctx.body = { code: 500, data: null, message: '文件上传失败' };
  }
});

export default router;
