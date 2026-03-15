/**
 * 照片服务 — Yours·凝刻
 * 照片管理 / 历史照片 / 每日次数管理
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 每日免费生成次数上限 */
const DAILY_FREE_LIMIT = 2;

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
 * 查询今日剩余生成次数
 */
export const getDailyUsage = async (userId: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
 */
export const consumeUsage = async (userId: number): Promise<boolean> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usage = await prisma.dailyUsage.upsert({
    where: {
      userId_usageDate: {
        userId: BigInt(userId),
        usageDate: today,
      },
    },
    create: {
      userId: BigInt(userId),
      usageDate: today,
      usedCount: 1,
    },
    update: {
      usedCount: { increment: 1 },
    },
  });

  if (usage.usedCount > DAILY_FREE_LIMIT) {
    // 回退，次数不足
    await prisma.dailyUsage.update({
      where: {
        userId_usageDate: {
          userId: BigInt(userId),
          usageDate: today,
        },
      },
      data: { usedCount: { decrement: 1 } },
    });
    return false;
  }

  return true;
};

/**
 * 回退一次生成次数（生成失败时调用）
 */
export const refundUsage = async (userId: number): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
