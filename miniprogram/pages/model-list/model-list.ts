// 我的模型列表页 — Yours·凝刻

import { get, del } from '../../utils/request';

interface ModelItem {
  id: number;
  photoId: number;
  status: string;
  modelUrl: string | null;
  previewUrl: string | null;
  failReason: string | null;
  retryCount: number;
  createdAt: string;
  completedAt: string | null;
  photo: {
    originalUrl: string;
    croppedUrl: string | null;
  };
  dateStr?: string;
  statusText?: string;
}

Page({
  data: {
    list: [] as ModelItem[],
    loading: true,
    remainUsage: 2,
    maxUsage: 2,
    usageLoaded: false,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 每次显示刷新
    if (!this.data.loading) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 加载数据 */
  async loadData() {
    this.setData({ loading: true });

    try {
      const [modelsRes, usageRes] = await Promise.all([
        get<{ list: ModelItem[] }>('/model/list'),
        get<{ remaining: number; max: number }>('/photo/usage'),
      ]);

      const list = (modelsRes.data.list || []).map((item: ModelItem) => ({
        ...item,
        dateStr: this.formatDate(item.createdAt),
        statusText: this.getStatusText(item.status),
      }));

      this.setData({
        list,
        remainUsage: usageRes.data.remaining,
        maxUsage: usageRes.data.max,
        usageLoaded: true,
        loading: false,
      });
    } catch (err) {
      console.error('[ModelList] 加载失败:', err);
      this.setData({ loading: false });
    }
  },

  /** 格式化日期 */
  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${min}`;
  },

  /** 状态文案 */
  getStatusText(status: string): string {
    const map: Record<string, string> = {
      queued: '排队中',
      generating: '生成中',
      completed: '已完成',
      failed: '生成失败',
    };
    return map[status] || status;
  },

  /** 卡片点击 */
  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const item = e.currentTarget.dataset.item as ModelItem;

    if (item.status === 'completed') {
      wx.navigateTo({
        url: `/pages/model-preview/model-preview?modelId=${item.id}`,
      });
    } else if (item.status === 'generating' || item.status === 'queued') {
      wx.navigateTo({
        url: `/pages/generate-waiting/generate-waiting?modelId=${item.id}&photoId=${item.photoId}`,
      });
    } else if (item.status === 'failed') {
      wx.navigateTo({
        url: `/pages/generate-failed/generate-failed?modelId=${item.id}&photoId=${item.photoId}&reason=${encodeURIComponent(item.failReason || '生成失败')}&retryCount=${item.retryCount}`,
      });
    }
  },

  /** 卡片长按 */
  onCardLongPress(e: WechatMiniprogram.TouchEvent) {
    const item = e.currentTarget.dataset.item as ModelItem;

    const actions = ['删除模型'];
    if (item.status === 'completed') {
      actions.unshift('定制手办');
    }

    wx.showActionSheet({
      itemList: actions,
      success: (res) => {
        if (item.status === 'completed' && res.tapIndex === 0) {
          // 定制手办
          wx.navigateTo({
            url: `/pages/product-customize/product-customize?modelId=${item.id}&modelPreviewUrl=${encodeURIComponent(item.previewUrl || '')}&originalPhotoUrl=${encodeURIComponent(item.photo?.originalUrl || '')}`,
          });
        } else {
          // 删除
          this.deleteModel(item.id);
        }
      },
    });
  },

  /** 删除模型 */
  deleteModel(modelId: number) {
    wx.showModal({
      title: '确认删除',
      content: '删除模型不影响已有订单，确认删除？',
      confirmColor: '#333333',
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/model/${modelId}`);
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadData();
          } catch (err) {
            console.error('[ModelList] 删除失败:', err);
          }
        }
      },
    });
  },

  /** 去上传照片 */
  goToUpload() {
    const skip = wx.getStorageSync('photo_guide_skip');
    if (skip) {
      wx.navigateTo({ url: '/pages/photo-upload/photo-upload' });
    } else {
      wx.navigateTo({ url: '/pages/photo-guide/photo-guide' });
    }
  },
});
