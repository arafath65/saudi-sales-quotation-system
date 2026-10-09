"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type InvoiceRow = {
  id: number;
  invoiceNo: string;
  quotationId: number;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  customerMobile: string;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceAmount: string | number;
  status: string;
  _count: {
    payments: number;
    items: number;
  };
};

type DateRange = "ALL_TIME" | "THIS_MONTH" | "LAST_MONTH" | "LAST_3_MONTHS" | "LAST_6_MONTHS" | "LAST_YEAR";

type ApiResponse = {
  success?: boolean;
  message?: string;
  invoices?: InvoiceRow[];
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDateRangeBounds(range: DateRange, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (range === "THIS_MONTH") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      endExclusive: tomorrow,
    };
  }

  if (range === "LAST_MONTH") {
    return {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      endExclusive: new Date(today.getFullYear(), today.getMonth(), 1),
    };
  }

  const months = range === "LAST_3_MONTHS" ? 3 : range === "LAST_6_MONTHS" ? 6 : 12;
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - months, 1);
  const finalDayOfTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();
  const start = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(today.getDate(), finalDayOfTargetMonth)
  );

  return { start, endExclusive: tomorrow };
}

function invoiceIsInRange(invoiceDate: string, range: DateRange) {
  if (range === "ALL_TIME") return true;

  const date = new Date(invoiceDate);
  if (Number.isNaN(date.getTime())) return false;

  const { start, endExclusive } = getDateRangeBounds(range);
  return date >= start && date < endExclusive;
}

function statusLabel(status: string) {
  switch (status) {
    case "PAID":
      return "PAID";
    case "PARTIALLY_PAID":
      return "PARTIALLY PAID";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UNPAID";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-50 text-green-700";
    case "PARTIALLY_PAID":
      return "bg-amber-50 text-amber-700";
    case "CANCELLED":
      return "bg-red-50 text-red-700";
    default:
      return "bg-[#0F6B5B]/10 text-[#0F6B5B]";
  }
}

