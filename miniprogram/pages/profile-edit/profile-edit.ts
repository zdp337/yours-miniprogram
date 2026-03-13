// 个人信息编辑逻辑 — Yours·凝刻
import { getLocalUserInfo, bindPhone } from '../../utils/auth';
import { put } from '../../utils/request';

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    phone: '',
    isSaving: false,
  },

  onLoad() {
    const userInfo = getLocalUserInfo();
    if (userInfo) {
      this.setData({
        avatarUrl: userInfo.avatarUrl || '',
        nickname: userInfo.nickname || '',
        phone: userInfo.phone || '',
      });
    }
  },

  /** 选择头像 */
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ avatarUrl: tempFilePath });
        // TODO: 上传到 COS，获取正式 URL
      },
    });
  },

  /** 昵称输入 */
  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
  },

  /** 获取手机号 */
  async onGetPhoneNumber(e: WechatMiniprogram.GetPhoneNumberEvent) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok' || !e.detail.code) {
      wx.showToast({ title: '取消绑定手机号', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '绑定中...', mask: true });
      const result = await bindPhone(e.detail.code);
      this.setData({ phone: result.phone });
      wx.hideLoading();
      wx.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' });
    }
  },

  /** 保存 */
  async handleSave() {
    const { nickname, avatarUrl } = this.data;

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    try {
      await put('/user/info', { nickname: nickname.trim(), avatarUrl });

      // 更新本地缓存
      const userInfo = getLocalUserInfo();
      if (userInfo) {
        userInfo.nickname = nickname.trim();
        userInfo.avatarUrl = avatarUrl;
        wx.setStorageSync('userInfo', JSON.stringify(userInfo));
      }

      wx.showToast({ title: '保存成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});
