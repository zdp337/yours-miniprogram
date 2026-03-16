// 3D模型预览页 — Yours·凝刻

import { get } from '../../utils/request';

/** 3D 查看器的基础 URL（部署在后端 /public/ 路径下） */
const VIEWER_BASE_URL = 'http://43.138.185.112:3001/public/3d-viewer.html';

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 64,
    modelId: 0,
    modelUrl: '',
    previewUrl: '',
    originalPhotoUrl: '',
    viewerUrl: '', // web-view 3D 查看器完整 URL
    loading: true,
    loadProgress: 0,
    loadError: false,
    loadErrorMsg: '',
    showGuide: false,
    guideStep: 0,
    showSharePanel: false,
    showExportPanel: false,
    modelFileSize: '10-20',
    // 降级 2D 交互状态（无 modelUrl 时使用）
    rotationX: 0,
    rotationY: 0,
    scale: 1,
    autoRotate: true,
    lastTouchX: 0,
    lastTouchY: 0,
    lastTouchTime: 0,
    touchCount: 0,
    lastPinchDist: 0,
  },

  rotateTimer: null as any,
  loadTimer: null as any,

  onLoad(options: Record<string, string>) {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navHeight = statusBarHeight + 44;

    const modelId = parseInt(options.modelId || '0', 10);

    this.setData({ statusBarHeight, navHeight, modelId });

    if (modelId) {
      this.loadModelData(modelId);
    }

    // 首次引导
    const guideShown = wx.getStorageSync('model_preview_guide');
    if (!guideShown) {
      this.setData({ showGuide: true, guideStep: 3 });
    }
  },

  onUnload() {
    this.stopAutoRotate();
    if (this.loadTimer) clearTimeout(this.loadTimer);
  },

  /** 加载模型数据 */
  async loadModelData(modelId: number) {
    this.setData({ loading: true, loadError: false });

    // 模拟加载进度
    let progress = 0;
    const progressTimer = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      this.setData({ loadProgress: Math.floor(progress) });
    }, 300);

    try {
      const res = await get<{
        id: number;
        modelUrl: string;
        previewUrl: string;
        status: string;
        photo: { originalUrl: string; croppedUrl: string | null };
      }>(`/model/${modelId}/detail`);

      clearInterval(progressTimer);

      if (res.data.status !== 'completed') {
        this.setData({
          loading: false,
          loadError: true,
          loadErrorMsg: '模型尚未生成完成',
        });
        return;
      }

      this.setData({
        modelUrl: res.data.modelUrl || '',
        previewUrl: res.data.previewUrl || '',
        originalPhotoUrl: res.data.photo?.originalUrl || '',
        loadProgress: 100,
        loading: false,
      });

      // 如果有 3D 模型 URL，构建 web-view 查看器地址
      if (res.data.modelUrl) {
        const viewerUrl = `${VIEWER_BASE_URL}?modelUrl=${encodeURIComponent(res.data.modelUrl)}&previewUrl=${encodeURIComponent(res.data.previewUrl || '')}`;
        this.setData({ viewerUrl });
        console.log('[Preview] 3D 查看器 URL:', viewerUrl);
      } else {
        // 无 3D 模型文件，使用图片降级预览 + 自动旋转
        this.startAutoRotate();
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error('[Preview] 加载模型失败:', err);
      this.setData({
        loading: false,
        loadError: true,
        loadErrorMsg: '加载失败，请重试',
      });
    }
  },

  /** 开始自动旋转 */
  startAutoRotate() {
    this.stopAutoRotate();
    this.setData({ autoRotate: true });
    this.rotateTimer = setInterval(() => {
      if (this.data.autoRotate) {
        this.setData({
          rotationY: (this.data.rotationY + 0.5) % 360,
        });
      }
    }, 33); // ~30fps, 15°/s
  },

  /** 停止自动旋转 */
  stopAutoRotate() {
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
  },

  /** 触摸开始 */
  onTouchStart(e: WechatMiniprogram.TouchEvent) {
    const now = Date.now();
    const touches = e.touches;

    // 停止自动旋转
    this.setData({ autoRotate: false });

    if (touches.length === 1) {
      // 双击检测
      if (now - this.data.lastTouchTime < 300) {
        this.onDoubleTap();
        return;
      }

      this.setData({
        lastTouchX: touches[0].clientX,
        lastTouchY: touches[0].clientY,
        lastTouchTime: now,
        touchCount: 1,
      });
    } else if (touches.length === 2) {
      // 双指：记录初始距离
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.setData({ lastPinchDist: dist, touchCount: 2 });
    }
  },

  /** 触摸移动 */
  onTouchMove(e: WechatMiniprogram.TouchEvent) {
    const touches = e.touches;

    if (touches.length === 1 && this.data.touchCount === 1) {
      // 单指旋转
      const dx = touches[0].clientX - this.data.lastTouchX;
      const dy = touches[0].clientY - this.data.lastTouchY;

      let newRotationX = this.data.rotationX + dy * 0.5;
      let newRotationY = this.data.rotationY + dx * 0.5;

      // 垂直旋转限制 -30° ~ +60°
      newRotationX = Math.max(-30, Math.min(60, newRotationX));
      newRotationY = newRotationY % 360;

      this.setData({
        rotationX: newRotationX,
        rotationY: newRotationY,
        lastTouchX: touches[0].clientX,
        lastTouchY: touches[0].clientY,
      });
    } else if (touches.length === 2) {
      // 双指缩放
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (this.data.lastPinchDist > 0) {
        let newScale = this.data.scale * (dist / this.data.lastPinchDist);
        // 缩放范围 0.5x ~ 3x
        newScale = Math.max(0.5, Math.min(3, newScale));
        this.setData({ scale: newScale });
      }

      this.setData({ lastPinchDist: dist });
    }
  },

  /** 触摸结束 */
  onTouchEnd() {
    this.setData({ touchCount: 0, lastPinchDist: 0 });
  },

  /** 双击重置 */
  onDoubleTap() {
    this.setData({
      rotationX: 0,
      rotationY: 0,
      scale: 1,
    });
    this.startAutoRotate();
  },

  /** 关闭引导 */
  dismissGuide() {
    this.setData({ showGuide: false });
    wx.setStorageSync('model_preview_guide', true);
  },

  /** 分享 */
  onShareTap() {
    this.setData({ showSharePanel: true });
  },

  closeSharePanel() {
    this.setData({ showSharePanel: false });
  },

  onShareAppMessage() {
    return {
      title: '我在 Yours·凝刻生成了一个手办，快来看看！',
      path: `/pages/model-preview/model-preview?modelId=${this.data.modelId}`,
      imageUrl: this.data.previewUrl || '',
    };
  },

  generatePoster() {
    this.closeSharePanel();
    wx.showToast({ title: '海报功能即将上线', icon: 'none' });
  },

  /** 导出模型 */
  onExportModel() {
    this.setData({ showExportPanel: true });
  },

  closeExportPanel() {
    this.setData({ showExportPanel: false });
  },

  saveToPhone() {
    if (!this.data.modelUrl) {
      wx.showToast({ title: '模型文件不可用', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url: this.data.modelUrl,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          (wx as any).saveFile({
            tempFilePath: res.tempFilePath,
            success: () => {
              wx.showToast({ title: '保存成功', icon: 'success' });
              this.closeExportPanel();
            },
            fail: () => {
              wx.showToast({ title: '保存失败', icon: 'none' });
            },
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      },
    });
  },

  sendViaWechat() {
    if (!this.data.modelUrl) {
      wx.showToast({ title: '模型文件不可用', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备中...' });
    wx.downloadFile({
      url: this.data.modelUrl,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.shareFileMessage({
            filePath: res.tempFilePath,
            fileName: `yours-model-${this.data.modelId}.glb`,
            success: () => {
              this.closeExportPanel();
            },
            fail: () => {
              wx.showToast({ title: '发送失败', icon: 'none' });
            },
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      },
    });
  },

  /** 重新生成 */
  onRegenerate() {
    wx.showModal({
      title: '确认',
      content: '重新生成不会删除当前模型，确认继续？',
      confirmColor: '#333333',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/photo-upload/photo-upload' });
        }
      },
    });
  },

  /** 进入产品定制 */
  goToCustomize() {
    const { modelId, previewUrl, originalPhotoUrl } = this.data;
    wx.navigateTo({
      url: `/pages/product-customize/product-customize?modelId=${modelId}&modelPreviewUrl=${encodeURIComponent(previewUrl)}&originalPhotoUrl=${encodeURIComponent(originalPhotoUrl)}`,
    });
  },

  /** 重新加载 */
  reloadModel() {
    if (this.data.modelId) {
      this.loadModelData(this.data.modelId);
    }
  },

  /** 返回 */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },
});
