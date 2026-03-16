/**
 * 照片服务 — Yours·凝刻
 * 照片管理 / 历史照片 / 每日次数管理
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 每日免费生成次数上限（测试阶段暂设 20，正式上线改回 2） */
const DAILY_FREE_LIMIT = 20;

/**
 * 创建照片记录
 */
export const createPhoto = async (
  userId: number,
  originalUrl: string,
  croppedUrl?: string
) => {
  const photo = await prisma.photo.create({
    data: {
      userId: BigInt(userId),
      originalUrl,
      croppedUrl: croppedUrl || null,
    },
  });

  return {
    id: Number(photo.id),
    userId: Number(photo.userId),
    originalUrl: photo.originalUrl,
    croppedUrl: photo.croppedUrl,
    createdAt: photo.createdAt,
  };
};

/**
 * 更新照片裁剪 URL
 */
export const updateCroppedUrl = async (
  userId: number,
  photoId: number,
  croppedUrl: string
) => {
  const photo = await prisma.photo.findFirst({
    where: { id: BigInt(photoId), userId: BigInt(userId) },
  });

  if (!photo) {
    throw new Error('照片不存在');
  }

  const updated = await prisma.photo.update({
    where: { id: BigInt(photoId) },
    data: { croppedUrl },
  });

  return {
    id: Number(updated.id),
    originalUrl: updated.originalUrl,
    croppedUrl: updated.croppedUrl,
  };
};

/**
 * 获取用户历史照片列表（最近20张）
 */
export const getPhotoList = async (userId: number) => {
  const photos = await prisma.photo.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return photos.map((p) => ({
    id: Number(p.id),
    originalUrl: p.originalUrl,
    croppedUrl: p.croppedUrl,
    createdAt: p.createdAt,
  }));
};

/**
 * 获取照片详情
 */
export const getPhotoById = async (userId: number, photoId: number) => {
  const photo = await prisma.photo.findFirst({
    where: { id: BigInt(photoId), userId: BigInt(userId) },
  });

  if (!photo) {
    throw new Error('照片不存在');
  }

  return {
    id: Number(photo.id),
    originalUrl: photo.originalUrl,
    croppedUrl: photo.croppedUrl,
    createdAt: photo.createdAt,
  };
};

/**
 * 删除照片
 */
export const deletePhoto = async (userId: number, photoId: number) => {
  const photo = await prisma.photo.findFirst({
    where: { id: BigInt(photoId), userId: BigInt(userId) },
  });

  if (!photo) {
    throw new Error('照片不存在');
  }

  await prisma.photo.delete({
    where: { id: BigInt(photoId) },
  });

  return { originalUrl: photo.originalUrl, croppedUrl: photo.croppedUrl };
};

/**
 * 获取今日零点的 Date 对象（使用 UTC 纯日期字符串构造，避免时区偏差）
 * MySQL DATE 类型只存日期部分，Prisma 传 Date 对象时会有 UTC 转换问题
 * 用 'YYYY-MM-DDT00:00:00.000Z' 确保与数据库中存储的日期一致
 */
const getTodayDate = (): Date => {
  const now = new Date();
  // 用本地日期拼 ISO 字符串，强制 UTC 零点
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
};

/**
 * 查询今日剩余生成次数
 */
export const getDailyUsage = async (userId: number) => {
  const today = getTodayDate();

  const usage = await prisma.dailyUsage.findUnique({
    where: {
      userId_usageDate: {
        userId: BigInt(userId),
        usageDate: today,
      },
    },
  });

  const usedCount = usage?.usedCount || 0;

  return {
    usedCount,
    remainCount: Math.max(0, DAILY_FREE_LIMIT - usedCount),
    dailyLimit: DAILY_FREE_LIMIT,
  };
};

/**
 * 消耗一次生成次数
 * 返回 true 表示成功消耗，false 表示次数不足
 *
 * 修复：不再使用 prisma.upsert()（MySQL DATE + 时区导致唯一约束冲突）
 * 改为：findUnique → update / create，create 失败再 fallback 到 update
 */
export const consumeUsage = async (userId: number): Promise<boolean> => {
  const today = getTodayDate();
  const whereKey = {
    userId_usageDate: {
      userId: BigInt(userId),
      usageDate: today,
    },
  };

  // 先查询是否有今日记录
  let usage = await prisma.dailyUsage.findUnique({ where: whereKey });

  if (usage) {
    // 已有记录 → 检查是否还有次数
    if (usage.usedCount >= DAILY_FREE_LIMIT) {
      return false;
    }
    // 增加计数
    usage = await prisma.dailyUsage.update({
      where: whereKey,
      data: { usedCount: { increment: 1 } },
    });
  } else {
    // 没有记录 → 创建（如果并发冲突则 fallback 到 update）
    try {
      usage = await prisma.dailyUsage.create({
        data: {
          userId: BigInt(userId),
          usageDate: today,
          usedCount: 1,
        },
      });
    } catch (err: any) {
      // P2002 = Unique constraint failed（并发竞争：另一个请求刚创建了记录）
      if (err.code === 'P2002') {
        const existing = await prisma.dailyUsage.findUnique({ where: whereKey });
        if (existing && existing.usedCount >= DAILY_FREE_LIMIT) {
          return false;
        }
        usage = await prisma.dailyUsage.update({
          where: whereKey,
          data: { usedCount: { increment: 1 } },
        });
      } else {
        throw err;
      }
    }
  }

  return true;
};

/**
 * 回退一次生成次数（生成失败时调用）
 */
export const refundUsage = async (userId: number): Promise<void> => {
  const today = getTodayDate();

  const usage = await prisma.dailyUsage.findUnique({
    where: {
      userId_usageDate: {
        userId: BigInt(userId),
        usageDate: today,
      },
    },
  });

  if (usage && usage.usedCount > 0) {
    await prisma.dailyUsage.update({
      where: {
        userId_usageDate: {
          userId: BigInt(userId),
          usageDate: today,
        },
      },
      data: { usedCount: { decrement: 1 } },
    });
  }
};
