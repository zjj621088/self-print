"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, getToken, setToken } from "../../lib/api";
import type { Merchant } from "../../lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("13800000000");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const path = mode === "login" ? "/auth/merchant/login" : "/auth/merchant/register";
      const body = mode === "login" ? { phone, password } : { name, phone, password };
      const result = await api<{ token: string; merchant: Merchant }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(result.token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-hero">
        <div className="brand">
          <div className="mark">印</div>
          <div>自助打印</div>
        </div>
        <div>
          <h1>顾客扫码下单，店里直接出纸。</h1>
          <p>管理门店进店码、单价、打印机和订单。支付与微信登录在这一版里先用模拟流程。</p>
        </div>
        <p className="hint" style={{ color: "rgba(246,241,231,.7)" }}>演示账号 13800000000 / admin123，进店码 DEMO01</p>
      </section>
      <section className="auth-panel">
        <form className="card auth-card" onSubmit={onSubmit}>
          <div className="tabs">
            <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>登录</button>
            <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>注册</button>
          </div>
          {mode === "register" && (
            <>
              <label>商家名称</label>
              <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} />
            </>
          )}
          <label>手机号</label>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="numeric" />
          <label>密码</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          {error && <div className="error">{error}</div>}
          <button className="btn full" disabled={pending}>{pending ? "提交中…" : mode === "login" ? "进入后台" : "创建账号"}</button>
        </form>
      </section>
    </main>
  );
}
