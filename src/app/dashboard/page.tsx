"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DashboardRange =
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_6_MONTHS"
  | "LAST_1_YEAR"
  | "ALL_TIME";

type Currency = "SAR" | "LKR" | "USD";

type TrendPoint = {
  key: string;
  label: string;
  invoiceAmount: number;
  collectedAmount: number;
};

type Summary = {
  invoicedAmount: number;
  invoiceCount: number;
  collectedAmount: number;
  paymentCount: number;
  outstandingAmount: number;
  outstandingInvoiceCount: number;
  pendingQuotationCount: number;
  pendingQuotationAmount: number;
};

type QuotationStatusRow = { status: string; count: number; value: number };
type ServiceRevenueRow = { serviceType: string; label: string; amount: number };

type OutstandingInvoice = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  customerMobile: string;
  iqamaNo: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currency?: Currency;
  status: string;
};

type RecentPayment = {
  id: number;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNo: string | null;
  iqamaNo: string | null;
  invoice: {
    id: number;
    invoiceNo: string;
    customerName: string;
    currency?: Currency;
  };
};

type AcceptedQuotation = {
  id: number;
  quotationNo: string;
  quotationDate: string;
  customerName: string;
  customerMobile: string;
  iqamaNo: string | null;
  totalAmount: number;
  currency?: Currency;
};

type DashboardData = {
  success: boolean;
  message?: string;
  generatedAt: string;
  currency?: Currency;
  period: { key: DashboardRange; label: string; start: string; endExclusive: string };
  summary: Summary;
  salesTrend: TrendPoint[];
  quotationStatuses: QuotationStatusRow[];
  serviceRevenue: ServiceRevenueRow[];
  outstandingInvoices: OutstandingInvoice[];
  recentPayments: RecentPayment[];
  acceptedQuotations: AcceptedQuotation[];
};

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "LAST_3_MONTHS", label: "Last 3 Months" },
  { value: "LAST_6_MONTHS", label: "Last 6 Months" },
  { value: "LAST_1_YEAR", label: "Last 1 Year" },
  { value: "ALL_TIME", label: "All Time" },
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Draft", color: "#667085", bg: "#F2F4F7" },
  GENERATED: { label: "Generated", color: "#0F6B5B", bg: "#E7F4F0" },
  ACCEPTED: { label: "Accepted", color: "#027A48", bg: "#ECFDF3" },
  REJECTED: { label: "Rejected", color: "#B42318", bg: "#FEF3F2" },
  CANCELLED: { label: "Cancelled", color: "#667085", bg: "#F2F4F7" },
  UNPAID: { label: "Unpaid", color: "#B42318", bg: "#FEF3F2" },
  PARTIALLY_PAID: { label: "Partially Paid", color: "#B54708", bg: "#FFFAEB" },
  PAID: { label: "Paid", color: "#027A48", bg: "#ECFDF3" },
};

const QUOTATION_STATUS_COLORS: Record<string, string> = {
  GENERATED: "#0F6B5B",
  ACCEPTED: "#2E9B74",
  DRAFT: "#D0D5DD",
  REJECTED: "#D92D20",
  CANCELLED: "#98A2B3",
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function compactMoney(value: number) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusBadge(status: string) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-xs text-[#98A2B3]">{text}</div>;
}

function LineChart({ data, currency }: { data: TrendPoint[]; currency: Currency }) {
  const width = 720;
  const height = 250;
  const padding = { left: 44, right: 12, top: 18, bottom: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.invoiceAmount, point.collectedAmount]));
  const y = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const x = (index: number) =>
    padding.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const invoicePoints = data.map((point, index) => `${x(index)},${y(point.invoiceAmount)}`).join(" ");
  const paymentPoints = data.map((point, index) => `${x(index)},${y(point.collectedAmount)}`).join(" ");
  const labelIndices = new Set<number>();
  if (data.length > 0) {
    const count = Math.min(6, data.length);
    for (let index = 0; index < count; index++) {
      labelIndices.add(Math.round((index * (data.length - 1)) / Math.max(1, count - 1)));
    }
  }

  return (
    <div className="w-full">
      {data.every((point) => point.invoiceAmount === 0 && point.collectedAmount === 0) ? (
        <div className="flex h-56 items-center justify-center text-sm text-[#98A2B3]">
          No sales or payments in this period yet.
        </div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Invoice totals compared with payments collected" className="h-56 w-full overflow-visible">
          {[0, 0.5, 1].map((ratio) => {
            const lineY = padding.top + plotHeight * ratio;
            const value = maxValue * (1 - ratio);
            return (
              <g key={ratio}>
                <line x1={padding.left} y1={lineY} x2={width - padding.right} y2={lineY} stroke="#E4E7EC" strokeDasharray="3 5" />
                <text x={padding.left - 8} y={lineY + 4} textAnchor="end" fill="#98A2B3" fontSize="10">{compactMoney(value)}</text>
              </g>
            );
          })}
          <polyline points={invoicePoints} fill="none" stroke="#0F6B5B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={paymentPoints} fill="none" stroke="#C9A227" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((point, index) => (
            <g key={point.key}>
              <circle cx={x(index)} cy={y(point.invoiceAmount)} r="3" fill="#0F6B5B">
                <title>{`${point.label} — Invoiced ${currency} ${money(point.invoiceAmount)}`}</title>
              </circle>
              <circle cx={x(index)} cy={y(point.collectedAmount)} r="3" fill="#C9A227">
                <title>{`${point.label} — Collected ${currency} ${money(point.collectedAmount)}`}</title>
              </circle>
              {labelIndices.has(index) && (
                <text x={x(index)} y={height - 12} textAnchor="middle" fill="#667085" fontSize="10">{point.label}</text>
              )}
            </g>
          ))}
        </svg>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#667085]">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#0F6B5B]" /> Invoiced</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#C9A227]" /> Collected</span>
      </div>
    </div>
  );
}

