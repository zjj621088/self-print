"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, downloadAuthed } from "../../../../lib/api";
import { COLOR_LABEL, formatDate, formatMoney, JOB_STATUS_LABEL, ORDER_STATUS_LABEL } from "../../../../lib/format";
import type { Order } from "../../../../lib/types";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  function load() {
    return api<Order>(`/merchant/orders/${id}`).then(setOrder);
  }

  useEffect(() => {
    if (!id) return;
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function act(path: string) {
    setError("");
    try {
      const next = await api<Order>(path, { method: "POST" });
      setOrder(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  if (!order) return <div className="boot">{error || "加载中…"}</div>;

  return (
    <>
      <div className="top">
        <div>
          <p className="muted"><Link href="/orders">订单</Link> / {order.store.name}</p>
          <h1>{order.orderNo}</h1>
          {order.pickupCode && <p className="pickup">取件码 {order.pickupCode}</p>}
          <p className="muted">微信自助 · 现场自取</p>
        </div>
        <span className={`pill pill-${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        {(order.status === "pending_payment" || order.status === "paid") && (
          <button className="btn-danger" onClick={() => act(`/merchant/orders/${order.id}/cancel`)}>取消订单</button>
        )}
        {order.status === "printed" && (
          <button className="btn" onClick={() => act(`/merchant/orders/${order.id}/complete`)}>确认取件</button>
        )}
        {order.status !== "pending_payment" && order.status !== "cancelled" && (
          <button className="btn-ghost" onClick={() => act(`/merchant/orders/${order.id}/reprint`)}>重新打印</button>
        )}
      </div>
      <div className="split">
        <section className="card panel">
          <h2>文件</h2>
          <p className="muted">{order.customer.nickname} · {formatDate(order.createdAt)} · {order.payChannel === "mock" ? "模拟支付" : order.payChannel || "未支付"}</p>
          {order.remark && <p>备注：{order.remark}</p>}
          <table>
            <thead><tr><th>文件</th><th>规格</th><th>金额</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.file.originalName}
                    <div><button className="btn-ghost" onClick={() => downloadAuthed(`/merchant/files/${item.fileId}`, item.file.originalName)}>下载</button></div>
                  </td>
                  <td>{item.paperSize} {COLOR_LABEL[item.colorMode]} {item.duplex ? "双面" : "单面"} · {item.copies} 份 · {item.pageRange} · {item.pageCount} 页</td>
                  <td>{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><b>合计 {formatMoney(order.totalAmount)}</b></p>
        </section>
        <section className="card panel">
          <h2>打印任务</h2>
          {order.jobs.length === 0 ? <div className="empty">支付后才会生成打印任务。</div> : (
            <table>
              <thead><tr><th>状态</th><th>打印机</th><th>说明</th></tr></thead>
              <tbody>
                {order.jobs.map((job) => (
                  <tr key={job.id}>
                    <td><span className={`pill pill-${job.status}`}>{JOB_STATUS_LABEL[job.status]}</span></td>
                    <td>{job.printer?.name || "未分配"}</td>
                    <td>{job.error || `${job.copies} 份`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
