// 照片上传页 — Yours·凝刻

import { get, del } from '../../utils/request';

interface PhotoItem {
  id: number;
  originalUrl: string;
  croppedUrl: string | null;
  createdAt: string;
  dateStr: string;
}

Page({
  data: {
    remainCount: 2,
    dailyLimit: 2,
    photoList: [] as PhotoItem[],
    showActionSheet: false,
  },

  onShow() {
    this.loadUsage();
    this.loadPhotoList();
  },

  /** 加载每日次数 */
  async loadUsage() {
    try {
      const res = await get<{ remainCount: number; dailyLimit: number }>('/photo/usage');
      this.setData({
        remainCount: res.data.remainCount,
        dailyLimit: res.data.dailyLimit,
      });
    } catch (err) {
      console.error('[Upload] 加载次数失败:', err);
    }
  },

  /** 加载历史照片 */
  async loadPhotoList() {
    try {
      const res = await get<{ list: any[] }>('/photo/list');
      const list = (res.data.list || []).map((item: any) => ({
        ...item,
        dateStr: this.formatDate(item.createdAt),
      }));
      this.setData({ photoList: list });
    } catch (err) {
      console.error('[Upload] 加载历史照片失败:', err);
    }
  },

  /** 格式化日期 */
  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  },

  /** 点击上传区域 */
  onUploadTap() {
    if (this.data.remainCount <= 0) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' });
      return;
    }
    this.setData({ showActionSheet: true });
  },

  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  /** 拍照 */
  takePhoto() {
    this.setData({ showActionSheet: false });
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      sizeType: ['original'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        this.handleSelectedImage(tempFile.tempFilePath, tempFile.size);
      },
    });
  },

  /** 从相册选择 */
  chooseFromAlbum() {
    this.setData({ showActionSheet: false });
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['original'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        this.handleSelectedImage(tempFile.tempFilePath, tempFile.size);
      },
    });
  },

  /** 处理选中的图片 */
  handleSelectedImage(tempFilePath: string, size: number) {
    // 大小校验 (20MB)
    if (size > 20 * 1024 * 1024) {
      wx.showToast({ title: '图片大小不能超过20MB', icon: 'none' });
      return;
    }

    // 分辨率校验
    wx.getImageInfo({
      src: tempFilePath,
      success: (info) => {
        if (info.width < 500 || info.height < 800) {
          wx.showModal({
            title: '照片分辨率不足',
            content: '请选择宽≥500像素、高≥800像素的照片，以确保生成效果',
            showCancel: false,
            confirmText: '重新选择',
          });
          return;
        }
        // 进入裁剪页
        wx.navigateTo({
          url: `/pages/photo-crop/photo-crop?src=${encodeURIComponent(tempFilePath)}`,
        });
      },
      fail: () => {
        wx.showToast({ title: '无法读取图片信息', icon: 'none' });
      },
    });
  },

  /** 点击历史照片 */
  onHistoryTap(e: any) {
    if (this.data.remainCount <= 0) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' });
      return;
    }
    const { index } = e.currentTarget.dataset;
    const photo = this.data.photoList[index];
    const imgUrl = photo.croppedUrl || photo.originalUrl;
    // 使用历史照片直接进入裁剪页
    wx.navigateTo({
      url: `/pages/photo-crop/photo-crop?src=${encodeURIComponent(imgUrl)}&photoId=${photo.id}`,
    });
  },

  /** 长按历史照片 - 删除 */
  onHistoryLongPress(e: any) {
    const { id, index } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除照片',
      content: '确定要删除这张照片吗？',
      confirmColor: '#EE0A24',
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/photo/${id}`);
            const list = [...this.data.photoList];
            list.splice(index, 1);
            this.setData({ photoList: list });
            wx.showToast({ title: '已删除', icon: 'success' });
          } catch (err) {
            console.error('[Upload] 删除照片失败:', err);
          }
        }
      },
    });
  },

  /** 查看拍照指南 */
  goToGuide() {
    wx.navigateTo({ url: '/pages/photo-guide/photo-guide' });
  },
});
