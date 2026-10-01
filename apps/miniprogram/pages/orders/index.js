const { request, showError } = require("../../utils/request");
const { ensureLogin } = require("../../utils/session");
const { fenToYuan, STATUS_LABEL } = require("../../utils/format");

Page({
  data: { orders: [] },
  onShow() {
    this.load();
  },
  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },
  load() {
    const self = this;
    return ensureLogin()
      .then(() => request({ url: "/customer/orders" }))
      .then((result) => {
        const orders = (result.items || []).map((order) => ({
          id: order.id,
          store: order.store,
          statusText: STATUS_LABEL[order.status] || order.status,
          pickupCode: order.pickupCode || "",
          names: (order.items || []).map((item) => item.file.originalName).join("、"),
          time: (order.createdAt || "").replace("T", " ").slice(5, 16),
          amount: fenToYuan(order.totalAmount),
        }));
        self.setData({ orders });
      })
      .catch(showError);
  },
  open(event) {
    wx.navigateTo({ url: "/pages/order/index?id=" + event.currentTarget.dataset.id });
  },
});
