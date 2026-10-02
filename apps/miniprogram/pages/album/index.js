const { apiBase } = require("../../utils/config");

Page({
  data: { src: "" },
  onLoad(options) {
    const token = options.token || "";
    this.setData({ src: apiBase + "/public/album/" + token });
  },
});
