import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "自助打印 · 商家后台",
  description: "门店、价格、打印机与订单",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
