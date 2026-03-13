# Yours·凝刻 — AI 个性化 Q 版 3D 手办定制

> 把你变成一个手办

## 产品简介

Yours·凝刻 是一款 AI 驱动的微信小程序，用户上传全身照后，AI 自动生成 Q 版彩色 3D 手办模型，支持 360° 在线预览，并可进行产品定制和下单购买实体手办。

## 技术栈

### 前端（小程序）
- 微信小程序原生 + TypeScript
- TDesign 小程序组件库
- Three.js（3D 模型预览）
- MobX（状态管理）

### 后端
- Node.js + Koa2 + TypeScript
- MySQL 8.0 + Prisma ORM
- Redis（缓存/队列）
- 腾讯云 COS（文件存储）

### AI 生成
- Tripo3D / Meshy API（MVP 阶段）
- glTF 2.0 (.glb) 模型格式

## 项目结构

```
├── miniprogram/          # 小程序前端
│   ├── pages/            # 页面
│   ├── components/       # 公共组件
│   ├── utils/            # 工具函数
│   └── styles/           # 公共样式
│
├── server/               # 后端服务
│   ├── src/
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务逻辑
│   │   ├── middlewares/   # 中间件
│   │   └── types/        # 类型定义
│   └── prisma/           # 数据库模型
│
└── docs/                 # 策划文档
```

## 快速开始

### 后端

```bash
cd server
npm install
cp .env.example .env     # 编辑环境变量
npx prisma db push       # 同步数据库
npm run dev               # 启动开发服务器
```

### 小程序

1. 使用微信开发者工具打开 `miniprogram/` 目录
2. 在 `project.config.json` 中配置你的 AppID
3. 点击编译运行

## 开发计划

- [x] 迭代 1：基础架构 + 用户体系（第 1-2 周）
- [ ] 迭代 2：照片上传 + AI 生成（第 3-4 周）
- [ ] 迭代 3：3D 预览 + 产品定制（第 5-6 周）
- [ ] 迭代 4：订单支付 + 收尾（第 7-8 周）
