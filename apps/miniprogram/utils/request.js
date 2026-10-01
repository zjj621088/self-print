const { apiBase } = require("./config");

function request(options) {
  const token = wx.getStorageSync("token");
  return new Promise((resolve, reject) => {
    wx.request({
      url: apiBase + options.url,
      method: options.method || "GET",
      data: options.data,
      timeout: 20000,
      header: {
        "Content-Type": "application/json",
        Authorization: token ? "Bearer " + token : "",
      },
      success(res) {
        if (res.statusCode === 401) wx.removeStorageSync("token");
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(res.data || { message: "请求失败" });
      },
      fail() {
        reject({ message: "网络异常。请确认 API 已启动，并在开发者工具里关闭合法域名校验。" });
      },
    });
  });
}

function showError(err) {
  const message = err && err.message;
  const text = Array.isArray(message) ? message.join("\n") : message || (err && err.errMsg) || "操作失败";
  wx.showModal({ title: "提示", content: String(text), showCancel: false });
}

module.exports = { request, showError };
