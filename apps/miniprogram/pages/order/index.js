const { request, showError } = require("../../utils/request");
const { ensureLogin } = require("../../utils/session");
const { fenToYuan, specLabel, STATUS_LABEL } = require("../../utils/format");

const JOB_LABEL = { queued: "排队", claimed: "已领取", printing: "打印中", done: "已打完", failed: "失败" };

Page({
  data: { order: null, statusText: "", total: "", error: "" },
  onLoad(options) {
    this.id = options.id;
    this.load();
  },
  onShow() {
    this.timer = setInterval(() => {
      const order = this.data.order;
      if (order && (order.status === "paid" || order.status === "printing")) this.load();
    }, 3000);
  },
  onHide() {
    clearInterval(this.timer);
  },
  onUnload() {
    clearInterval(this.timer);
  },
  load() {
    const self = this;
    return ensureLogin()
      .then(() => request({ url: "/customer/orders/" + this.id }))
      .then((order) => {
        order.items = (order.items || []).map((item) => Object.assign({}, item, {
          spec: specLabel(item),
          amountText: fenToYuan(item.amount),
        }));
        order.jobs = (order.jobs || []).map((job) => Object.assign({}, job, {
          statusText: JOB_LABEL[job.status] || job.status,
        }));
        self.setData({
          order,
          statusText: STATUS_LABEL[order.status] || order.status,
          total: fenToYuan(order.totalAmount),
          error: "",
        });
      }, (err) => self.setData({ error: (err && err.message) || "加载失败" }));
  },
  pay() {
    const self = this;
    request({ url: "/customer/orders/" + this.id + "/mock-pay", method: "POST" })
      .then(() => self.load())
      .catch(showError);
  },
});