function QuotationDonut({ rows }: { rows: QuotationStatusRow[] }) {
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const segments = rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const start = offset;
      const amount = (row.count / Math.max(1, total)) * 100;
      offset += amount;
      return `${QUOTATION_STATUS_COLORS[row.status] ?? "#98A2B3"} ${start}% ${offset}%`;
    });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
      <div
        className="relative h-36 w-36 shrink-0 rounded-full"
        style={{ background: total ? `conic-gradient(${segments.join(", ")})` : "#E4E7EC" }}
        role="img"
        aria-label={`Quotation status breakdown for ${total} quotations`}
      >
        <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-2xl font-black text-[#1F2933]">{total}</span>
          <span className="text-[10px] text-[#98A2B3]">Quotations</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:min-w-[150px]">
        {rows.map((row) => (
          <div key={row.status} className="flex items-center justify-between gap-4 text-xs">
            <span className="inline-flex items-center gap-2 text-[#667085]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: QUOTATION_STATUS_COLORS[row.status] ?? "#98A2B3" }} />{STATUS_STYLES[row.status]?.label ?? row.status}</span>
            <span className="font-bold tabular-nums text-[#1F2933]">{row.count}</span>
          </div>
        ))}
        {total === 0 && <p className="text-xs text-[#98A2B3]">No quotations in this period.</p>}
      </div>
    </div>
  );
}

