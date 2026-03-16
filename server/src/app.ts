/**
 * Yours·凝刻 — 后端服务入口
 * Koa2 + TypeScript
 */

import Koa from 'koa';
import koaBody from 'koa-body';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { errorHandler } from './middlewares/error';
import { requestLogger } from './middlewares/logger';
import userRouter from './routes/user';
import addressRouter from './routes/address';
import photoRouter from './routes/photo';
import modelRouter from './routes/model';
import uploadRouter from './routes/upload';
import productRouter from './routes/product';
import orderRouter from './routes/order';

// 加载环境变量
config();

// 全局异常兜底：防止未捕获异常导致进程退出
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

const app = new Koa();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 全局中间件
app.use(errorHandler);
app.use(requestLogger);
app.use(koaBody({
  multipart: true,
  formidable: {
    maxFileSize: 20 * 1024 * 1024, // 20MB
    keepExtensions: true,
  },
}));

// 静态文件服务：/uploads/ 目录（开发模式图片存储）
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 静态文件服务：/public/ 目录（3D查看器等静态页面）
const publicDir = path.join(process.cwd(), 'public');

app.use(async (ctx, next) => {
  // /uploads/ 路径 — 上传的图片
  if (ctx.path.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, ctx.path.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
      };
      ctx.type = mimeMap[ext] || 'application/octet-stream';
      ctx.body = fs.createReadStream(filePath);
      return;
    }
  }
  // /public/ 路径 — 3D查看器等静态资源
  if (ctx.path.startsWith('/public/')) {
    const filePath = path.join(publicDir, ctx.path.replace('/public/', ''));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };
      ctx.type = mimeMap[ext] || 'application/octet-stream';
      ctx.body = fs.createReadStream(filePath);
      return;
    }
  }
  await next();
});

// 路由
app.use(userRouter.routes()).use(userRouter.allowedMethods());
app.use(addressRouter.routes()).use(addressRouter.allowedMethods());
app.use(photoRouter.routes()).use(photoRouter.allowedMethods());
app.use(modelRouter.routes()).use(modelRouter.allowedMethods());
app.use(uploadRouter.routes()).use(uploadRouter.allowedMethods());
app.use(productRouter.routes()).use(productRouter.allowedMethods());
app.use(orderRouter.routes()).use(orderRouter.allowedMethods());

// 启动服务
app.listen(PORT, () => {
  console.log(`[Server] Yours·凝刻 后端服务启动成功，端口: ${PORT}`);
});

export default app;
