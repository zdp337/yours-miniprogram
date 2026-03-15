/**
 * 产品配置与定价服务 — Yours·凝刻
 * 手办尺寸 / 周边产品 / 套餐定义 / 价格计算
 */

/** 手办尺寸配置 */
export const FIGURINE_SIZES = [
  {
    id: 'S',
    name: 'S 迷你款',
    height: '约8cm',
    price: 0.01,
    desc: '精致小巧，适合桌面摆放',
    inStock: true,
  },
  {
    id: 'M',
    name: 'M 标准款',
    height: '约12cm',
    price: 0.01,
    desc: '推荐，最佳观感',
    recommended: true,
    inStock: true,
  },
  {
    id: 'L',
    name: 'L 豪华款',
    height: '约18cm',
    price: 0.01,
    desc: '大尺寸，细节丰富',
    inStock: true,
  },
];

/** 打印类型配置 */
export const PRINT_TYPES = [
  {
    id: 'photo_paper',
    name: '相纸打印',
    size: '6寸',
    price: 0.01,
    desc: '高清照片纸',
  },
  {
    id: 'card',
    name: '精致卡片',
    size: '8.5×5.4cm',
    price: 0.01,
    desc: '铜版纸卡片，圆角切割',
  },
  {
    id: 'acrylic',
    name: '亚克力板',
    size: '10×15cm',
    price: 0.01,
    desc: '透明亚克力 + UV 彩印，含底座',
  },
];

/** 包装盒颜色配置 */
export const BOX_COLORS = [
  { id: 'white', name: '经典白', hex: '#FFFFFF' },
  { id: 'black', name: '雅致黑', hex: '#2D2D2D' },
  { id: 'sakura_pink', name: '樱花粉', hex: '#FFB7C5' },
  { id: 'sky_blue', name: '天空蓝', hex: '#87CEEB' },
  { id: 'mint_green', name: '薄荷绿', hex: '#98FF98' },
  { id: 'lemon_yellow', name: '柠檬黄', hex: '#FFF44F' },
  { id: 'lavender', name: '薰衣草紫', hex: '#E6E6FA' },
  { id: 'coral_orange', name: '珊瑚橙', hex: '#FF7F50' },
];

/** 包装盒价格 */
export const BOX_PRICE = 0.01;

/** 套餐配置 */
export const PACKAGE_DEALS = [
  {
    id: 'basic',
    name: '基础款',
    emoji: '🌟',
    figurineSize: 'S',
    addons: [],
    price: 0.01,
    originalPrice: 0.01,
    discount: 0,
  },
  {
    id: 'deluxe',
    name: '精致款',
    emoji: '💎',
    recommended: true,
    figurineSize: 'M',
    addons: [
      { type: 'package_box', printType: null },
      { type: 'model_photo_print', printType: 'card' },
    ],
    price: 0.02,
    originalPrice: 0.03,
    discount: 0.01,
  },
  {
    id: 'premium',
    name: '豪华款',
    emoji: '👑',
    figurineSize: 'L',
    addons: [
      { type: 'package_box', printType: null },
      { type: 'model_photo_print', printType: 'acrylic' },
      { type: 'original_photo_print', printType: 'photo_paper' },
    ],
    price: 0.03,
    originalPrice: 0.04,
    discount: 0.01,
  },
];

/** 价格计算接口 */
export interface PriceCalcInput {
  figurineSize: string;
  modelPhotoPrint?: { enabled: boolean; printType?: string };
  originalPhotoPrint?: { enabled: boolean; printType?: string };
  packageBox?: { enabled: boolean; color?: string };
  packageDealId?: string;
}

/** 计算价格 */
export const calculatePrice = (input: PriceCalcInput) => {
  const items: Array<{ type: string; spec: string; price: number }> = [];

  // 手办价格
  const size = FIGURINE_SIZES.find((s) => s.id === input.figurineSize);
  if (!size) throw new Error('无效的手办尺寸');
  items.push({ type: 'figurine', spec: size.name, price: size.price });

  // 模型照片打印
  if (input.modelPhotoPrint?.enabled && input.modelPhotoPrint.printType) {
    const pt = PRINT_TYPES.find((p) => p.id === input.modelPhotoPrint!.printType);
    if (pt) {
      items.push({ type: 'model_photo_print', spec: pt.name, price: pt.price });
    }
  }

  // 真人照片打印
  if (input.originalPhotoPrint?.enabled && input.originalPhotoPrint.printType) {
    const pt = PRINT_TYPES.find((p) => p.id === input.originalPhotoPrint!.printType);
    if (pt) {
      items.push({ type: 'original_photo_print', spec: pt.name, price: pt.price });
    }
  }

  // 包装盒
  if (input.packageBox?.enabled) {
    const color = BOX_COLORS.find((c) => c.id === input.packageBox!.color) || BOX_COLORS[0];
    items.push({ type: 'package_box', spec: color.name, price: BOX_PRICE });
  }

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  // 套餐优惠
  let discount = 0;
  let packageDeal = null;
  if (input.packageDealId) {
    packageDeal = PACKAGE_DEALS.find((p) => p.id === input.packageDealId);
    if (packageDeal) {
      discount = packageDeal.discount;
    }
  }

  const payPrice = Math.max(0, totalPrice - discount);

  return {
    items,
    totalPrice: parseFloat(totalPrice.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    shippingFee: 0,
    payPrice: parseFloat(payPrice.toFixed(2)),
    packageDeal: packageDeal
      ? { id: packageDeal.id, name: packageDeal.name, discount: packageDeal.discount }
      : null,
  };
};

/** 获取全部产品配置 */
export const getProductConfig = () => {
  return {
    figurineSizes: FIGURINE_SIZES,
    printTypes: PRINT_TYPES,
    boxColors: BOX_COLORS,
    boxPrice: BOX_PRICE,
    packageDeals: PACKAGE_DEALS,
    material: '高精度树脂',
  };
};
