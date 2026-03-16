// 产品定制页 — Yours·凝刻

import { get } from '../../utils/request';

interface SizeItem {
  id: string;
  name: string;
  height: string;
  price: number;
  desc: string;
  recommended?: boolean;
  inStock: boolean;
}

interface PrintType {
  id: string;
  name: string;
  size: string;
  price: number;
  desc: string;
}

interface BoxColor {
  id: string;
  name: string;
  hex: string;
}

interface PackageDeal {
  id: string;
  name: string;
  emoji: string;
  figurineSize: string;
  addons: Array<{ type: string; printType: string | null }>;
  price: number;
  originalPrice: number;
  discount: number;
  recommended?: boolean;
}

Page({
  data: {
    modelId: 0,
    modelPreviewUrl: '',
    originalPhotoUrl: '',

    // 产品配置
    sizes: [] as SizeItem[],
    printTypes: [] as PrintType[],
    boxColors: [] as BoxColor[],
    boxPrice: 0.01,
    packages: [] as PackageDeal[],
    material: '高精度树脂',

    // 用户选择
    selectedSize: 'M',
    selectedPackage: '',
    modelPhotoPrint: false,
    modelPhotoPrintType: '',
    originalPhotoPrint: false,
    originalPhotoPrintType: '',
    packageBox: false,
    boxColor: 'white',

    // 价格
    priceItems: [] as Array<{ type: string; spec: string; price: number }>,
    totalPrice: '0.00',
    discount: '0.00',
    payPrice: '0.00',

    showDetail: false,
    configLoaded: false,
  },

  onLoad(options: Record<string, string>) {
    const modelId = parseInt(options.modelId || '0', 10);
    const modelPreviewUrl = decodeURIComponent(options.modelPreviewUrl || '');
    const originalPhotoUrl = decodeURIComponent(options.originalPhotoUrl || '');

    this.setData({ modelId, modelPreviewUrl, originalPhotoUrl });

    this.loadProductConfig();
  },

  /** 加载产品配置 */
  async loadProductConfig() {
    try {
      const res = await get<{
        figurineSizes: SizeItem[];
        printTypes: PrintType[];
        boxColors: BoxColor[];
        boxPrice: number;
        packageDeals: PackageDeal[];
        material: string;
      }>('/product/config');

      this.setData({
        sizes: res.data.figurineSizes,
        printTypes: res.data.printTypes,
        boxColors: res.data.boxColors,
        boxPrice: res.data.boxPrice,
        packages: res.data.packageDeals,
        material: res.data.material,
        configLoaded: true,
      });

      // 计算默认价格
      this.calculatePrice();
    } catch (err) {
      console.error('[Customize] 加载配置失败:', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  /** 选择套餐 */
  onPackageSelect(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const pkg = this.data.packages.find((p) => p.id === id);
    if (!pkg) return;

    // 同步套餐选项到自由定制
    const updateData: Record<string, any> = {
      selectedPackage: id,
      selectedSize: pkg.figurineSize,
      modelPhotoPrint: false,
      modelPhotoPrintType: '',
      originalPhotoPrint: false,
      originalPhotoPrintType: '',
      packageBox: false,
      boxColor: 'white',
    };

    pkg.addons.forEach((addon) => {
      if (addon.type === 'model_photo_print') {
        updateData.modelPhotoPrint = true;
        updateData.modelPhotoPrintType = addon.printType || 'card';
      } else if (addon.type === 'original_photo_print') {
        updateData.originalPhotoPrint = true;
        updateData.originalPhotoPrintType = addon.printType || 'photo_paper';
      } else if (addon.type === 'package_box') {
        updateData.packageBox = true;
      }
    });

    this.setData(updateData);
    this.calculatePrice();
  },

  /** 选择尺寸 */
  onSizeSelect(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const size = this.data.sizes.find((s) => s.id === id);
    if (!size || !size.inStock) return;

    this.setData({ selectedSize: id });
    this.matchPackage();
    this.calculatePrice();
  },

  /** 开关周边 */
  toggleAddon(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    const current = (this.data as Record<string, any>)[key];
    const update: Record<string, any> = { [key]: !current };

    // 打开时设置默认选项
    if (!current) {
      if (key === 'modelPhotoPrint') update.modelPhotoPrintType = 'card';
      if (key === 'originalPhotoPrint') update.originalPhotoPrintType = 'photo_paper';
      if (key === 'packageBox') update.boxColor = 'white';
    }

    this.setData(update);
    this.matchPackage();
    this.calculatePrice();
  },

  /** 选择模型打印类型 */
  onModelPrintTypeSelect(e: WechatMiniprogram.TouchEvent) {
    this.setData({ modelPhotoPrintType: e.currentTarget.dataset.id });
    this.matchPackage();
    this.calculatePrice();
  },

  /** 选择真人打印类型 */
  onOriginalPrintTypeSelect(e: WechatMiniprogram.TouchEvent) {
    this.setData({ originalPhotoPrintType: e.currentTarget.dataset.id });
    this.matchPackage();
    this.calculatePrice();
  },

  /** 选择包装盒颜色 */
  onBoxColorSelect(e: WechatMiniprogram.TouchEvent) {
    this.setData({ boxColor: e.currentTarget.dataset.id });
  },

  /** 尝试匹配套餐 */
  matchPackage() {
    const { selectedSize, modelPhotoPrint, modelPhotoPrintType, originalPhotoPrint, originalPhotoPrintType, packageBox } = this.data;

    // 构建当前选择的 addons 集合
    const currentAddons = new Set<string>();
    if (modelPhotoPrint && modelPhotoPrintType) {
      currentAddons.add(`model_photo_print:${modelPhotoPrintType}`);
    }
    if (originalPhotoPrint && originalPhotoPrintType) {
      currentAddons.add(`original_photo_print:${originalPhotoPrintType}`);
    }
    if (packageBox) {
      currentAddons.add('package_box:null');
    }

    // 匹配套餐
    let matched = '';
    for (const pkg of this.data.packages) {
      if (pkg.figurineSize !== selectedSize) continue;

      const pkgAddons = new Set(
        pkg.addons.map((a) => `${a.type}:${a.printType}`)
      );

      if (pkgAddons.size === currentAddons.size) {
        let allMatch = true;
        pkgAddons.forEach((a) => {
          if (!currentAddons.has(a as string)) allMatch = false;
        });
        if (allMatch) {
          matched = pkg.id;
          break;
        }
      }
    }

    this.setData({ selectedPackage: matched });
  },

  /** 计算价格（前端实时计算） */
  calculatePrice() {
    const items: Array<{ type: string; spec: string; price: number }> = [];

    // 手办
    const size = this.data.sizes.find((s) => s.id === this.data.selectedSize);
    if (size) {
      items.push({ type: 'figurine', spec: `Q版手办（${size.name}）`, price: size.price });
    }

    // 模型照片打印
    if (this.data.modelPhotoPrint && this.data.modelPhotoPrintType) {
      const pt = this.data.printTypes.find((p) => p.id === this.data.modelPhotoPrintType);
      if (pt) {
        items.push({ type: 'model_photo_print', spec: `模型照片·${pt.name}`, price: pt.price });
      }
    }

    // 真人照片打印
    if (this.data.originalPhotoPrint && this.data.originalPhotoPrintType) {
      const pt = this.data.printTypes.find((p) => p.id === this.data.originalPhotoPrintType);
      if (pt) {
        items.push({ type: 'original_photo_print', spec: `真人照片·${pt.name}`, price: pt.price });
      }
    }

    // 包装盒
    if (this.data.packageBox) {
      const color = this.data.boxColors.find((c) => c.id === this.data.boxColor);
      items.push({
        type: 'package_box',
        spec: `专属包装盒（${color ? color.name : '经典白'}）`,
        price: this.data.boxPrice,
      });
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);

    // 套餐优惠
    let discount = 0;
    if (this.data.selectedPackage) {
      const pkg = this.data.packages.find((p) => p.id === this.data.selectedPackage);
      if (pkg) discount = pkg.discount;
    }

    const pay = Math.max(0, total - discount);

    this.setData({
      priceItems: items,
      totalPrice: total.toFixed(2),
      discount: discount.toFixed(2),
      payPrice: pay.toFixed(2),
    });
  },

  /** 显示价格明细 */
  showPriceDetail() {
    this.setData({ showDetail: true });
  },

  hidePriceDetail() {
    this.setData({ showDetail: false });
  },

  /** 返回3D预览 */
  goBackPreview() {
    wx.navigateBack();
  },

  /** 提交订单 */
  onSubmitOrder() {
    if (!this.data.selectedSize) {
      wx.showToast({ title: '请先选择手办尺寸', icon: 'none' });
      return;
    }

    // 获取手办价格
    const sizeItem = this.data.sizes.find((s) => s.id === this.data.selectedSize);

    const orderData = {
      modelId: this.data.modelId,
      modelPreviewUrl: this.data.modelPreviewUrl,
      originalPhotoUrl: this.data.originalPhotoUrl,
      figurineSize: this.data.selectedSize,
      figurinePrice: sizeItem ? sizeItem.price : 0.01,
      addons: this.data.priceItems.filter((i) => i.type !== 'figurine'),
      packageDealId: this.data.selectedPackage || null,
      totalPrice: this.data.totalPrice,
      discount: this.data.discount,
      payPrice: this.data.payPrice,
      // 传递定制选项（供订单确认页创建订单使用）
      modelPhotoPrint: this.data.modelPhotoPrint && this.data.modelPhotoPrintType
        ? { enabled: true, printType: this.data.modelPhotoPrintType }
        : { enabled: false },
      originalPhotoPrint: this.data.originalPhotoPrint && this.data.originalPhotoPrintType
        ? { enabled: true, printType: this.data.originalPhotoPrintType }
        : { enabled: false },
      packageBox: this.data.packageBox
        ? { enabled: true, color: this.data.boxColor }
        : { enabled: false },
    };

    wx.navigateTo({
      url: `/pages/order-confirm/order-confirm?data=${encodeURIComponent(JSON.stringify(orderData))}`,
    });
  },
});
