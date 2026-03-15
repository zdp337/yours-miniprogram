/**
 * 3D 模型服务 — Yours·凝刻
 * AI 生成调度 / 状态管理 / 模型查询
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as photoService from './photo';

const prisma = new PrismaClient();

const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_API_URL = process.env.AI_API_URL || 'https://api.tripo3d.ai';

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/**
 * 创建模型生成任务
 * 1. 检查每日次数
 * 2. 创建模型记录
 * 3. 调用 AI API 发起生成
 */
export const createGenerateTask = async (userId: number, photoId: number) => {
  // 检查每日次数
  const canUse = await photoService.consumeUsage(userId);
  if (!canUse) {
    throw new Error('TODAY_LIMIT_EXCEEDED');
  }

  // 获取照片信息
  const photo = await photoService.getPhotoById(userId, photoId);
  const imageUrl = photo.croppedUrl || photo.originalUrl;

  // 创建模型记录
  const model = await prisma.model.create({
    data: {
      userId: BigInt(userId),
      photoId: BigInt(photoId),
      status: 'queued',
    },
  });

  // 异步调用 AI API（不阻塞响应）
  triggerAIGeneration(Number(model.id), imageUrl).catch((err) => {
    console.error('[Model] AI 生成触发失败:', err);
  });

  return {
    id: Number(model.id),
    photoId: Number(model.photoId),
    status: model.status,
    createdAt: model.createdAt,
  };
};

/**
 * 触发 AI 3D 模型生成
 */
const triggerAIGeneration = async (modelId: number, imageUrl: string) => {
  try {
    // 更新状态为 generating
    await prisma.model.update({
      where: { id: BigInt(modelId) },
      data: { status: 'generating' },
    });

    // 调用 Tripo3D API
    const response = await axios.post(
      `${AI_API_URL}/v2/openapi/task`,
      {
        type: 'image_to_model',
        file: {
          type: 'url',
          url: imageUrl,
        },
        model_version: 'v2.0-20240919',
        face_limit: 50000,
        texture: true,
        pbr: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message || 'AI API 调用失败');
    }

    const taskId = response.data.data.task_id;

    // 存储 AI 任务 ID（利用 failReason 字段暂存，后续可扩展表字段）
    await prisma.model.update({
      where: { id: BigInt(modelId) },
      data: { failReason: `task:${taskId}` },
    });

    // 启动轮询检查任务状态
    pollTaskStatus(modelId, taskId);
  } catch (err: any) {
    console.error('[Model] AI 生成失败:', err.message);
    await handleGenerationFailure(modelId, categorizeError(err));
  }
};

/**
 * 轮询 AI 任务状态
 */
const pollTaskStatus = async (modelId: number, taskId: string) => {
  const MAX_POLL = 200; // 最多轮询200次（约10分钟）
  const POLL_INTERVAL = 3000; // 3秒一次

  for (let i = 0; i < MAX_POLL; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    try {
      const response = await axios.get(
        `${AI_API_URL}/v2/openapi/task/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${AI_API_KEY}`,
          },
          timeout: 10000,
        }
      );

      const task = response.data.data;

      if (task.status === 'success') {
        // 生成成功
        const modelUrl = task.output?.model || '';
        const previewUrl = task.output?.rendered_image || '';

        await prisma.model.update({
          where: { id: BigInt(modelId) },
          data: {
            status: 'completed',
            modelUrl,
            previewUrl,
            failReason: null,
            completedAt: new Date(),
          },
        });

        console.log(`[Model] 生成完成: modelId=${modelId}`);
        return;
      }

      if (task.status === 'failed') {
        await handleGenerationFailure(modelId, task.message || 'AI 生成失败');
        return;
      }

      // running / queued 继续轮询
    } catch (err: any) {
      console.error(`[Model] 轮询异常 (${i}/${MAX_POLL}):`, err.message);
      // 网络异常继续轮询
    }
  }

  // 超时
  await handleGenerationFailure(modelId, '生成超时，请稍后重试');
};

/**
 * 处理生成失败
 */
const handleGenerationFailure = async (modelId: number, reason: string) => {
  const model = await prisma.model.findUnique({
    where: { id: BigInt(modelId) },
  });

  if (!model) return;

  await prisma.model.update({
    where: { id: BigInt(modelId) },
    data: {
      status: 'failed',
      failReason: reason,
    },
  });

  // 回退生成次数（失败不消耗）
  await photoService.refundUsage(Number(model.userId));

  console.log(`[Model] 生成失败: modelId=${modelId}, reason=${reason}`);
};

/**
 * 错误分类
 */
