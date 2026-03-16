// 照片裁剪页 — Yours·凝刻

import { post, put } from '../../utils/request';

Page({
  data: {
    imageSrc: '',
    photoId: 0,
    rotation: 0,
    imgX: 0,
    imgY: 0,
    currentScale: 1,
    isFreeRatio: false,
    ratioText: '3:5',
    canvasWidth: 300,
    canvasHeight: 500,
  },

  onLoad(options: Record<string, string>) {
    const src = decodeURIComponent(options.src || '');
    const photoId = parseInt(options.photoId || '0', 10);
    this.setData({ imageSrc: src, photoId });
  },

  /** 图片移动 */
  onImageMove(e: any) {
    // 记录位置信息
  },

  /** 图片缩放 */
  onImageScale(e: any) {
    this.setData({ currentScale: e.detail.scale });
  },

  /** 旋转 90° */
  onRotate() {
    this.setData({
      rotation: (this.data.rotation + 90) % 360,
    });
  },

  /** 重置 */
  onReset() {
    this.setData({
      rotation: 0,
      imgX: 0,
      imgY: 0,
      currentScale: 1,
    });
  },

  /** 切换比例 */
  onToggleRatio() {
    const isFree = !this.data.isFreeRatio;
    this.setData({
      isFreeRatio: isFree,
      ratioText: isFree ? '自由' : '3:5',
    });
  },

  /** 重新选择 */
  onReselect() {
    wx.navigateBack();
  },

  /** 确认使用 - 裁剪并上传 */
  async onConfirm() {
    wx.showLoading({ title: '处理中...', mask: true });

    try {
      // 使用 canvas 进行裁剪
      const croppedPath = await this.cropImage();

      // 上传原图（如果是本地新选的照片，不是历史照片）
      let photoId = this.data.photoId;

      if (!photoId) {
        // 上传原图
        const originalUrl = await this.uploadToServer(this.data.imageSrc);
        // 上传裁剪图
        const croppedUrl = await this.uploadToServer(croppedPath);
        // 创建照片记录
        const res = await post<{ id: number }>('/photo', {
          originalUrl,
          croppedUrl,
        }, { silent401: true });
        photoId = res.data.id;
      } else {
        // 历史照片，只更新裁剪结果
        const croppedUrl = await this.uploadToServer(croppedPath);
        await put(`/photo/${photoId}/crop`, { croppedUrl }, { silent401: true });
      }

      wx.hideLoading();

      // 弹窗选择 AI 引擎
      this.showEngineSelector(photoId);
    } catch (err: any) {
      wx.hideLoading();
      // token 过期：提示用户重新登录
      if (err.message === 'TOKEN_EXPIRED') {
        wx.showModal({
          title: '登录已过期',
          content: '请重新登录后继续操作',
          showCancel: false,
          success: () => {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.reLaunch({ url: '/pages/welcome/welcome' });
          },
        });
        return;
      }
      wx.showToast({ title: err.message || '处理失败', icon: 'none' });
    }
  },

  /** 裁剪图片 */
  cropImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      const query = this.createSelectorQuery();
      query
        .select('#cropCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            // fallback: 直接使用原图
            resolve(this.data.imageSrc);
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo().pixelRatio;

          // 设置 canvas 尺寸
          const cropW = this.data.isFreeRatio ? 400 : 300;
          const cropH = this.data.isFreeRatio ? 400 : 500;
          canvas.width = cropW * dpr;
          canvas.height = cropH * dpr;
          ctx.scale(dpr, dpr);

          const img = canvas.createImage();
          img.onload = () => {
            // 居中绘制
            ctx.save();
            ctx.translate(cropW / 2, cropH / 2);
            ctx.rotate((this.data.rotation * Math.PI) / 180);

            const scale = Math.max(cropW / img.width, cropH / img.height) * this.data.currentScale;
            ctx.drawImage(
              img,
              (-img.width * scale) / 2,
              (-img.height * scale) / 2,
              img.width * scale,
              img.height * scale
            );
            ctx.restore();

            // 导出
            wx.canvasToTempFilePath({
              canvas,
              x: 0,
              y: 0,
              width: canvas.width,
              height: canvas.height,
              destWidth: cropW * 2,
              destHeight: cropH * 2,
              fileType: 'jpg',
              quality: 0.9,
              success: (result) => resolve(result.tempFilePath),
              fail: () => resolve(this.data.imageSrc),
            });
          };
          img.onerror = () => resolve(this.data.imageSrc);
          img.src = this.data.imageSrc;
        });
    });
  },

  /** 上传文件到服务器 */
  uploadToServer(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token') || '';
      const app = getApp();
      const baseUrl = app?.globalData?.baseUrl || 'http://localhost:3000/api';

      wx.uploadFile({
        url: `${baseUrl}/photo/upload-file`,
        filePath,
        name: 'file',
        header: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0 && data.data?.url) {
              resolve(data.data.url);
            } else if (res.statusCode === 401 || data.code === 401) {
              // token 过期，抛出特定错误，由调用方统一处理
              console.error('[Upload] 401 鉴权失败，token 可能已过期');
              reject(new Error('TOKEN_EXPIRED'));
            } else {
              reject(new Error(data.message || '上传失败'));
            }
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        },
        fail: () => reject(new Error('文件上传失败')),
      });
    });
  },

  /** 弹窗选择 AI 引擎 */
  showEngineSelector(photoId: number) {
    wx.showActionSheet({
      itemList: ['Tripo3D 引擎', '混元3D 引擎'],
      success: (res) => {
        const engines = ['tripo', 'hunyuan'];
        const engine = engines[res.tapIndex] || 'tripo';
        wx.redirectTo({
          url: `/pages/generate-waiting/generate-waiting?photoId=${photoId}&engine=${engine}`,
        });
      },
      fail: () => {
        // 用户取消选择，不跳转，提示可重新点击确认
        wx.showToast({ title: '已取消，可重新操作', icon: 'none' });
      },
    });
  },
});
