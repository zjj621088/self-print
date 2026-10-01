const { apiBase } = require("../../utils/config");
const { showError } = require("../../utils/request");
const { ensureLogin } = require("../../utils/session");

Page({
  data: { files: [] },
  onShow() {
    const store = wx.getStorageSync("store");
    if (!store || !store.code) {
      wx.showModal({ title: "提示", content: "请先进入门店", showCancel: false });
      return;
    }
    this.storeCode = store.code;
  },
  chooseFile() {
    wx.chooseMessageFile({
      count: 9,
      type: "file",
      extension: ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "ppt", "pptx", "xls", "xlsx"],
      success: (res) => this.uploadList(res.tempFiles || []),
    });
  },
  chooseImage() {
    wx.chooseMedia({
      count: 9,
      mediaType: ["image"],
      success: (res) => {
        const files = (res.tempFiles || []).map((file, index) => ({
          path: file.tempFilePath,
          name: "图片" + (this.data.files.length + index + 1) + ".jpg",
        }));
        this.uploadList(files);
      },
    });
  },
  uploadList(tempFiles) {
    const self = this;
    ensureLogin().then(() => {
      wx.showLoading({ title: "上传中" });
      let chain = Promise.resolve();
      tempFiles.forEach((file) => {
        chain = chain.then(() => uploadOne(file.path).then((saved) => {
          const files = self.data.files.concat([{
            fileId: saved.id,
            originalName: saved.originalName,
            pageCount: saved.pageCount,
            printable: saved.printable,
            declaredPageCount: saved.pageCount,
            copies: 1,
            colorMode: "bw",
            duplex: false,
            paperSize: "A4",
            pageRange: "",
          }]);
          self.setData({ files });
        }));
      });
      return chain;
    }).catch(showError).then(() => wx.hideLoading());
  },
  step(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const delta = Number(event.currentTarget.dataset.delta);
    const files = this.data.files.slice();
    const item = Object.assign({}, files[index]);
    const max = field === "copies" ? 20 : 999;
    item[field] = Math.min(max, Math.max(1, item[field] + delta));
    files[index] = item;
    this.setData({ files });
  },
  pick(event) {
    const index = Number(event.currentTarget.dataset.index);
    const key = event.currentTarget.dataset.key;
    let value = event.currentTarget.dataset.value;
    if (key === "duplex") value = value === "true" || value === true;
    const files = this.data.files.slice();
    const item = Object.assign({}, files[index]);
    item[key] = value;
    files[index] = item;
    this.setData({ files });
  },
  onRange(event) {
    const index = Number(event.currentTarget.dataset.index);
    const files = this.data.files.slice();
    const item = Object.assign({}, files[index]);
    item.pageRange = event.detail.value;
    files[index] = item;
    this.setData({ files });
  },
  remove(event) {
    const index = Number(event.currentTarget.dataset.index);
    const files = this.data.files.slice();
    files.splice(index, 1);
    this.setData({ files });
  },
  next() {
    if (!this.data.files.length) return;
    const draft = {
      storeCode: this.storeCode,
      items: this.data.files.map((item) => ({
        fileId: item.fileId,
        originalName: item.originalName,
        copies: item.copies,
        colorMode: item.colorMode,
        duplex: item.duplex,
        paperSize: item.paperSize,
        pageRange: item.pageRange,
        pageCount: item.printable ? undefined : item.declaredPageCount,
      })),
    };
    getApp().globalData.draft = draft;
    wx.setStorageSync("draft", draft);
    wx.navigateTo({ url: "/pages/confirm/index" });
  },
});

function uploadOne(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: apiBase + "/customer/files",
      filePath,
      name: "file",
      header: { Authorization: "Bearer " + wx.getStorageSync("token") },
      success(res) {
        let data = {};
        try { data = JSON.parse(res.data); } catch (error) { data = { message: "上传失败" }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(data);
      },
      fail() { reject({ message: "上传失败" }); },
    });
  });
}
