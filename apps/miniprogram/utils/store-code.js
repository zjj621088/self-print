function parseStoreCode(raw) {
  if (!raw) return "";
  let text = String(raw).trim();
  try {
    text = decodeURIComponent(text);
  } catch (error) {
    text = String(raw).trim();
  }
  const tagged = text.match(/selfprint:store:([A-Za-z0-9]{4,12})/i);
  if (tagged) return tagged[1].toUpperCase();
  const query = text.match(/[?&]code=([A-Za-z0-9]{4,12})/i);
  if (query) return query[1].toUpperCase();
  if (/^[A-Za-z0-9]{4,12}$/.test(text)) return text.toUpperCase();
  return "";
}

module.exports = { parseStoreCode };
