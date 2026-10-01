const { ensureLogin } = require("./utils/session");

App({
  globalData: {
    draft: null,
  },
  onLaunch() {
    ensureLogin().catch(() => {});
  },
});
