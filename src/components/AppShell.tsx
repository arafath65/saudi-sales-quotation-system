"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import CompanyLogo from "./CompanyLogo";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

const mainItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Customers", href: "/customers", icon: "◉" },
  { label: "Quotations", href: "/quotations", icon: "▤" },
];

const billingItems: NavItem[] = [
  { label: "Invoices", href: "/invoices", icon: "▥" },
  { label: "Payments", href: "/payments", icon: "₹" },
];

const settingsItems: NavItem[] = [
  { label: "Services", href: "/settings/services", icon: "◇" },
  {
    label: "Company Settings",
    href: "/settings/company",
    icon: "⚙",
  },
  { label: "Audit Logs", href: "/audit-logs", icon: "≡" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (href === "/quotations") {
    return (
      pathname === "/quotations" ||
      pathname.startsWith("/quotations/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Keep the login page full-screen without the application navigation.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);

      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6]">
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-[#0A4F44] text-white lg:flex print:hidden">
        {/* Brand */}
        <div className="shrink-0 border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <CompanyLogo variant="nav" />

            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A227]">
                Saudi Sales
              </p>

              <h1 className="mt-1 truncate text-base font-black">
                Quotation System
              </h1>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              Application
            </p>

            <p className="mt-1 text-xs font-semibold text-white/75">
              Sales • Quotations • Billing
            </p>
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Main Menu
          </p>

          <nav className="space-y-1">
            {mainItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-white text-[#0A4F44] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base",
                      active
                        ? "bg-[#0F6B5B]/10 text-[#0F6B5B]"
                        : "bg-white/5 text-white/75",
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>

                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <p className="px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Billing
          </p>

          <nav className="space-y-1">
            {billingItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-white text-[#0A4F44] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base",
                      active
                        ? "bg-[#0F6B5B]/10 text-[#0F6B5B]"
                        : "bg-white/5 text-white/75",
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>

                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <p className="px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Settings &amp; Control
          </p>

          <nav className="space-y-1">
            {settingsItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-white text-[#0A4F44] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base",
                      active
                        ? "bg-[#0F6B5B]/10 text-[#0F6B5B]"
                        : "bg-white/5 text-white/75",
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>

                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A227]">
              Billing Flow
            </p>

            <p className="mt-2 text-xs leading-5 text-white/60">
              Quotation → Invoice → Payment
            </p>

            <p className="mt-1 text-[11px] leading-5 text-white/40">
              Payments and installments are recorded against invoices.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="sticky top-0 z-30 border-b border-[#E4E7EC] bg-white/95 backdrop-blur lg:hidden print:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <CompanyLogo variant="mobile" />

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                Saudi Sales
              </p>

              <p className="text-xs font-black text-[#1F2933]">
                Quotation System
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-[10px] font-bold text-[#475467] disabled:opacity-50"
          >
            {loggingOut ? "..." : "Sign Out"}
          </button>
        </div>

        <div className="overflow-x-auto border-t border-[#E4E7EC] px-3 py-2">
          <nav className="flex min-w-max gap-2">
            {[...mainItems, ...billingItems, ...settingsItems].map(
              (item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "rounded-lg px-3 py-2 text-[11px] font-bold transition",
                      active
                        ? "bg-[#0F6B5B] text-white"
                        : "bg-[#F7F8F6] text-[#475467]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              }
            )}
          </nav>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div className="min-h-screen lg:pl-72">
        {children}
      </div>
    </div>
  );
}