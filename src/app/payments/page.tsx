"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type DateRange =
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_6_MONTHS"
  | "LAST_1_YEAR"
  | "ALL_TIME";

type PaymentRow = {
  id: number;
  invoiceId: number;
  paymentDate: string;
  amount: string | number;
  method: string;
  referenceNo: string | null;
  notes: string | null;
  invoice: {
    id: number;
    invoiceNo: string;
    customerId: number;
    customerName: string;
    customerMobile: string;
    totalAmount: string | number;
    paidAmount: string | number;
    balanceAmount: string | number;
  };
  createdBy: {
    id: number;
    name: string;
    username: string;
  } | null;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  payments?: PaymentRow[];
  summary?: {
    count: number;
    totalAmount: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
};

const PAGE_SIZE = 10;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  ONLINE_TRANSFER: "Online Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

const RANGE_LABELS: Record<DateRange, string> = {
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  LAST_3_MONTHS: "Last 3 Months",
  LAST_6_MONTHS: "Last 6 Months",
  LAST_1_YEAR: "Last 1 Year",
  ALL_TIME: "All Time",
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function paginationItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: (number | "left-ellipsis" | "right-ellipsis")[] = [1];

  if (currentPage > 3) items.push("left-ellipsis");

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < totalPages - 2) items.push("right-ellipsis");

  items.push(totalPages);
  return items;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>("THIS_MONTH");
  const [method, setMethod] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState({ count: 0, totalAmount: 0 });
  const [totalPagesFromApi, setTotalPagesFromApi] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const query = new URLSearchParams({
          range,
          method,
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (search.trim()) query.set("search", search.trim());

        const response = await fetch(`/api/payments?${query.toString()}`, {
          cache: "no-store",
        });

        const text = await response.text();
        let data: ApiResponse = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            `Payment API returned an invalid response (HTTP ${response.status}).`
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || `Unable to load payments (HTTP ${response.status}).`
          );
        }

        if (cancelled) return;

        setPayments(data.payments ?? []);
        setSummary(data.summary ?? { count: 0, totalAmount: 0 });
        setTotalPagesFromApi(data.pagination?.totalPages ?? 1);

        if (data.pagination?.page && data.pagination.page !== page) {
          setPage(data.pagination.page);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Load payments error:", err);
        setError(err instanceof Error ? err.message : "Unable to load payments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, range, method, page, refreshKey]);

  const pageCount = Math.max(1, totalPagesFromApi);
  const pageItems = useMemo(
    () => paginationItems(pageCount, page),
    [pageCount, page]
  );

  const firstRow = summary.count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, summary.count);

  function changeRange(value: string) {
    setRange(value as DateRange);
    setPage(1);
  }

  function changeMethod(value: string) {
    setMethod(value);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
  }

  if (loading && payments.length === 0 && summary.count === 0 && !error) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-5 sm:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-[#E4E7EC]" />
          <div className="mt-6 h-28 animate-pulse rounded-2xl bg-white" />
          <div className="mt-5 h-[500px] animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
              Billing
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1F2933]">
              Payments
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
              Review collections across all invoices, filter by date and payment method, and open an invoice to inspect its payment history.
            </p>
          </div>

          <Link
            href="/invoices"
            className="w-fit shrink-0 rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-xs font-bold text-[#344054] transition hover:border-[#0F6B5B]/40 hover:text-[#0F6B5B]"
          >
            Open Invoices →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
                  Total Received
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight text-green-700">
                  SAR {money(summary.totalAmount)}
                </p>
                <p className="mt-2 text-xs text-[#667085]">
                  {summary.count.toLocaleString("en-US")} payment{summary.count === 1 ? "" : "s"} · {RANGE_LABELS[range]}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 7.5h16v11H4z" />
                  <path d="M4 10h16M8 15h3M16 4l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-sm font-bold text-[#1F2933]">Payment register filters</p>
              <p className="mt-1 text-xs leading-5 text-[#667085]">
                Select a period or method, or search by customer, invoice, mobile, or reference.
              </p>
            </div>
            <div className="mt-3 shrink-0 sm:mt-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">Matching payments</p>
              <p className="mt-1 text-lg font-black text-[#1F2933]">{summary.count.toLocaleString("en-US")}</p>
            </div>
          </section>
        </div>

        {error && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="w-fit shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
            >
              Retry
            </button>
          </div>
        )}

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="border-b border-[#E4E7EC] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#1F2933]">Payment Register</h2>
                <p className="mt-1 text-xs text-[#667085]">
                  {loading ? "Updating results…" : `Showing ${summary.count ? `${firstRow}–${lastRow} of ` : ""}${summary.count.toLocaleString("en-US")} payment${summary.count === 1 ? "" : "s"}`}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                Newest payments first
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px]">
              <div>
                <label htmlFor="paymentSearch" className="mb-1.5 block text-xs font-bold text-[#344054]">
                  Search payments
                </label>
                <input
                  id="paymentSearch"
                  type="search"
                  value={search}
                  onChange={(event) => changeSearch(event.target.value)}
                  placeholder="Customer, invoice number, mobile or reference..."
                  className="w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                />
              </div>

              <div>
                <label htmlFor="paymentDateRange" className="mb-1.5 block text-xs font-bold text-[#344054]">
                  Date range
                </label>
                <select
                  id="paymentDateRange"
                  value={range}
                  onChange={(event) => changeRange(event.target.value)}
                  className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                >
                  <option value="THIS_MONTH">This Month</option>
                  <option value="LAST_MONTH">Last Month</option>
                  <option value="LAST_3_MONTHS">Last 3 Months</option>
                  <option value="LAST_6_MONTHS">Last 6 Months</option>
                  <option value="LAST_1_YEAR">Last 1 Year</option>
                  <option value="ALL_TIME">All Time</option>
                </select>
              </div>

              <div>
                <label htmlFor="paymentMethod" className="mb-1.5 block text-xs font-bold text-[#344054]">
                  Payment method
                </label>
                <select
                  id="paymentMethod"
                  value={method}
                  onChange={(event) => changeMethod(event.target.value)}
                  className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                >
                  <option value="ALL">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="ONLINE_TRANSFER">Online Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {loading && payments.length > 0 && (
            <div className="border-b border-[#E4E7EC] bg-[#F7F8F6] px-5 py-2 text-xs font-medium text-[#667085]">
              Updating payment register…
            </div>
          )}

          {payments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6B5B]/10 text-[#0F6B5B]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 6.5h16v13H4zM4 10h16M8 15h3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-bold text-[#1F2933]">No payments found</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#667085]">
                Try another date range or payment method, or clear the search. Payments recorded against invoices will appear here.
              </p>
              {(search || method !== "ALL" || range !== "THIS_MONTH") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setRange("THIS_MONTH");
                    setMethod("ALL");
                    setPage(1);
                  }}
                  className="mt-4 rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054] hover:border-[#0F6B5B]/40 hover:text-[#0F6B5B]"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                    <th className="whitespace-nowrap px-4 py-3">Customer</th>
                    <th className="whitespace-nowrap px-3 py-3">Invoice</th>
                    <th className="whitespace-nowrap px-3 py-3">Date</th>
                    <th className="whitespace-nowrap px-3 py-3">Method</th>
                    <th className="whitespace-nowrap px-3 py-3">Reference</th>
                    <th className="whitespace-nowrap px-3 py-3">Added By</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#F0F2F4] last:border-b-0 hover:bg-[#FAFAF8]/70">
                      <td className="px-4 py-4">
                        <p className="text-sm font-bold text-[#1F2933]">{payment.invoice.customerName}</p>
                        <p className="mt-1 text-xs text-[#667085]">{payment.invoice.customerMobile}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">
                        <Link href={`/invoices/${payment.invoice.id}`} className="text-sm font-bold text-[#0F6B5B] hover:underline">
                          {payment.invoice.invoiceNo}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-[#667085]">{formatDate(payment.paymentDate)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs font-semibold text-[#344054]">{METHOD_LABELS[payment.method] ?? payment.method}</td>
                      <td className="max-w-[130px] truncate px-3 py-4 text-xs text-[#667085]" title={payment.referenceNo || undefined}>{payment.referenceNo || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-[#667085]">{payment.createdBy?.name || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-black text-green-700">SAR {money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary.count > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs text-[#667085]">
                Showing <span className="font-bold text-[#344054]">{firstRow}–{lastRow}</span> of <span className="font-bold text-[#344054]">{summary.count.toLocaleString("en-US")}</span> payments
              </p>

              <nav aria-label="Payment register pagination" className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {pageItems.map((item, index) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goToPage(item)}
                      disabled={loading}
                      aria-current={page === item ? "page" : undefined}
                      aria-label={`Go to page ${item}`}
                      className={`min-w-9 rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${page === item ? "bg-[#0F6B5B] text-white" : "border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"}`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={`${item}-${index}`} className="px-1.5 text-sm text-[#98A2B3]" aria-hidden="true">…</span>
                  )
                )}

                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pageCount || loading}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
