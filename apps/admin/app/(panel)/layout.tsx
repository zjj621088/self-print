"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearToken, getToken } from "../../lib/api";
import type { Merchant } from "../../lib/types";

const LINKS = [
  { href: "/", label: "概览" },
  { href: "/stores", label: "门店" },
  { href: "/orders", label: "订单" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [merchant, setMerchant] = useState<Merchant | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<Merchant>("/auth/merchant/me").then(setMerchant).catch(() => router.replace("/login"));
  }, [router]);

  if (!merchant) return <div className="boot">加载中…</div>;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="mark">印</div>
          <div>
            自助打印
            <small>{merchant.name}</small>
          </div>
        </div>
        <nav className="nav">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={active ? "active" : ""}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
          >
            退出
          </button>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
