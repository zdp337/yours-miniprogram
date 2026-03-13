/**
 * Yours·凝刻 — 后端服务入口
 * Koa2 + TypeScript
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { config } from 'dotenv';
import { errorHandler } from './middlewares/error';
import { requestLogger } from './middlewares/logger';
import userRouter from './routes/user';
import addressRouter from './routes/address';

// 加载环境变量
config();

const app = new Koa();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 全局中间件
app.use(errorHandler);
app.use(requestLogger);
app.use(bodyParser());

// 路由
app.use(userRouter.routes()).use(userRouter.allowedMethods());
app.use(addressRouter.routes()).use(addressRouter.allowedMethods());

// 启动服务
app.listen(PORT, () => {
  console.log(`[Server] Yours·凝刻 后端服务启动成功，端口: ${PORT}`);
});

export default app;