function ServiceRevenue({ rows, currency }: { rows: ServiceRevenueRow[]; currency: Currency }) {
  const maxAmount = Math.max(1, ...rows.map((row) => row.amount));
  if (!rows.length || rows.every((row) => row.amount === 0)) {
    return <EmptyState text="No invoiced service revenue in this period." />;
  }

  return (
    <div className="space-y-5">
      {rows.map((row, index) => (
        <div key={row.serviceType}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#344054]">{row.label}</span>
            <span className="whitespace-nowrap text-xs font-black tabular-nums text-[#1F2933]">{currency} {money(row.amount)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(row.amount > 0 ? 2 : 0, (row.amount / maxAmount) * 100)}%`, backgroundColor: index === 0 ? "#0F6B5B" : index === 1 ? "#C9A227" : index === 2 ? "#4E9A85" : "#98A2B3" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ eyebrow, title, href, linkLabel }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A227]">{eyebrow}</p>}
        <h2 className="mt-1 text-base font-black text-[#1F2933]">{title}</h2>
      </div>
      {href && <Link href={href} className="shrink-0 text-xs font-bold text-[#0F6B5B] hover:underline">{linkLabel ?? "View all →"}</Link>}
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("THIS_MONTH");
  const [currency, setCurrency] = useState<Currency>("SAR");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (data) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/dashboard?range=${range}&currency=${currency}`, {
          cache: "no-store",
          credentials: "same-origin",
        });

        // A 401 here means the shared login session is missing or expired.
        // Send the user to sign in again rather than leaving a dashboard error.
        if (response.status === 401) {
          if (!cancelled) window.location.replace("/login");
          return;
        }
        const text = await response.text();
        let result: DashboardData | { success?: boolean; message?: string };
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(`Dashboard API returned an invalid response (HTTP ${response.status}).`);
        }

        if (!response.ok || !result.success) {
          throw new Error(result.message || `Unable to load dashboard (HTTP ${response.status}).`);
        }
        if (!cancelled) setData(result as DashboardData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
    // Range/retry should refresh the dashboard; previous data remains visible during refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, currency, reloadKey]);

  const summary = data?.summary;
  const serviceRevenue = useMemo(() => data?.serviceRevenue ?? [], [data?.serviceRevenue]);

  const cards = [
    {
      label: "Invoiced Amount",
      value: `${currency} ${money(summary?.invoicedAmount)}`,
      note: `${summary?.invoiceCount ?? 0} invoices in ${data?.period.label ?? "this period"}`,
      icon: "↗",
      tone: "#0F6B5B",
      href: "/invoices",
    },
    {
      label: "Payments Collected",
      value: `${currency} ${money(summary?.collectedAmount)}`,
      note: `${summary?.paymentCount ?? 0} payments in ${data?.period.label ?? "this period"}`,
      icon: "✓",
      tone: "#178653",
      href: "/payments",
    },
    {
      label: "Outstanding Balance",
      value: `${currency} ${money(summary?.outstandingAmount)}`,
      note: `${summary?.outstandingInvoiceCount ?? 0} invoices with a remaining due · all dates`,
      icon: "◷",
      tone: "#D92D20",
      href: "/invoices",
    },
    {
      label: "Pending Quotations",
      value: String(summary?.pendingQuotationCount ?? 0),
      note: `${currency} ${money(summary?.pendingQuotationAmount)} awaiting customer decision`,
      icon: "▤",
      tone: "#B78103",
      href: "/quotations",
    },
  ];

  if (loading && !data) {
    return (
      <main className="min-h-full bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E4E7EC]" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-[#E4E7EC]" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border border-[#E4E7EC] bg-white" />)}</div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]"><div className="h-80 animate-pulse rounded-2xl border border-[#E4E7EC] bg-white" /><div className="h-80 animate-pulse rounded-2xl border border-[#E4E7EC] bg-white" /></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#F7F8F6] p-4 text-[#1F2933] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Sales & Billing</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1F2933]">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">Your sales performance, collections and follow-up work in one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="dashboardCurrency" className="text-xs font-bold text-[#667085]">Currency</label>
            <select
              id="dashboardCurrency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
              className="rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-semibold text-[#344054] outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
            >
              <option value="SAR">SAR — Saudi Riyal</option>
              <option value="LKR">LKR — Sri Lankan Rupee</option>
              <option value="USD">USD — US Dollar</option>
            </select>
            <label htmlFor="dashboardRange" className="text-xs font-bold text-[#667085]">Date range</label>
            <select
              id="dashboardRange"
              value={range}
              onChange={(event) => setRange(event.target.value as DashboardRange)}
              className="rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-semibold text-[#344054] outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
            >
              {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Link href="/quotations/new" className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0A4F44]">+ New Quotation</Link>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="w-fit rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold">Retry</button>
          </div>
        )}

        <div className="relative mt-7">
          {refreshing && <div className="absolute -top-5 right-1 text-[10px] font-semibold text-[#98A2B3]">Updating data…</div>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.label} href={card.href} className="group rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0F6B5B]/30 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">{card.label}</p>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black" style={{ backgroundColor: `${card.tone}14`, color: card.tone }}>{card.icon}</span>
                </div>
                <p className="mt-3 text-[clamp(1.05rem,1.35vw,1.45rem)] font-black leading-tight tracking-tight text-[#1F2933]">{card.value}</p>
                <p className="mt-2 text-[11px] leading-5 text-[#667085]">{card.note}</p>
                <p className="mt-4 text-[10px] font-bold text-[#0F6B5B] group-hover:underline">View details →</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Performance" title="Sales vs. Collections" />
            <p className="mt-1 text-xs text-[#98A2B3]">Invoice value compared with payments received · {data?.period.label ?? "This Month"}</p>
            <div className="mt-5"><LineChart data={data?.salesTrend ?? []} currency={currency} /></div>
          </section>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Sales Pipeline" title="Quotation Status" href="/quotations" linkLabel="Open register →" />
            <p className="mt-1 text-xs text-[#98A2B3]">Counts for quotations dated in the selected period.</p>
            <div className="mt-6"><QuotationDonut rows={data?.quotationStatuses ?? []} /></div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Service Mix" title="Revenue by Service" href="/invoices" linkLabel="View invoices →" />
            <p className="mt-1 text-xs text-[#98A2B3]">From non-cancelled invoice items in the selected period.</p>
            <div className="mt-6"><ServiceRevenue rows={serviceRevenue} currency={currency} /></div>
          </section>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Follow-up" title="Accepted Quotes — Not Invoiced" href="/quotations" linkLabel="Open quotations →" />
            <p className="mt-1 text-xs text-[#98A2B3]">Accepted quotations that still need an invoice.</p>
            <div className="mt-4 overflow-x-auto">
              {(data?.acceptedQuotations.length ?? 0) === 0 ? <EmptyState text="No accepted quotations are waiting for an invoice." /> : (
                <table className="w-full min-w-[480px] text-left">
                  <thead><tr className="border-b border-[#E4E7EC] text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]"><th className="py-3 pr-3">Quotation / Customer</th><th className="py-3 px-2">Date</th><th className="py-3 pl-2 text-right">Total</th></tr></thead>
                  <tbody>{data?.acceptedQuotations.map((quote) => (
                    <tr key={quote.id} className="border-b border-[#F0F2F4] last:border-0 hover:bg-[#FAFAF8]">
                      <td className="py-3 pr-3"><Link href={`/quotations/${quote.id}`} className="text-xs font-black text-[#0F6B5B] hover:underline">{quote.quotationNo}</Link><p className="mt-1 text-xs font-semibold text-[#344054]">{quote.customerName}</p><p className="mt-1 text-[10px] text-[#98A2B3]">{quote.iqamaNo ? `Iqama: ${quote.iqamaNo} · ` : ""}{quote.customerMobile}</p></td>
                      <td className="whitespace-nowrap py-3 px-2 text-[10px] text-[#667085]">{dateLabel(quote.quotationDate)}</td>
                      <td className="whitespace-nowrap py-3 pl-2 text-right text-xs font-black text-[#1F2933]">{quote.currency ?? currency} {money(quote.totalAmount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
            <div className="p-5 sm:p-6"><SectionHeading eyebrow="Collections" title="Recent Payments" href="/payments" linkLabel="All payments →" /><p className="mt-1 text-xs text-[#98A2B3]">Payments received in the selected period.</p></div>
            <div className="overflow-x-auto">
              {(data?.recentPayments.length ?? 0) === 0 ? <EmptyState text="No payments recorded in this period." /> : (
                <table className="w-full min-w-0 table-fixed text-left">
                  <colgroup>
                    <col style={{ width: "43%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "32%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-y border-[#E4E7EC] bg-[#FAFAF8] text-[9px] font-bold uppercase tracking-[0.1em] text-[#98A2B3]">
                      <th className="px-3 py-3">Date / Invoice</th>
                      <th className="px-2 py-3">Method</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-[#F0F2F4] last:border-0 hover:bg-[#FAFAF8]">
                        <td className="px-3 py-3 align-middle">
                          <p className="text-[10px] text-[#667085]">{dateLabel(payment.paymentDate)}</p>
                          <Link href={`/invoices/${payment.invoice.id}`} className="mt-1 inline-block text-xs font-black text-[#0F6B5B] hover:underline">{payment.invoice.invoiceNo}</Link>
                          <p className="mt-1 text-xs font-semibold text-[#344054]">{payment.invoice.customerName}</p>
                          {payment.iqamaNo && <p className="mt-1 break-all text-[10px] text-[#98A2B3]">Iqama: {payment.iqamaNo}</p>}
                        </td>
                        <td className="px-2 py-3 align-middle text-[11px] leading-4 text-[#667085] break-words">
                          {payment.method.replaceAll("_", " ")}
                          {payment.referenceNo && <p className="mt-1 break-words text-[10px] text-[#98A2B3]">Ref: {payment.referenceNo}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-[11px] font-black text-green-700 tabular-nums">
                          <span className="inline-block">{payment.invoice.currency ?? currency} {money(payment.amount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
            <div className="p-5 sm:p-6"><SectionHeading eyebrow="Receivables" title="Outstanding Invoices" href="/invoices" linkLabel="All invoices →" /><p className="mt-1 text-xs text-[#98A2B3]">Highest balances first · current outstanding across all dates.</p></div>
            <div className="overflow-x-auto">
              {(data?.outstandingInvoices.length ?? 0) === 0 ? <EmptyState text="There are no outstanding invoices. Great work!" /> : (
                <table className="w-full min-w-[530px] text-left">
                  <thead><tr className="border-y border-[#E4E7EC] bg-[#FAFAF8] text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]"><th className="px-5 py-3">Invoice / Customer</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Due</th></tr></thead>
                  <tbody>{data?.outstandingInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-[#F0F2F4] last:border-0 hover:bg-[#FAFAF8]">
                      <td className="px-5 py-3"><Link href={`/invoices/${invoice.id}`} className="text-xs font-black text-[#0F6B5B] hover:underline">{invoice.invoiceNo}</Link><p className="mt-1 text-xs font-semibold text-[#344054]">{invoice.customerName}</p><p className="mt-1 text-[10px] text-[#98A2B3]">{invoice.iqamaNo ? `Iqama: ${invoice.iqamaNo} · ` : ""}{invoice.customerMobile}</p></td>
                      <td className="px-3 py-3">{statusBadge(invoice.status)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-black text-red-600">{invoice.currency ?? currency} {money(invoice.balanceAmount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <p className="mt-4 text-right text-[10px] text-[#98A2B3]">Updated {data?.generatedAt ? dateLabel(data.generatedAt) : "—"}</p>
      </div>
    </main>
  );
}
