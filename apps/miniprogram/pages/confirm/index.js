const { request, showError } = require("../../utils/request");
const { ensureLogin } = require("../../utils/session");
const { fenToYuan, specLabel } = require("../../utils/format");

Page({
  data: { quote: null, total: "", remark: "", paying: false, error: "" },
  onShow() {
    const draft = getApp().globalData.draft || wx.getStorageSync("draft");
    if (!draft || !draft.items || !draft.items.length) {
      this.setData({ error: "没有待结算的文件" });
      return;
    }
    this.draft = draft;
    const self = this;
    ensureLogin().then(() => request({
      url: "/customer/orders/quote",
      method: "POST",
      data: {
        storeCode: draft.storeCode,
        items: draft.items.map(toPayload),
      },
    })).then((quote) => {
      quote.items = quote.items.map((item) => Object.assign({}, item, {
        spec: specLabel(item),
        amountText: fenToYuan(item.amount),
      }));
      self.setData({ quote, total: fenToYuan(quote.totalAmount), error: "" });
    }, (err) => {
      self.setData({ error: messageOf(err) });
    });
  },
  onRemark(event) {
    this.setData({ remark: event.detail.value });
  },
  pay() {
    if (this.data.paying || !this.draft) return;
    this.setData({ paying: true });
    const self = this;
    const body = {
      storeCode: this.draft.storeCode,
      remark: this.data.remark,
      items: this.draft.items.map(toPayload),
    };
    ensureLogin()
      .then(() => request({ url: "/customer/orders", method: "POST", data: body }))
      .then((order) => request({ url: "/customer/orders/" + order.id + "/mock-pay", method: "POST" }))
      .then((order) => {
        getApp().globalData.draft = null;
        wx.removeStorageSync("draft");
        wx.redirectTo({ url: "/pages/order/index?id=" + order.id });
      })
      .catch((err) => {
        self.setData({ paying: false });
        showError(err);
      });
  },
});

function toPayload(item) {
  const payload = {
    fileId: item.fileId,
    copies: item.copies,
    colorMode: item.colorMode,
    duplex: item.duplex,
    paperSize: item.paperSize,
    pageRange: item.pageRange || "all",
  };
  if (item.pageCount) payload.pageCount = item.pageCount;
  return payload;
}

function messageOf(err) {
  if (!err) return "计价失败";
  if (Array.isArray(err.message)) return err.message.join("；");
  return err.message || "计价失败";
}
