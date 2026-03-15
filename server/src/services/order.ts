/**
 * 订单服务 — Yours·凝刻
 * 订单创建 / 列表 / 详情 / 取消 / 确认收货 / 退款申请 / 模拟支付
 */

import { PrismaClient } from '@prisma/client';
import { calculatePrice, PriceCalcInput } from './product';

const prisma = new PrismaClient();

/** 订单状态枚举 */
export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  CANCELLED: 'cancelled',
  PRODUCING: 'producing',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded',
} as const;

/** 订单状态中文映射 */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: '待支付',
  cancelled: '已取消',
  producing: '制作中',
  shipped: '已发货',
  completed: '已完成',
  refunding: '退款中',
  refunded: '已退款',
};

/** 生成订单编号：YN + yyyyMMdd + 6位序号 */
const generateOrderNo = (): string => {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `YN${dateStr}${random}`;
};

/** 序列化 Decimal 和 BigInt */
const serializeOrder = (order: any) => ({
  id: Number(order.id),
  orderNo: order.orderNo,
  userId: Number(order.userId),
  modelId: Number(order.modelId),
  addressId: Number(order.addressId),
  status: order.status,
  statusLabel: ORDER_STATUS_LABEL[order.status] || order.status,
  figurineSize: order.figurineSize,
  totalPrice: parseFloat(order.totalPrice.toString()),
  discountPrice: parseFloat(order.discountPrice.toString()),
  shippingFee: parseFloat(order.shippingFee.toString()),
  payPrice: parseFloat(order.payPrice.toString()),
  packageDealId: order.packageDealId,
  remark: order.remark,
  paidAt: order.paidAt,
  shippedAt: order.shippedAt,
  completedAt: order.completedAt,
  createdAt: order.createdAt,
  expireAt: order.expireAt,
});

/** 创建订单入参 */
interface CreateOrderInput {
  modelId: number;
  addressId: number;
  figurineSize: string;
  modelPhotoPrint?: { enabled: boolean; printType?: string };
  originalPhotoPrint?: { enabled: boolean; printType?: string };
  packageBox?: { enabled: boolean; color?: string };
  packageDealId?: string;
  remark?: string;
}

/**
 * 创建订单
 */
export const createOrder = async (userId: number, input: CreateOrderInput) => {
  // 验证模型存在且已完成
  const model = await prisma.model.findFirst({
    where: { id: BigInt(input.modelId), userId: BigInt(userId), status: 'completed' },
  });
  if (!model) {
    throw new Error('模型不存在或未完成');
  }

  // 验证地址存在
  const address = await prisma.address.findFirst({
    where: { id: BigInt(input.addressId), userId: BigInt(userId) },
  });
  if (!address) {
    throw new Error('收货地址不存在');
  }

  // 服务端计算价格（防篡改）
  const priceCalc: PriceCalcInput = {
    figurineSize: input.figurineSize,
    modelPhotoPrint: input.modelPhotoPrint,
    originalPhotoPrint: input.originalPhotoPrint,
    packageBox: input.packageBox,
    packageDealId: input.packageDealId,
  };
  const priceResult = calculatePrice(priceCalc);

  // 生成订单编号
  const orderNo = generateOrderNo();

  // 30分钟过期
  const expireAt = new Date(Date.now() + 30 * 60 * 1000);

  // 创建订单 + 订单明细（事务）
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNo,
        userId: BigInt(userId),
        modelId: BigInt(input.modelId),
        addressId: BigInt(input.addressId),
        status: ORDER_STATUS.PENDING_PAYMENT,
        figurineSize: input.figurineSize,
        totalPrice: priceResult.totalPrice,
        discountPrice: priceResult.discount,
        shippingFee: priceResult.shippingFee,
        payPrice: priceResult.payPrice,
        packageDealId: input.packageDealId || null,
        remark: input.remark || null,
        expireAt,
      },
    });

    // 创建订单明细
    const orderItems = priceResult.items.map((item) => ({
      orderId: newOrder.id,
      itemType: item.type,
      itemSpec: item.spec,
      price: item.price,
    }));

    await tx.orderItem.createMany({ data: orderItems });

    return newOrder;
  });

  return {
    ...serializeOrder(order),
    items: priceResult.items,
  };
};

/**
 * 模拟微信支付（MVP 阶段不接真实支付）
 */
