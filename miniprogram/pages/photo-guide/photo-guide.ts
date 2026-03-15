// 拍照引导页 — Yours·凝刻

import { setCache } from '../../utils/storage';

Page({
  data: {
    noMore: false,
  },

  /** 切换"不再提示" */
  toggleNoMore() {
    this.setData({ noMore: !this.data.noMore });
  },

  /** 进入照片上传页 */
  goToUpload() {
    if (this.data.noMore) {
      setCache('photo_guide_skip', true);
    }
    wx.navigateTo({ url: '/pages/photo-upload/photo-upload' });
  },
});
