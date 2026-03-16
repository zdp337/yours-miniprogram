/**
 * 3D 模型服务 — Yours·凝刻
 * 多引擎 AI 生成调度 / 状态管理 / 模型查询
 * 支持引擎：Tripo3D、腾讯混元3D
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import * as photoService from './photo';
import * as stylizeService from './stylize';

const prisma = new PrismaClient();

// ========== 引擎类型定义 ==========

export type AIEngineType = 'tripo' | 'hunyuan';

/** AI 引擎任务创建结果 */
interface AITaskResult {
  taskId: string;
}

/** AI 引擎任务查询结果 */
interface AITaskStatus {
  status: 'waiting' | 'running' | 'success' | 'failed';
  modelUrl?: string;
  previewUrl?: string;
  errorMessage?: string;
}

/** AI 引擎接口定义 */
interface IAIEngine {
  readonly name: AIEngineType;
  /** 提交图生3D任务 */
  submitTask(imageUrl: string): Promise<AITaskResult>;
  /** 查询任务状态 */
  queryTask(taskId: string): Promise<AITaskStatus>;
}

// ========== Tripo3D 引擎实现 ==========

class TripoEngine implements IAIEngine {
  readonly name: AIEngineType = 'tripo';
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.TRIPO_API_KEY || process.env.AI_API_KEY || '';
    this.apiUrl = process.env.TRIPO_API_URL || process.env.AI_API_URL || 'https://api.tripo3d.ai';
  }

  async submitTask(imageUrl: string): Promise<AITaskResult> {
    const response = await axios.post(
      `${this.apiUrl}/v2/openapi/task`,
      {
        type: 'image_to_model',
        file: { type: 'url', url: imageUrl },
        model_version: 'v2.0-20240919',
        face_limit: 50000,
        texture: true,
        pbr: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 30000,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message || 'Tripo API 调用失败');
    }

    return { taskId: response.data.data.task_id };
  }

  async queryTask(taskId: string): Promise<AITaskStatus> {
    const response = await axios.get(
      `${this.apiUrl}/v2/openapi/task/${taskId}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      }
    );

    const task = response.data.data;

    if (task.status === 'success') {
      return {
        status: 'success',
        modelUrl: task.output?.model || '',
        previewUrl: task.output?.rendered_image || '',
      };
    }

    if (task.status === 'failed') {
      return {
        status: 'failed',
        errorMessage: task.message || 'Tripo 生成失败',
      };
    }

    // running / queued
    return {
      status: task.status === 'queued' ? 'waiting' : 'running',
    };
  }
}

// ========== 腾讯混元3D 引擎实现 ==========

class HunyuanEngine implements IAIEngine {
  readonly name: AIEngineType = 'hunyuan';
  private secretId: string;
  private secretKey: string;
  private region: string;
  private endpoint = 'ai3d.tencentcloudapi.com';
  private apiVersion = '2025-05-13';

  constructor() {
    this.secretId = process.env.HUNYUAN_SECRET_ID || '';
    this.secretKey = process.env.HUNYUAN_SECRET_KEY || '';
    this.region = process.env.HUNYUAN_REGION || 'ap-guangzhou';
  }

  /**
   * TC3-HMAC-SHA256 签名算法
   * 腾讯云 API 3.0 认证方式
   */
  private sign(action: string, payload: string, timestamp: number): string {
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const service = 'ai3d';

    // 1. 拼接规范请求串
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json\nhost:${this.endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalRequest = [
      httpRequestMethod,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      hashedRequestPayload,
    ].join('\n');

    // 2. 拼接待签名字符串
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

    // 3. 计算签名
    const secretDate = crypto.createHmac('sha256', `TC3${this.secretKey}`).update(date).digest();
    const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
    const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
    const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

    // 4. 拼接 Authorization
    return `${algorithm} Credential=${this.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  /** 调用腾讯云 API */
  private async callAPI(action: string, params: Record<string, any>): Promise<any> {
    const payload = JSON.stringify(params);
    const timestamp = Math.floor(Date.now() / 1000);
    const authorization = this.sign(action, payload, timestamp);

    const response = await axios.post(`https://${this.endpoint}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        Host: this.endpoint,
        'X-TC-Action': action,
        'X-TC-Version': this.apiVersion,
        'X-TC-Region': this.region,
        'X-TC-Timestamp': timestamp.toString(),
      },
      timeout: 30000,
    });

    const resp = response.data.Response;
    if (resp.Error) {
      throw new Error(`混元3D API错误 [${resp.Error.Code}]: ${resp.Error.Message}`);
    }

    return resp;
  }

  async submitTask(imageUrl: string): Promise<AITaskResult> {
    const resp = await this.callAPI('SubmitHunyuanTo3DProJob', {
      ImageUrl: imageUrl,
      EnablePBR: false,  // MVP阶段关闭PBR，节省积分（开启+10积分/次）
      GenerateType: 'Normal',
    });

    return { taskId: resp.JobId };
  }

  async queryTask(taskId: string): Promise<AITaskStatus> {
    const resp = await this.callAPI('QueryHunyuanTo3DProJob', {
      JobId: taskId,
    });

    const status = resp.Status;

    if (status === 'DONE') {
      const files = resp.ResultFile3Ds || [];
      const glbFile = files.find((f: any) => f.Type === 'GLB' || f.Type === 'glb') || files[0];

      return {
        status: 'success',
        modelUrl: glbFile?.Url || '',
        previewUrl: glbFile?.PreviewImageUrl || '',
      };
    }

    if (status === 'FAIL') {
      return {
        status: 'failed',
        errorMessage: resp.ErrorMessage || '混元3D 生成失败',
      };
    }

    // WAIT / RUN
    return {
      status: status === 'WAIT' ? 'waiting' : 'running',
    };
  }
}

// ========== 引擎管理器 ==========

const engines: Record<AIEngineType, IAIEngine> = {
  tripo: new TripoEngine(),
  hunyuan: new HunyuanEngine(),
};

/** 获取指定引擎实例 */
const getEngine = (engineType?: string): IAIEngine => {
  const type = (engineType || process.env.DEFAULT_AI_ENGINE || 'tripo') as AIEngineType;
  const engine = engines[type];
  if (!engine) {
    throw new Error(`不支持的AI引擎: ${type}`);
  }
  return engine;
};

/** 获取可用引擎列表（前端展示用） */
export const getAvailableEngines = (): { id: AIEngineType; name: string; available: boolean }[] => {
  return [
    {
      id: 'tripo',
      name: 'Tripo3D',
      available: !!(process.env.TRIPO_API_KEY || process.env.AI_API_KEY),
    },
    {
      id: 'hunyuan',
      name: '混元3D',
      available: !!(process.env.HUNYUAN_SECRET_ID && process.env.HUNYUAN_SECRET_KEY),
    },
  ];
};

// ========== 业务逻辑 ==========

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/**
 * 创建模型生成任务
 * 1. 检查每日次数
 * 2. 创建模型记录
 * 3. 调用 AI API 发起生成
 */
export const createGenerateTask = async (
  userId: number,
  photoId: number,
  engineType?: AIEngineType
) => {
  // 验证引擎
  const engine = getEngine(engineType);

  // 检查每日次数
  const canUse = await photoService.consumeUsage(userId);
  if (!canUse) {
    throw new Error('TODAY_LIMIT_EXCEEDED');
  }

  // 获取照片信息
  const photo = await photoService.getPhotoById(userId, photoId);
  const imageUrl = photo.croppedUrl || photo.originalUrl;

  // 创建模型记录（含引擎信息）
  const model = await prisma.model.create({
    data: {
      userId: BigInt(userId),
      photoId: BigInt(photoId),
      engine: engine.name,
      status: 'queued',
    },
  });

  // 异步调用 AI API（不阻塞响应）
  triggerAIGeneration(Number(model.id), imageUrl, engine).catch((err) => {
    console.error(`[Model][${engine.name}] AI 生成触发失败:`, err);
  });

  return {
    id: Number(model.id),
    photoId: Number(model.photoId),
    engine: engine.name,
    status: model.status,
    createdAt: model.createdAt,
  };
};

/**
 * 触发 AI 3D 模型生成（多引擎统一调度）
 * 流程：真人照片 → Q版风格化 → 3D 模型生成
 */
const triggerAIGeneration = async (
  modelId: number,
  imageUrl: string,
  engine: IAIEngine
) => {
  try {
    // 更新状态为 stylizing（风格化中）
    await prisma.model.update({
      where: { id: BigInt(modelId) },
      data: { status: 'generating' },
    });

    // ===== Step 1: Q版风格化预处理 =====
    let finalImageUrl = imageUrl;

    if (stylizeService.isStylizeAvailable()) {
      try {
        console.log(`[Model][${engine.name}] Step 1: Q版风格化中... modelId=${modelId}`);
        const stylizeResult = await stylizeService.stylizeToQVersion(imageUrl);
        finalImageUrl = stylizeResult.imageUrl;
        console.log(`[Model][${engine.name}] Q版风格化完成，使用风格化后图片提交3D生成`);
      } catch (stylizeErr: any) {
        // 风格化失败不中断流程，降级使用原图
        console.warn(`[Model][${engine.name}] Q版风格化失败，降级使用原图:`, stylizeErr.message);
      }
    } else {
      console.log(`[Model][${engine.name}] 风格化服务未配置，使用原图直接3D生成`);
    }

    // ===== Step 2: 调用 3D 引擎提交任务 =====
    console.log(`[Model][${engine.name}] Step 2: 提交3D生成任务... modelId=${modelId}`);
    const { taskId } = await engine.submitTask(finalImageUrl);

    // 存储 AI 任务 ID
    await prisma.model.update({
      where: { id: BigInt(modelId) },
      data: { aiTaskId: taskId },
    });

    console.log(`[Model][${engine.name}] 任务已提交: modelId=${modelId}, taskId=${taskId}`);

    // 启动轮询检查任务状态
    pollTaskStatus(modelId, taskId, engine);
  } catch (err: any) {
    console.error(`[Model][${engine.name}] AI 生成失败:`, err.message);
    await handleGenerationFailure(modelId, categorizeError(err));
  }
};

/**
 * 轮询 AI 任务状态（多引擎统一轮询）
 */
const pollTaskStatus = async (
  modelId: number,
  taskId: string,
  engine: IAIEngine
) => {
  const MAX_POLL = 200; // 最多轮询200次（约10分钟）
  const POLL_INTERVAL = 3000; // 3秒一次

  for (let i = 0; i < MAX_POLL; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    try {
      const result = await engine.queryTask(taskId);

      if (result.status === 'success') {
        // 生成成功
        await prisma.model.update({
          where: { id: BigInt(modelId) },
          data: {
            status: 'completed',
            modelUrl: result.modelUrl || '',
            previewUrl: result.previewUrl || '',
            failReason: null,
            completedAt: new Date(),
          },
        });

        console.log(`[Model][${engine.name}] 生成完成: modelId=${modelId}`);
        return;
      }

      if (result.status === 'failed') {
        await handleGenerationFailure(
          modelId,
          result.errorMessage || 'AI 生成失败'
        );
        return;
      }

      // waiting / running 继续轮询
    } catch (err: any) {
      console.error(
        `[Model][${engine.name}] 轮询异常 (${i}/${MAX_POLL}):`,
        err.message
      );
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
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return '服务繁忙，请稍后再试';
  }
  if (msg.includes('image') || msg.includes('photo') || msg.includes('quality')) {
    return '照片清晰度不够，请重新上传一张更清晰的全身照';
  }
  if (msg.includes('person') || msg.includes('body') || msg.includes('detect')) {
    return '未能识别到完整的人物，请确保照片中有一个完整站立的人';
  }
  if (msg.includes('invalidparameter') || msg.includes('参数')) {
    return '输入参数异常，请换一张照片重试';
  }
  if (msg.includes('limitexceeded') || msg.includes('频率')) {
    return '服务繁忙，请稍后再试';
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
    engine: model.engine,
    status: model.status,
    modelUrl: model.modelUrl,
    previewUrl: model.previewUrl,
    failReason: model.failReason,
    retryCount: model.retryCount,
    createdAt: model.createdAt,
    completedAt: model.completedAt,
  };
};

/**
 * 重试生成
 */
export const retryGenerate = async (
  userId: number,
  modelId: number,
  engineType?: AIEngineType
) => {
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

  // 重试时可以切换引擎
  const engine = getEngine(engineType || model.engine);

  // 检查每日次数
  const canUse = await photoService.consumeUsage(userId);
  if (!canUse) {
    throw new Error('TODAY_LIMIT_EXCEEDED');
  }

  // 获取照片
  const photo = await photoService.getPhotoById(userId, Number(model.photoId));
  const imageUrl = photo.croppedUrl || photo.originalUrl;

  // 更新重试次数、引擎和状态
  await prisma.model.update({
    where: { id: BigInt(modelId) },
    data: {
      status: 'queued',
      engine: engine.name,
      aiTaskId: null,
      retryCount: { increment: 1 },
      failReason: null,
    },
  });

  // 异步触发 AI 生成
  triggerAIGeneration(modelId, imageUrl, engine).catch((err) => {
    console.error(`[Model][${engine.name}] 重试 AI 生成触发失败:`, err);
  });

  return {
    id: modelId,
    engine: engine.name,
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
    engine: m.engine,
    status: m.status,
    modelUrl: m.modelUrl,
    previewUrl: m.previewUrl,
    failReason: m.failReason,
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
    engine: model.engine,
    status: model.status,
    modelUrl: model.modelUrl,
    previewUrl: model.previewUrl,
    failReason: model.failReason,
    retryCount: model.retryCount,
    createdAt: model.createdAt,
    completedAt: model.completedAt,
    photo: {
      originalUrl: model.photo.originalUrl,
      croppedUrl: model.photo.croppedUrl,
    },
  };
};
