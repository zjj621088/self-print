"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { formatDate, PRICE_ROWS, yuanToFen } from "../../../../lib/format";
import type { AgentToken, PriceRule, Store } from "../../../../lib/types";

type Qr = { code: string; payload: string; miniProgramPath: string; pngDataUrl: string };
type PriceDraft = { paperSize: string; colorMode: string; duplex: boolean; label: string; yuan: string };

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [store, setStore] = useState<Store | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", notice: "", status: "active" });
  const [prices, setPrices] = useState<PriceDraft[]>([]);
  const [printerName, setPrinterName] = useState("");
  const [systemName, setSystemName] = useState("");
  const [color, setColor] = useState(true);
  const [duplex, setDuplex] = useState(true);
  const [paper, setPaper] = useState({ A4: true, A3: true });
  const [revealed, setRevealed] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [nextStore, nextQr] = await Promise.all([
      api<Store>(`/merchant/stores/${id}`),
      api<Qr>(`/merchant/stores/${id}/qr`),
    ]);
    setStore(nextStore);
    setQr(nextQr);
    setForm({
      name: nextStore.name,
      address: nextStore.address,
      phone: nextStore.phone,
      notice: nextStore.notice,
      status: nextStore.status,
    });
    setPrices(fillPrices(nextStore.priceRules ?? []));
  }

  useEffect(() => {
    if (!id) return;
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function saveStore(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(`/merchant/stores/${id}`, { method: "PATCH", body: JSON.stringify(form) });
      setMessage("门店资料已保存");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function savePrices(event: FormEvent) {
    event.preventDefault();
    setError("");
    const rules: PriceRule[] = [];
    for (const row of prices) {
      const pricePerPage = yuanToFen(row.yuan);
      if (pricePerPage == null) {
        setError(`${row.label} 的单价无效，范围是 0 到 50 元`);
        return;
      }
      rules.push({ paperSize: row.paperSize, colorMode: row.colorMode, duplex: row.duplex, pricePerPage });
    }
    try {
      await api(`/merchant/stores/${id}/prices`, { method: "PUT", body: JSON.stringify({ rules }) });
      setMessage("价格已更新");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function addPrinter(event: FormEvent) {
    event.preventDefault();
    const paperSizes = [paper.A4 ? "A4" : "", paper.A3 ? "A3" : ""].filter(Boolean).join(",");
    try {
      await api(`/merchant/stores/${id}/printers`, {
        method: "POST",
        body: JSON.stringify({ name: printerName, systemName, supportsColor: color, supportsDuplex: duplex, paperSizes }),
      });
      setPrinterName("");
      setSystemName("");
      setMessage("打印机已添加");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  async function removePrinter(printerId: string) {
    if (!confirm("删除这台打印机？")) return;
    await api(`/merchant/printers/${printerId}`, { method: "DELETE" });
    await load();
  }

  async function createToken() {
    const created = await api<{ token: string }>(`/merchant/stores/${id}/agent-tokens`, {
      method: "POST",
      body: JSON.stringify({ name: "店内代理" }),
    });
    setRevealed(created.token);
    setMessage("新令牌只显示这一次，请立刻复制到店内代理。");
    await load();
  }

  async function revoke(tokenId: string) {
    if (!confirm("停用这个代理令牌？")) return;
    await api(`/merchant/agent-tokens/${tokenId}`, { method: "DELETE" });
    await load();
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("已复制");
  }

  if (!store || !qr) return <div className="boot">{error || "加载中…"}</div>;

  return (
    <>
      <div className="top">
        <div>
          <p className="muted"><Link href="/stores">门店</Link> / {store.name}</p>
          <h1>{store.name}</h1>
        </div>
        <button className="btn-ghost" onClick={() => load().catch((err: Error) => setError(err.message))}>刷新</button>
      </div>
      {error && <div className="error">{error}</div>}
      {message && <p className="hint">{message}</p>}
      <div className="split">
        <div className="grid">
          <form className="card panel" onSubmit={saveStore}>
            <h2>资料</h2>
            <label>名称</label>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <label>地址</label>
            <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            <label>电话</label>
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <label>顾客须知</label>
            <textarea value={form.notice} onChange={(event) => setForm({ ...form, notice: event.target.value })} />
            <label>营业状态</label>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">营业</option>
              <option value="inactive">暂停</option>
            </select>
            <button className="btn" style={{ marginTop: 14 }}>保存资料</button>
          </form>
          <form className="card panel" onSubmit={savePrices}>
            <h2>单价</h2>
            <p className="hint">按文件页计价。双面是另一套每页单价，不是按纸张张数折算。</p>
            {prices.map((row, index) => (
              <div className="row" key={row.label} style={{ marginTop: 8 }}>
                <span style={{ width: 140 }}>{row.label}</span>
                <input className="narrow" value={row.yuan} onChange={(event) => {
                  const next = prices.slice();
                  next[index] = { ...row, yuan: event.target.value };
                  setPrices(next);
                }} />
                <span className="muted">元/页</span>
              </div>
            ))}
            <button className="btn" style={{ marginTop: 14 }}>保存价格</button>
          </form>
        </div>
        <div className="grid">
          <section className="card panel">
            <h2>进店码</h2>
            <img className="qr" alt="进店二维码" src={qr.pngDataUrl} />
            <p className="code">{qr.code}</p>
            <p className="hint">二维码内容 {qr.payload}。小程序路径 {qr.miniProgramPath}。顾客可在小程序里扫这个码，或手动输入进店码。</p>
            <div className="row">
              <button type="button" className="btn-ghost" onClick={() => copy(qr.code)}>复制进店码</button>
              <button type="button" className="btn-ghost" onClick={() => copy(qr.payload)}>复制二维码内容</button>
            </div>
          </section>
          <section className="card panel">
            <h2>打印机</h2>
            <table>
              <thead><tr><th>名称</th><th>系统名</th><th>状态</th><th></th></tr></thead>
              <tbody>
                {(store.printers ?? []).map((printer) => (
                  <tr key={printer.id}>
                    <td>{printer.name}<div className="muted">{printer.paperSizes}{printer.supportsColor ? " · 彩色" : ""}{printer.supportsDuplex ? " · 双面" : ""}</div></td>
                    <td className="code">{printer.systemName}</td>
                    <td><span className={`pill pill-${printer.status}`}>{printer.status === "online" ? "在线" : printer.status === "busy" ? "忙碌" : printer.status === "error" ? "故障" : "离线"}</span><div className="muted">{formatDate(printer.lastHeartbeatAt)}</div></td>
                    <td><button className="btn-danger" onClick={() => removePrinter(printer.id)}>删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form onSubmit={addPrinter}>
              <label>店内名称</label>
              <input value={printerName} onChange={(event) => setPrinterName(event.target.value)} required placeholder="前台打印机" />
              <label>系统打印机名</label>
              <input value={systemName} onChange={(event) => setSystemName(event.target.value)} required placeholder="lpstat 里看到的名称" />
              <div className="checks" style={{ marginTop: 10 }}>
                <label><input type="checkbox" checked={color} onChange={(event) => setColor(event.target.checked)} />彩色</label>
                <label><input type="checkbox" checked={duplex} onChange={(event) => setDuplex(event.target.checked)} />双面</label>
                <label><input type="checkbox" checked={paper.A4} onChange={(event) => setPaper({ ...paper, A4: event.target.checked })} />A4</label>
                <label><input type="checkbox" checked={paper.A3} onChange={(event) => setPaper({ ...paper, A3: event.target.checked })} />A3</label>
              </div>
              <button className="btn" style={{ marginTop: 12 }}>添加打印机</button>
            </form>
          </section>
          <section className="card panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>店内代理</h2>
              <button className="btn" type="button" onClick={() => createToken().catch((err: Error) => setError(err.message))}>生成令牌</button>
            </div>
            <p className="hint">代理跑在店里的电脑上，用令牌领取打印任务。演示令牌是 agt_dev_demo_store_token。</p>
            {revealed && <div className="token-box">{revealed}</div>}
            <table>
              <thead><tr><th>名称</th><th>尾号</th><th>最近在线</th><th></th></tr></thead>
              <tbody>
                {(store.agentTokens ?? []).filter((token) => !token.revokedAt).map((token: AgentToken) => (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td className="code">{token.tokenHint}</td>
                    <td>{formatDate(token.lastSeenAt)}</td>
                    <td><button className="btn-danger" onClick={() => revoke(token.id)}>停用</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}

function fillPrices(rules: PriceRule[]): PriceDraft[] {
  return PRICE_ROWS.map((row) => {
    const found = rules.find((rule) => rule.paperSize === row.paperSize && rule.colorMode === row.colorMode && rule.duplex === row.duplex);
    return { ...row, yuan: found ? (found.pricePerPage / 100).toFixed(2) : "" };
  });
}