export const mockPayment = async (userId: number, orderId: number) => {
  const order = await prisma.order.findFirst({
    where: { id: BigInt(orderId), userId: BigInt(userId) },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    throw new Error('订单状态不支持支付');
  }

  // 检查是否过期
  if (order.expireAt && new Date() > order.expireAt) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: ORDER_STATUS.CANCELLED },
    });
    throw new Error('订单已超时关闭，请重新下单');
  }

  // 模拟支付成功，更新订单状态
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: ORDER_STATUS.PRODUCING,
      paidAt: new Date(),
    },
  });

  return serializeOrder(updated);
};

/**
 * 获取订单列表
 */
export const getOrderList = async (
  userId: number,
  status?: string,
  page: number = 1,
  pageSize: number = 10
) => {
  const where: any = { userId: BigInt(userId) };

  if (status && status !== 'all') {
    where.status = status;
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        model: { include: { photo: true } },
        orderItems: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const list = orders.map((order) => ({
    ...serializeOrder(order),
    modelPreviewUrl: order.model.previewUrl,
    items: order.orderItems.map((item) => ({
      id: Number(item.id),
      itemType: item.itemType,
      itemSpec: item.itemSpec,
      price: parseFloat(item.price.toString()),
    })),
  }));

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

/**
 * 获取订单详情
 */
export const getOrderDetail = async (userId: number, orderId: number) => {
  const order = await prisma.order.findFirst({
    where: { id: BigInt(orderId), userId: BigInt(userId) },
    include: {
      model: { include: { photo: true } },
      address: true,
      orderItems: true,
    },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  return {
    ...serializeOrder(order),
    modelPreviewUrl: order.model.previewUrl,
    originalPhotoUrl: order.model.photo.originalUrl,
    address: {
      id: Number(order.address.id),
      name: order.address.name,
      phone: order.address.phone,
      province: order.address.province,
      city: order.address.city,
      district: order.address.district,
      detail: order.address.detail,
      fullAddress: `${order.address.province}${order.address.city}${order.address.district}${order.address.detail}`,
    },
    items: order.orderItems.map((item) => ({
      id: Number(item.id),
      itemType: item.itemType,
      itemSpec: item.itemSpec,
      price: parseFloat(item.price.toString()),
    })),
  };
};

/**
 * 通过订单编号获取订单详情
 */
export const getOrderByNo = async (userId: number, orderNo: string) => {
  const order = await prisma.order.findFirst({
    where: { orderNo, userId: BigInt(userId) },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  return getOrderDetail(userId, Number(order.id));
};

/**
 * 取消订单（仅待支付状态可取消）
 */
export const cancelOrder = async (userId: number, orderId: number) => {
  const order = await prisma.order.findFirst({
    where: { id: BigInt(orderId), userId: BigInt(userId) },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    throw new Error('只有待支付订单可以取消');
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: ORDER_STATUS.CANCELLED },
  });

  return serializeOrder(updated);
};

/**
 * 确认收货（仅已发货状态可确认）
 */
export const confirmReceive = async (userId: number, orderId: number) => {
  const order = await prisma.order.findFirst({
    where: { id: BigInt(orderId), userId: BigInt(userId) },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== ORDER_STATUS.SHIPPED) {
    throw new Error('订单状态不支持确认收货');
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: ORDER_STATUS.COMPLETED,
      completedAt: new Date(),
    },
  });

  return serializeOrder(updated);
};

/**
 * 申请退款
 */
export const applyRefund = async (
  userId: number,
  orderId: number,
  reason: string,
  description?: string
) => {
  const order = await prisma.order.findFirst({
    where: { id: BigInt(orderId), userId: BigInt(userId) },
  });

  if (!order) {
    throw new Error('订单不存在');
  }

  // 仅「已支付未制作（24h内）」和「已完成（7天内质量问题）」可退款
  const allowedStatuses = [ORDER_STATUS.PRODUCING, ORDER_STATUS.COMPLETED];
  if (!allowedStatuses.includes(order.status as any)) {
    throw new Error('当前订单状态不支持退款');
  }

  // 制作中状态 - 检查是否在24小时内
  if (order.status === ORDER_STATUS.PRODUCING && order.paidAt) {
    const hoursSincePaid = (Date.now() - order.paidAt.getTime()) / (1000 * 60 * 60);
    if (hoursSincePaid > 24) {
      throw new Error('已超过支付后24小时退款时限，定制品已开始制作不支持退款');
    }
  }

  // 已完成状态 - 检查是否在7天内
  if (order.status === ORDER_STATUS.COMPLETED && order.completedAt) {
    const daysSinceCompleted = (Date.now() - order.completedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCompleted > 7) {
      throw new Error('已超过收货后7天退款时限');
    }
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: ORDER_STATUS.REFUNDING },
  });

  return serializeOrder(updated);
};
