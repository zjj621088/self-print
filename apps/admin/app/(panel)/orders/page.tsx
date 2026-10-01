"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from "../../../lib/format";
import type { Order, Store } from "../../../lib/types";

export default function OrdersPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Store[]>("/merchant/stores").then(setStores).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams();
    if (storeId) query.set("storeId", storeId);
    if (status) query.set("status", status);
    api<{ items: Order[] }>(`/merchant/orders?${query.toString()}`)
      .then((result) => setOrders(result.items))
      .catch((err: Error) => setError(err.message));
  }, [storeId, status]);

  return (
    <>
      <div className="top">
        <div>
          <h1>订单</h1>
          <p className="muted">支付成功后进入待打印，店内代理领取后变为打印中。</p>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <select value={storeId} onChange={(event) => setStoreId(event.target.value)} style={{ maxWidth: 220 }}>
          <option value="">全部门店</option>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ maxWidth: 180 }}>
          <option value="">全部状态</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      <section className="card panel">
        {orders.length === 0 ? <div className="empty">没有符合条件的订单。</div> : (
          <table>
            <thead><tr><th>单号</th><th>门店</th><th>顾客</th><th>文件</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/orders/${order.id}`}>{order.orderNo}</Link></td>
                  <td>{order.store.name}</td>
                  <td>{order.customer.nickname}</td>
                  <td>{order.items.map((item) => item.file.originalName).join("、")}</td>
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
  );
}
