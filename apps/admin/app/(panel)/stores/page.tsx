"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { Store } from "../../../lib/types";

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);

  function load() {
    api<Store[]>("/merchant/stores").then(setStores).catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const store = await api<Store>("/merchant/stores", {
        method: "POST",
        body: JSON.stringify({ name, address }),
      });
      router.push(`/stores/${store.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      setPending(false);
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>门店</h1>
          <p className="muted">每家店有自己的进店码、价格和打印机。</p>
        </div>
      </div>
      <div className="split">
        <section className="card panel">
          {stores.length === 0 ? <div className="empty">还没有门店。</div> : (
            <table>
              <thead><tr><th>门店</th><th>进店码</th><th>状态</th><th>打印机</th><th>订单</th></tr></thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td><Link href={`/stores/${store.id}`}>{store.name}</Link><div className="muted">{store.address || "未填地址"}</div></td>
                    <td className="code">{store.code}</td>
                    <td><span className={`pill pill-${store.status}`}>{store.status === "active" ? "营业" : "暂停"}</span></td>
                    <td>{store._count?.printers ?? 0}</td>
                    <td>{store._count?.orders ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <form className="card panel" onSubmit={create}>
          <h2>新开门店</h2>
          <p className="hint">会带上一套默认定价，进店码自动生成。顾客扫码后按这个码进入。</p>
          <label>名称</label>
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} placeholder="例如 大学城店" />
          <label>地址</label>
          <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={80} />
          {error && <div className="error">{error}</div>}
          <button className="btn full" disabled={pending}>{pending ? "创建中…" : "创建"}</button>
        </form>
      </div>
    </>
  );
}
