"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    currency?: "SAR" | "LKR" | "USD";
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
    totalAmountByCurrency: { SAR: number; LKR: number; USD: number };
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  ONLINE_TRANSFER: "Online Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<ApiResponse["summary"]>({
    count: 0,
    totalAmountByCurrency: { SAR: 0, LKR: 0, USD: 0 },
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 10, totalPages: 1, totalCount: 0 });
  const pageSize = 10;

  async function loadPayments(requestedPage = page) {
    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        range: "ALL_TIME",
        page: String(requestedPage),
        pageSize: String(pageSize),
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
          data.message ||
            `Unable to load payments (HTTP ${response.status}).`
        );
      }

      setPayments(data.payments ?? []);
      setPaymentSummary(data.summary ?? {
        count: 0,
        totalAmountByCurrency: { SAR: 0, LKR: 0, USD: 0 },
      });
      setPageInfo(data.pagination ?? {
        page: requestedPage,
        pageSize,
        totalPages: 1,
        totalCount: data.payments?.length ?? 0,
      });
      setPage(data.pagination?.page ?? requestedPage);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to load payments."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPayments(page);
    }, 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const visiblePayments = payments;

  const totalPaymentsByCurrency = paymentSummary?.totalAmountByCurrency ?? {
    SAR: 0,
    LKR: 0,
    USD: 0,
  };

  if (loading && payments.length === 0) {
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
              Payments
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              Every payment is linked to its invoice and therefore to the
              customer, so payment history can be checked by customer at any
              time.
            </p>
          </div>

          <Link
            href="/invoices"
            className="w-fit rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-xs font-bold text-[#344054] hover:border-[#0F6B5B]/40 hover:text-[#0F6B5B]"
          >
            Open Invoices →
          </Link>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
              Payment Records
            </p>
            <p className="mt-2 text-xl font-black text-[#1F2933]">
              {paymentSummary?.count ?? payments.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
              Total Received
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-black text-green-700">
              {(["SAR", "LKR", "USD"] as const).map((currency) => (
                <span key={currency}>{currency} {totalPaymentsByCurrency[currency].toFixed(2)}</span>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-[#98A2B3]">Totals are separated by currency.</p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
  void loadPayments();
}}
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
            >
              Retry
            </button>
          </div>
        )}

        <section className="mt-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="border-b border-[#E4E7EC] p-5">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search customer, invoice number, mobile or reference..."
              className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
            />
          </div>

          {visiblePayments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-[#1F2933]">
                No payment records found
              </p>
              <p className="mt-1 text-xs text-[#98A2B3]">
                Payments recorded against invoices will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left">
                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-4 py-4">Invoice</th>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">Method</th>
                    <th className="px-4 py-4">Reference</th>
                    <th className="px-4 py-4">Added By</th>
                    <th className="px-5 py-4 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[#F0F2F4] last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-[#1F2933]">
                          {payment.invoice.customerName}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          {payment.invoice.customerMobile}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <Link
                          href={`/invoices/${payment.invoice.id}`}
                          className="text-sm font-bold text-[#0F6B5B] hover:underline"
                        >
                          {payment.invoice.invoiceNo}
                        </Link>
                      </td>

                      <td className="px-4 py-4 text-xs text-[#667085]">
                        {formatDate(payment.paymentDate)}
                      </td>

                      <td className="px-4 py-4 text-xs font-semibold text-[#344054]">
                        {METHOD_LABELS[payment.method] ?? payment.method}
                      </td>

                      <td className="px-4 py-4 text-xs text-[#667085]">
                        {payment.referenceNo || "—"}
                      </td>

                      <td className="px-4 py-4 text-xs text-[#667085]">
                        {payment.createdBy?.name || "—"}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-black text-green-700">
                        {payment.invoice.currency ?? "SAR"} {money(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {payments.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#667085]">
                Showing {pageInfo.totalCount === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1}–{" "}
                {Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount)} of{" "}
                {pageInfo.totalCount} payments
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pageInfo.page <= 1}
                  className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageInfo.totalPages, current + 1))
                  }
                  disabled={pageInfo.page >= pageInfo.totalPages}
                  className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
