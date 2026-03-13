/**
 * 收货地址服务 — Yours·凝刻
 * CRUD + 默认地址管理
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AddressInput {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault?: boolean;
}

/**
 * 获取用户的所有收货地址
 */
export const getAddressList = async (userId: number) => {
  const addresses = await prisma.address.findMany({
    where: { userId: BigInt(userId) },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return addresses.map((addr) => ({
    id: Number(addr.id),
    name: addr.name,
    phone: addr.phone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    detail: addr.detail,
    isDefault: addr.isDefault,
    fullAddress: `${addr.province}${addr.city}${addr.district}${addr.detail}`,
  }));
};

/**
 * 获取单个地址详情
 */
export const getAddressById = async (userId: number, addressId: number) => {
  const addr = await prisma.address.findFirst({
    where: {
      id: BigInt(addressId),
      userId: BigInt(userId),
    },
  });

  if (!addr) {
    throw new Error('地址不存在');
  }

  return {
    id: Number(addr.id),
    name: addr.name,
    phone: addr.phone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    detail: addr.detail,
    isDefault: addr.isDefault,
  };
};

/**
 * 新增收货地址
 */
export const createAddress = async (userId: number, data: AddressInput) => {
  // 如果设为默认地址，先取消其他默认
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: BigInt(userId), isDefault: true },
      data: { isDefault: false },
    });
  }

  // 如果是第一个地址，自动设为默认
  const addressCount = await prisma.address.count({
    where: { userId: BigInt(userId) },
  });

  const addr = await prisma.address.create({
    data: {
      userId: BigInt(userId),
      name: data.name,
      phone: data.phone,
      province: data.province,
      city: data.city,
      district: data.district,
      detail: data.detail,
      isDefault: addressCount === 0 ? true : (data.isDefault || false),
    },
  });

  return {
    id: Number(addr.id),
    name: addr.name,
    phone: addr.phone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    detail: addr.detail,
    isDefault: addr.isDefault,
  };
};

/**
 * 更新收货地址
 */
export const updateAddress = async (
  userId: number,
  addressId: number,
  data: AddressInput
) => {
  // 验证地址归属
  const existing = await prisma.address.findFirst({
    where: { id: BigInt(addressId), userId: BigInt(userId) },
  });

  if (!existing) {
    throw new Error('地址不存在');
  }

  // 如果设为默认地址，先取消其他默认
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: {
        userId: BigInt(userId),
        isDefault: true,
        id: { not: BigInt(addressId) },
      },
      data: { isDefault: false },
    });
  }

  const addr = await prisma.address.update({
    where: { id: BigInt(addressId) },
    data: {
      name: data.name,
      phone: data.phone,
      province: data.province,
      city: data.city,
      district: data.district,
      detail: data.detail,
      isDefault: data.isDefault || false,
    },
  });

  return {
    id: Number(addr.id),
    name: addr.name,
    phone: addr.phone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    detail: addr.detail,
    isDefault: addr.isDefault,
  };
};

/**
 * 删除收货地址
 */
export const deleteAddress = async (userId: number, addressId: number) => {
  // 验证地址归属
  const existing = await prisma.address.findFirst({
    where: { id: BigInt(addressId), userId: BigInt(userId) },
  });

  if (!existing) {
    throw new Error('地址不存在');
  }

  await prisma.address.delete({
    where: { id: BigInt(addressId) },
  });

  // 如果删除的是默认地址，自动设置最新的为默认
  if (existing.isDefault) {
    const latest = await prisma.address.findFirst({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      await prisma.address.update({
        where: { id: latest.id },
        data: { isDefault: true },
      });
    }
  }

  return { success: true };
};

/**
 * 设置默认地址
 */
export const setDefaultAddress = async (userId: number, addressId: number) => {
  // 验证地址归属
  const existing = await prisma.address.findFirst({
    where: { id: BigInt(addressId), userId: BigInt(userId) },
  });

  if (!existing) {
    throw new Error('地址不存在');
  }

  // 取消所有默认
  await prisma.address.updateMany({
    where: { userId: BigInt(userId), isDefault: true },
    data: { isDefault: false },
  });

  // 设置新默认
  await prisma.address.update({
    where: { id: BigInt(addressId) },
    data: { isDefault: true },
  });

  return { success: true };
};
