const { request } = require("../../utils/request");
const { fenToYuan, COLOR_LABEL } = require("../../utils/format");
const { parseStoreCode } = require("../../utils/store-code");

Page({
  data: { store: null, prices: [], anyOnline: false, error: "" },
  onLoad(options) {
    this.code = parseStoreCode(options.code || options.scene || "");
    this.load();
  },
  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },
  load() {
    if (!this.code) {
      this.setData({ error: "缺少进店码" });
      return Promise.resolve();
    }
    return request({ url: "/public/stores/" + this.code }).then((store) => {
      wx.setStorageSync("store", store);
      const prices = (store.priceRules || []).map((rule) => ({
        label: rule.paperSize + " " + (COLOR_LABEL[rule.colorMode] || rule.colorMode) + " " + (rule.duplex ? "双面" : "单面"),
        price: fenToYuan(rule.pricePerPage),
      }));
      const anyOnline = (store.printers || []).some((printer) => printer.status === "online");
      this.setData({ store, prices, anyOnline, error: "" });
      wx.setNavigationBarTitle({ title: store.name });
    }, (err) => {
      this.setData({ error: (err && err.message) || "门店加载失败" });
    });
  },
  start() {
    wx.navigateTo({ url: "/pages/upload/index" });
  },
  onShow() {},
});
