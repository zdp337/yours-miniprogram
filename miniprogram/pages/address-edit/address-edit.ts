// 地址编辑逻辑 — Yours·凝刻
import { get, post, put, del } from '../../utils/request';

interface FormData {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
}

Page({
  data: {
    isEdit: false,
    addressId: 0,
    isSaving: false,
    region: [] as string[],
    regionText: '',
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false,
    } as FormData,
  },

  onLoad(options: Record<string, string | undefined>) {
    if (options.id) {
      this.setData({
        isEdit: true,
        addressId: parseInt(options.id, 10),
      });
      wx.setNavigationBarTitle({ title: '编辑地址' });
      this.loadAddress(parseInt(options.id, 10));
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
    }
  },

  /** 加载地址详情（编辑模式） */
  async loadAddress(id: number) {
    try {
      const res = await get<FormData & { id: number }>(`/address/${id}`);
      const addr = res.data;

      this.setData({
        formData: {
          name: addr.name,
          phone: addr.phone,
          province: addr.province,
          city: addr.city,
          district: addr.district,
          detail: addr.detail,
          isDefault: addr.isDefault,
        },
        region: [addr.province, addr.city, addr.district],
        regionText: `${addr.province} ${addr.city} ${addr.district}`,
      });
    } catch (err) {
      wx.showToast({ title: '加载地址失败', icon: 'none' });
    }
  },

  /** 通用输入处理 */
  onInput(e: WechatMiniprogram.Input) {
    const field = (e.currentTarget as any).dataset.field as keyof FormData;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  /** 打开省市区选择器 */
  openRegionPicker() {
    // 通过模拟点击触发 picker
    // 由于小程序限制，使用 picker 组件
    this.setData({ _showRegionPicker: true });
  },

  /** 省市区选择回调 */
  onRegionChange(e: WechatMiniprogram.PickerChange) {
    const region = e.detail.value as string[];
    this.setData({
      region,
      regionText: region.join(' '),
      'formData.province': region[0],
      'formData.city': region[1],
      'formData.district': region[2],
    });
  },

  /** 默认地址开关 */
  onDefaultChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'formData.isDefault': e.detail.value });
  },

  /** 保存 */
  async handleSave() {
    const { formData, isEdit, addressId } = this.data;

    // 校验
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(formData.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!formData.province) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    if (!formData.detail.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    try {
      if (isEdit) {
        await put(`/address/${addressId}`, formData);
      } else {
        await post('/address', formData);
      }

      wx.showToast({
        title: isEdit ? '修改成功' : '添加成功',
        icon: 'success',
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  /** 删除地址 */
  handleDelete() {
    const { addressId, formData } = this.data;

    wx.showModal({
      title: '提示',
      content: `确定删除「${formData.name}」的收货地址吗？`,
      confirmColor: '#EE0A24',
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/address/${addressId}`);
            wx.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  },
});
