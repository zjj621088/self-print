const { parseStoreCode } = require("../../utils/store-code");

Page({
  data: { code: "" },
  onLoad(options) {
    const code = parseStoreCode(options.code || options.scene || "");
    if (code) wx.redirectTo({ url: "/pages/store/index?code=" + code });
  },
  onCode(event) {
    this.setData({ code: event.detail.value });
  },
  enter() {
    const code = parseStoreCode(this.data.code);
    if (!code) {
      wx.showModal({ title: "提示", content: "请输入 4-12 位进店码", showCancel: false });
      return;
    }
    wx.navigateTo({ url: "/pages/store/index?code=" + code });
  },
  scan() {
    wx.scanCode({
      success: (res) => {
        const code = parseStoreCode(res.result || "");
        if (!code) {
          wx.showModal({ title: "提示", content: "这不是门店进店码", showCancel: false });
          return;
        }
        wx.navigateTo({ url: "/pages/store/index?code=" + code });
      },
    });
  },
  orders() {
    wx.navigateTo({ url: "/pages/orders/index" });
  },
});
