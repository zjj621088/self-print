const { request } = require("./request");

function deviceCode() {
  let id = wx.getStorageSync("deviceId");
  if (!id) {
    id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    wx.setStorageSync("deviceId", id);
  }
  return id;
}

function ensureLogin() {
  const token = wx.getStorageSync("token");
  if (token) return Promise.resolve(token);
  return request({
    url: "/auth/customer/mock-login",
    method: "POST",
    data: { code: deviceCode() },
  }).then((data) => {
    wx.setStorageSync("token", data.token);
    wx.setStorageSync("customer", data.customer);
    return data.token;
  });
}

module.exports = { ensureLogin };
