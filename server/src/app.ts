/**
 * Yours·凝刻 — 后端服务入口
 * Koa2 + TypeScript
 */

import Koa from 'koa';
import koaBody from 'koa-body';
import { config } from 'dotenv';
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
