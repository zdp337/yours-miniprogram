// AI生成等待页 — Yours·凝刻（多引擎版）

import { post, get } from '../../utils/request';

const ENGINE_LABELS: Record<string, string> = {
  tripo: 'Tripo3D',
  hunyuan: '混元3D',
};

Page({
  data: {
    photoId: 0,
    modelId: 0,
    engine: 'tripo', // tripo | hunyuan
    engineLabel: 'Tripo3D',
    status: 'uploading', // uploading | queued | generating | completed | failed
    statusTitle: '正在上传照片...',
    statusDesc: '准备中',
    statusEmoji: '🎨',
    progressPercent: 10,
    subscribed: false,
  },

  pollTimer: null as any,

  onLoad(options: Record<string, string>) {
    const photoId = parseInt(options.photoId || '0', 10);
    const modelId = parseInt(options.modelId || '0', 10);
    const engine = options.engine || 'tripo';
    const engineLabel = ENGINE_LABELS[engine] || engine;

    this.setData({ engine, engineLabel });

    if (modelId) {
      // 从失败页重试过来，直接轮询
      this.setData({ modelId, photoId });
      this.startPolling();
    } else if (photoId) {
      this.setData({ photoId });
      this.startGenerate(photoId, engine);
    }
  },

  onUnload() {
    this.stopPolling();
  },

  onHide() {
    // 页面隐藏不停止轮询，后台继续
  },

  /** 发起生成 */
  async startGenerate(photoId: number, engine: string) {
    // 调试：打印当前 token 状态
    const token = wx.getStorageSync('token') || '';
    console.log(`[Waiting] startGenerate 开始, photoId=${photoId}, engine=${engine}, token长度=${token.length}, token前20位="${token.slice(0, 20)}..."`);

    this.updateStatus('uploading', '正在上传照片...', '准备中', '📤', 15);

    try {
      const res = await post<{ id: number; status: string; engine: string }>(
        '/model/generate',
        { photoId, engine },
        { silent401: true }
      );
      console.log(`[Waiting] 生成请求成功, modelId=${res.data.id}`);
      this.setData({
        modelId: res.data.id,
        engine: res.data.engine || engine,
        engineLabel: ENGINE_LABELS[res.data.engine || engine] || engine,
      });
      this.updateStatus(
        'queued',
        `${this.data.engineLabel} 排队中...`,
        '请耐心等待',
        '⏳',
        30
      );
      this.startPolling();
    } catch (err: any) {
      console.error(`[Waiting] startGenerate 失败:`, err.message, err);
      // token 过期：停止流程，提示用户重新登录
      if (err.message === 'TOKEN_EXPIRED') {
        wx.showModal({
          title: '登录已过期',
          content: `token长度=${token.length}，请点确定重新登录。如反复出现请打开vConsole查看日志。`,
          showCancel: false,
          success: () => {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.reLaunch({ url: '/pages/welcome/welcome' });
          },
        });
        return;
      }
      if (err.message?.includes('次数已用完')) {
        wx.showModal({
          title: '提示',
          content: '今日免费次数已用完，明天再来试试吧~',
          showCancel: false,
          success: () => wx.navigateBack(),
        });
        return;
      }
      // 跳转到失败页
      wx.redirectTo({
        url: `/pages/generate-failed/generate-failed?photoId=${photoId}&engine=${engine}&reason=${encodeURIComponent(err.message || '生成遇到了一些问题，请重试')}`,
      });
    }
  },

  /** 开始轮询 */
  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.checkStatus();
    }, 3000);
    // 立即检查一次
    this.checkStatus();
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  /** 检查生成状态 */
  async checkStatus() {
    if (!this.data.modelId) return;

    try {
      const res = await get<{
        status: string;
        engine: string;
        modelUrl: string | null;
        previewUrl: string | null;
        failReason: string | null;
        retryCount: number;
      }>(`/model/${this.data.modelId}/status`, undefined, { silent401: true });

      const { status, engine, failReason, retryCount } = res.data;

      // 更新引擎信息
      if (engine) {
        this.setData({
          engine,
          engineLabel: ENGINE_LABELS[engine] || engine,
        });
      }

      switch (status) {
        case 'queued':
          this.updateStatus(
            'queued',
            `${this.data.engineLabel} 排队中...`,
            '请耐心等待',
            '⏳',
            30
          );
          break;

        case 'generating':
          this.updateStatus(
            'generating',
            `${this.data.engineLabel} 正在创作你的手办...`,
            '马上就好',
            '🎨',
            65
          );
          break;

        case 'completed':
          this.stopPolling();
          this.updateStatus('completed', '🎉 你的手办生成好了！', '', '✨', 100);
          break;

        case 'failed':
          this.stopPolling();
          wx.redirectTo({
            url: `/pages/generate-failed/generate-failed?modelId=${this.data.modelId}&photoId=${this.data.photoId}&engine=${this.data.engine}&reason=${encodeURIComponent(failReason || '生成遇到了一些问题')}&retryCount=${retryCount}`,
          });
          break;
      }
    } catch (err: any) {
      console.error('[Waiting] 状态查询失败:', err);
      // token 过期时停止轮询，提示用户重新登录
      if (err.message === 'TOKEN_EXPIRED') {
        this.stopPolling();
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
      }
    }
  },

  /** 更新状态展示 */
  updateStatus(
    status: string,
    title: string,
    desc: string,
    emoji: string,
    progress: number
  ) {
    this.setData({
      status,
      statusTitle: title,
      statusDesc: desc,
      statusEmoji: emoji,
      progressPercent: progress,
    });
  },

  /** 订阅消息 */
  onSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['YOUR_TEMPLATE_ID'], // 替换为实际模板 ID
      success: (res) => {
        this.setData({ subscribed: true });
      },
      fail: () => {
        wx.showToast({ title: '未授权通知', icon: 'none' });
      },
    });
  },

  /** 查看模型预览 */
  goToPreview() {
    wx.redirectTo({
      url: `/pages/model-preview/model-preview?modelId=${this.data.modelId}`,
    });
  },

  /** 回首页 */
  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /** 返回拦截 */
  onBackPress() {
    if (this.data.status !== 'completed') {
      wx.showModal({
        title: '提示',
        content: '生成进行中，离开不影响生成哦',
        confirmText: '离开',
        cancelText: '继续等待',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        },
      });
      return;
    }
    wx.navigateBack();
  },
});