const categorizeError = (err: any): string => {
  const msg = err.message || '';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return '服务繁忙，请稍后再试';
  }
  if (msg.includes('image') || msg.includes('photo') || msg.includes('quality')) {
    return '照片清晰度不够，请重新上传一张更清晰的全身照';
  }
  if (msg.includes('person') || msg.includes('body') || msg.includes('detect')) {
    return '未能识别到完整的人物，请确保照片中有一个完整站立的人';
  }
  return '生成遇到了一些问题，请重试';
};

/**
 * 查询模型状态
 */
export const getModelStatus = async (userId: number, modelId: number) => {
  const model = await prisma.model.findFirst({
    where: { id: BigInt(modelId), userId: BigInt(userId) },
  });

  if (!model) {
    throw new Error('模型不存在');
  }

  return {
    id: Number(model.id),
    photoId: Number(model.photoId),
    status: model.status,
    modelUrl: model.modelUrl,
    previewUrl: model.previewUrl,
    failReason: model.failReason?.startsWith('task:') ? null : model.failReason,
    retryCount: model.retryCount,
    createdAt: model.createdAt,
    completedAt: model.completedAt,
  };
};

/**
 * 重试生成
 */
export const retryGenerate = async (userId: number, modelId: number) => {
  const model = await prisma.model.findFirst({
    where: {
      id: BigInt(modelId),
      userId: BigInt(userId),
      status: 'failed',
    },
  });

  if (!model) {
    throw new Error('模型不存在或状态不允许重试');
  }

  if (model.retryCount >= MAX_RETRY_COUNT) {
    throw new Error('RETRY_LIMIT_EXCEEDED');
  }

  // 检查每日次数
  const canUse = await photoService.consumeUsage(userId);
  if (!canUse) {
    throw new Error('TODAY_LIMIT_EXCEEDED');
  }

  // 获取照片
  const photo = await photoService.getPhotoById(userId, Number(model.photoId));
  const imageUrl = photo.croppedUrl || photo.originalUrl;

  // 更新重试次数和状态
  await prisma.model.update({
    where: { id: BigInt(modelId) },
    data: {
      status: 'queued',
      retryCount: { increment: 1 },
      failReason: null,
    },
  });

  // 异步触发 AI 生成
  triggerAIGeneration(modelId, imageUrl).catch((err) => {
    console.error('[Model] 重试 AI 生成触发失败:', err);
  });

  return {
    id: modelId,
    status: 'queued',
    retryCount: model.retryCount + 1,
  };
};

/**
 * 获取用户模型列表
 */
export const getModelList = async (userId: number) => {
  const models = await prisma.model.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { createdAt: 'desc' },
    include: { photo: true },
  });

  return models.map((m) => ({
    id: Number(m.id),
    photoId: Number(m.photoId),
    status: m.status,
    modelUrl: m.modelUrl,
    previewUrl: m.previewUrl,
    failReason: m.failReason?.startsWith('task:') ? null : m.failReason,
    retryCount: m.retryCount,
    createdAt: m.createdAt,
    completedAt: m.completedAt,
    photo: {
      originalUrl: m.photo.originalUrl,
      croppedUrl: m.photo.croppedUrl,
    },
  }));
};

/**
 * 删除模型
 */
export const deleteModel = async (userId: number, modelId: number) => {
  const model = await prisma.model.findFirst({
    where: { id: BigInt(modelId), userId: BigInt(userId) },
  });

  if (!model) {
    throw new Error('模型不存在');
  }

  // 检查是否有关联的订单
  const orderCount = await prisma.order.count({
    where: { modelId: BigInt(modelId) },
  });

  if (orderCount > 0) {
    // 有关联订单时只软删除（标记删除），不影响订单
    // 此处简化处理：直接删除模型记录
  }

  await prisma.model.delete({
    where: { id: BigInt(modelId) },
  });

  return { id: modelId };
};

/**
 * 获取模型详情（包含照片信息）
 */
export const getModelDetail = async (userId: number, modelId: number) => {
  const model = await prisma.model.findFirst({
    where: { id: BigInt(modelId), userId: BigInt(userId) },
    include: { photo: true },
  });

  if (!model) {
    throw new Error('模型不存在');
  }

  return {
    id: Number(model.id),
    photoId: Number(model.photoId),
    status: model.status,
    modelUrl: model.modelUrl,
    previewUrl: model.previewUrl,
    failReason: model.failReason?.startsWith('task:') ? null : model.failReason,
    retryCount: model.retryCount,
    createdAt: model.createdAt,
    completedAt: model.completedAt,
    photo: {
      originalUrl: model.photo.originalUrl,
      croppedUrl: model.photo.croppedUrl,
    },
  };
};