function getPaginationItems(
  currentPage: number,
  totalPages: number
): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "…", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "…",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "…",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "…",
    totalPages,
  ];
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("THIS_MONTH");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 10;

  async function loadInvoices() {
    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams();

      if (search.trim()) query.set("search", search.trim());
      if (status) query.set("status", status);

      const response = await fetch(
        `/api/invoices${query.toString() ? `?${query}` : ""}`,
        { cache: "no-store" }
      );

      const text = await response.text();
      let data: ApiResponse = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Invoice API returned an invalid response (HTTP ${response.status}).`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            `Unable to load invoices (HTTP ${response.status}).`
        );
      }

      setInvoices(data.invoices ?? []);
      setPage(1);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInvoices();
    }, 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const summaryInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceIsInRange(invoice.invoiceDate, dateRange)),
    [invoices, dateRange]
  );

  const pageCount = Math.max(1, Math.ceil(invoices.length / pageSize));

  const visibleInvoices = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;

    return invoices.slice(start, start + pageSize);
  }, [invoices, page, pageCount]);

  const summary = useMemo(() => {
    return summaryInvoices.reduce(
      (result, invoice) => {
        result.total += Number(invoice.totalAmount);
        result.paid += Number(invoice.paidAmount);
        result.due += Number(invoice.balanceAmount);
        return result;
      },
      { total: 0, paid: 0, due: 0 }
    );
  }, [summaryInvoices]);

  if (loading && invoices.length === 0) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-5 sm:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-[#E4E7EC]" />
          <div className="mt-6 h-20 animate-pulse rounded-2xl bg-white" />
          <div className="mt-5 h-[520px] animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-5 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
              Billing
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1F2933]">
              Invoices
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              View invoices anytime, search by customer or invoice number, and
              open an invoice to record payments.
            </p>
          </div>

        </div>

        <div className="mt-7 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
              Invoice Summary
            </p>
            <p className="mt-1 text-xs text-[#98A2B3]">
              Summary totals are based on the selected date range.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="invoiceDateRange" className="whitespace-nowrap text-xs font-bold text-[#344054]">
              Date Range
            </label>
            <select
              id="invoiceDateRange"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as DateRange)}
              className="min-w-[170px] rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-medium text-[#344054] outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="LAST_3_MONTHS">Last 3 Months</option>
              <option value="LAST_6_MONTHS">Last 6 Months</option>
              <option value="LAST_YEAR">Last 1 Year</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
              Invoice Total
            </p>
            <p className="mt-2 text-xl font-black text-[#1F2933]">
              SAR {money(summary.total)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
              Paid
            </p>
            <p className="mt-2 text-xl font-black text-green-700">
              SAR {money(summary.paid)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
              Outstanding Due
            </p>
            <p className="mt-2 text-xl font-black text-red-600">
              SAR {money(summary.due)}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadInvoices}
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
            >
              Retry
            </button>
          </div>
        )}

        <section className="mt-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E4E7EC] p-5 md:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice, customer, mobile or passport..."
              className="min-w-0 flex-1 rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
            >
              <option value="">All Statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {visibleInvoices.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-[#1F2933]">
                No invoices found
              </p>
              <p className="mt-1 text-xs text-[#98A2B3]">
                Create an invoice from a quotation and it will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left">
                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                    <th className="px-5 py-4">Invoice</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4 text-right">Total</th>
                    <th className="px-4 py-4 text-right">Paid</th>
                    <th className="px-4 py-4 text-right">Due</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[#F0F2F4] last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-[#0F6B5B]">
                          {invoice.invoiceNo}
                        </p>
                        <p className="mt-1 text-[10px] text-[#98A2B3]">
                          {invoice._count.items} service
                          {invoice._count.items === 1 ? "" : "s"} ·{" "}
                          {invoice._count.payments} payment
                          {invoice._count.payments === 1 ? "" : "s"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-sm font-bold text-[#1F2933]">
                          {invoice.customerName}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          {invoice.customerMobile}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-xs text-[#667085]">
                        {formatDate(invoice.invoiceDate)}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-bold text-[#1F2933]">
                        SAR {money(invoice.totalAmount)}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-bold text-green-700">
                        SAR {money(invoice.paidAmount)}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-black text-red-600">
                        SAR {money(invoice.balanceAmount)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] ${statusClass(invoice.status)}`}
                        >
                          {statusLabel(invoice.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          aria-label={`View invoice ${invoice.invoiceNo}`}
                          className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0A4F44] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#0F6B5B]/20"
                        >
                          <span>View Invoice</span>
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            fill="none"
                            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          >
                            <path
                              d="M4.167 10h11.666M10 4.167 15.833 10 10 15.833"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoices.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#667085]">
                Showing {(page - 1) * pageSize + 1}–{" "}
                {Math.min(page * pageSize, invoices.length)} of{" "}
                {invoices.length} invoices
              </p>

              <nav
                aria-label="Invoice pagination"
                className="flex flex-wrap items-center justify-end gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="mr-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#344054] transition hover:border-[#0F6B5B] hover:text-[#0F6B5B] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {getPaginationItems(page, pageCount).map((item, index) =>
                  item === "…" ? (
                    <span
                      key={`ellipsis-${index}`}
                      aria-hidden="true"
                      className="px-1.5 text-sm font-semibold text-[#98A2B3]"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Go to page ${item}`}
                      aria-current={page === item ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className={`h-9 min-w-9 rounded-lg px-2.5 text-xs font-bold transition ${
                        page === item
                          ? "bg-[#0F6B5B] text-white shadow-sm"
                          : "border border-[#D0D5DD] bg-white text-[#344054] hover:border-[#0F6B5B] hover:text-[#0F6B5B]"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  disabled={page >= pageCount}
                  className="ml-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#344054] transition hover:border-[#0F6B5B] hover:text-[#0F6B5B] disabled:cursor-not-allowed disabled:opacity-40"
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
