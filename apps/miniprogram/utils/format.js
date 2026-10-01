function fenToYuan(fen) {
  return "¥" + (Number(fen) / 100).toFixed(2);
}

const COLOR_LABEL = { bw: "黑白", color: "彩色" };
const STATUS_LABEL = {
  pending_payment: "待支付",
  paid: "待打印",
  printing: "打印中",
  printed: "待取件",
  completed: "已完成",
  cancelled: "已取消",
  failed: "打印失败",
};

function specLabel(item) {
  return item.paperSize + " " + (COLOR_LABEL[item.colorMode] || item.colorMode) + " " + (item.duplex ? "双面" : "单面");
}

module.exports = { fenToYuan, COLOR_LABEL, STATUS_LABEL, specLabel };
