// 收货地址列表逻辑 — Yours·凝刻
import { get, put, del } from '../../utils/request';

interface AddressItem {
  id: number;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
  fullAddress: string;
}

Page({
  data: {
    addressList: [] as AddressItem[],
  },

  onShow() {
    this.loadAddressList();
  },

  /** 加载地址列表 */
  async loadAddressList() {
    try {
      const res = await get<{ list: AddressItem[] }>('/address/list');
      this.setData({ addressList: res.data.list });
    } catch (err) {
      console.error('[Address] 加载地址列表失败:', err);
    }
  },

  /** 新增地址 */
  addAddress() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  /** 编辑地址 */
  editAddress(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/address-edit/address-edit?id=${id}` });
  },

  /** 设为默认 */
  async setDefault(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    try {
      await put(`/address/${id}/default`);
      wx.showToast({ title: '设置成功', icon: 'success' });
      this.loadAddressList();
    } catch (err) {
      wx.showToast({ title: '设置失败', icon: 'none' });
    }
  },

  /** 删除地址 */
  deleteAddress(e: WechatMiniprogram.TouchEvent) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '提示',
      content: `确定删除「${name}」的收货地址吗？`,
      confirmColor: '#EE0A24',
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/address/${id}`);
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadAddressList();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  },
});
