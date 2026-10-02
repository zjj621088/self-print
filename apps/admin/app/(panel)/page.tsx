"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from "../../lib/format";
import type { Dashboard } from "../../lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/merchant/dashboard").then(setData).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <div className="top">
        <div>
          <h1>今日柜台</h1>
          <p className="muted">按上海时区统计已支付订单。待打印是还在排队的任务。</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {data && (
        <>
          <section className="grid stats">
            <article className="card stat"><span className="muted">今日订单</span><b>{data.todayOrderCount}</b></article>
            <article className="card stat"><span className="muted">今日营收</span><b>{formatMoney(data.todayRevenue)}</b></article>
            <article className="card stat"><span className="muted">待打印</span><b>{data.pendingPrint}</b></article>
            <article className="card stat"><span className="muted">打印中 / 门店</span><b>{data.printingCount} / {data.storeCount}</b></article>
          </section>
          <section className="card panel" style={{ marginTop: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>最近订单</h2>
              <Link href="/orders">全部订单</Link>
            </div>
            {data.recent.length === 0 ? (
              <div className="empty">还没有订单。顾客用微信扫进店码后，订单会出现在这里。</div>
            ) : (
              <table>
                <thead>
                  <tr><th>取件码</th><th>单号</th><th>门店</th><th>金额</th><th>状态</th><th>时间</th></tr>
                </thead>
                <tbody>
                  {data.recent.map((order) => (
                    <tr key={order.id}>
                      <td className="code">{order.pickupCode || "—"}</td>
                      <td><Link href={`/orders/${order.id}`}>{order.orderNo}</Link></td>
                      <td>{order.store.name}</td>
                      <td>{formatMoney(order.totalAmount)}</td>
                      <td><span className={`pill pill-${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span></td>
                      <td>{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}
