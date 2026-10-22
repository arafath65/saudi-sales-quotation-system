"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import Link from "next/link";

type Currency = "SAR" | "LKR" | "USD";

type InvoiceRow = {
  id: number;
  invoiceNo: string;
  quotationId: number;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  customerMobile: string;
  currency?: Currency | null;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceAmount: string | number;
  status: string;
  _count: {
    payments: number;
    items: number;
  };
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  invoices?: InvoiceRow[];
};

type InvoiceActionsMenuState = {
  invoiceId: number;
  top: number;
  left: number;
} | null;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [actionsMenu, setActionsMenu] =
    useState<InvoiceActionsMenuState>(null);

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
        err instanceof Error
          ? err.message
          : "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInvoices();
    }, 250);

    return () => window.clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const pageCount = Math.max(
    1,
    Math.ceil(invoices.length / pageSize)
  );

  const visibleInvoices = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;

    return invoices.slice(start, start + pageSize);
  }, [invoices, page, pageCount]);

  const summary = useMemo(() => {
    const result: Record<
      Currency,
      { total: number; paid: number; due: number }
    > = {
      SAR: { total: 0, paid: 0, due: 0 },
      LKR: { total: 0, paid: 0, due: 0 },
      USD: { total: 0, paid: 0, due: 0 },
    };

    for (const invoice of invoices) {
      const currency: Currency = invoice.currency ?? "SAR";

      result[currency].total +=
        Number(invoice.totalAmount) || 0;

      result[currency].paid +=
        Number(invoice.paidAmount) || 0;

      result[currency].due +=
        Number(invoice.balanceAmount) || 0;
    }

    return result;
  }, [invoices]);

  function toggleInvoiceActions(
    event: MouseEvent<HTMLButtonElement>,
    invoice: InvoiceRow
  ) {
    if (actionsMenu?.invoiceId === invoice.id) {
      setActionsMenu(null);
      return;
    }

    const buttonRect =
      event.currentTarget.getBoundingClientRect();

    const menuWidth = 190;
    const menuHeight = 92;

    const left = Math.max(
      8,
      Math.min(
        buttonRect.right - menuWidth,
        window.innerWidth - menuWidth - 8
      )
    );

    let top = buttonRect.bottom + 6;

    if (top + menuHeight > window.innerHeight - 8) {
      top = buttonRect.top - menuHeight - 6;
    }

    top = Math.max(
      8,
      Math.min(top, window.innerHeight - menuHeight - 8)
    );

    setActionsMenu({
      invoiceId: invoice.id,
      top,
      left,
    });
  }

  useEffect(() => {
    if (!actionsMenu) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      if (
        target.closest("[data-invoice-actions-menu]") ||
        target.closest("[data-invoice-actions-trigger]")
      ) {
        return;
      }

      setActionsMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActionsMenu(null);
    }

    function closeMenu() {
      setActionsMenu(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [actionsMenu]);

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
              View invoices anytime, search by customer or invoice number,
              and open an invoice to record payments.
            </p>
          </div>

          <Link
            href="/quotations/new"
            className="w-fit rounded-xl bg-[#0F6B5B] px-4 py-3 text-xs font-bold text-white hover:bg-[#0A4F44]"
          >
            + New Quotation
          </Link>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {(["Invoice Total", "Paid", "Outstanding Due"] as const).map(
            (label) => (
              <div
                key={label}
                className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">
                  {label}
                </p>

                <div
                  className={`mt-2 space-y-1 text-xl font-black ${
                    label === "Paid"
                      ? "text-green-700"
                      : label === "Outstanding Due"
                        ? "text-red-600"
                        : "text-[#1F2933]"
                  }`}
                >
                  {(["SAR", "LKR", "USD"] as const).map(
                    (currency) => {
                      const amount =
                        label === "Invoice Total"
                          ? summary[currency].total
                          : label === "Paid"
                            ? summary[currency].paid
                            : summary[currency].due;

                      return (
                        <p key={currency}>
                          {currency} {money(amount)}
                        </p>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {error && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadInvoices()}
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
                    <th className="px-5 py-4 text-right">Actions</th>
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
                        {invoice.currency ?? "SAR"} {money(invoice.totalAmount)}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-bold text-green-700">
                        {invoice.currency ?? "SAR"} {money(invoice.paidAmount)}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-black text-red-600">
                        {invoice.currency ?? "SAR"} {money(invoice.balanceAmount)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] ${statusClass(invoice.status)}`}
                        >
                          {statusLabel(invoice.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          data-invoice-actions-trigger
                          aria-label={`Actions for invoice ${invoice.invoiceNo}`}
                          aria-haspopup="menu"
                          aria-expanded={actionsMenu?.invoiceId === invoice.id}
                          title="More actions"
                          onClick={(event) =>
                            toggleInvoiceActions(event, invoice)
                          }
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                            actionsMenu?.invoiceId === invoice.id
                              ? "border-[#0F6B5B] bg-[#0F6B5B]/10 text-[#0F6B5B]"
                              : "border-[#D0D5DD] bg-white text-[#344054] hover:border-[#0F6B5B]/50 hover:bg-[#0F6B5B]/5 hover:text-[#0F6B5B]"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="-mt-1 text-2xl leading-none"
                          >
                            ⋮
                          </span>
                        </button>
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
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  disabled={page <= 1}
                  className="mr-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#344054] transition hover:border-[#0F6B5B] hover:text-[#0F6B5B] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {getPaginationItems(page, pageCount).map(
                  (item, index) =>
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
                        aria-current={
                          page === item ? "page" : undefined
                        }
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

        {actionsMenu &&
          (() => {
            const invoice = invoices.find(
              (item) => item.id === actionsMenu.invoiceId
            );

            if (!invoice) return null;

            const menuItemClass =
              "flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-[#F2F4F7]";

            const hasBalance =
              Number(invoice.balanceAmount) > 0 &&
              invoice.status !== "CANCELLED";

            return (
              <div
                data-invoice-actions-menu
                role="menu"
                aria-label={`Actions for invoice ${invoice.invoiceNo}`}
                style={{
                  top: actionsMenu.top,
                  left: actionsMenu.left,
                }}
                className="fixed z-[100] w-48 rounded-xl border border-[#E4E7EC] bg-white p-1.5 shadow-xl shadow-slate-900/10"
              >
                <Link
                  href={`/quotations/${invoice.quotationId}`}
                  role="menuitem"
                  onClick={() => setActionsMenu(null)}
                  className={`${menuItemClass} text-[#344054]`}
                >
                  Open Quotation
                </Link>

                <Link
                  href={`/invoices/${invoice.id}`}
                  role="menuitem"
                  onClick={() => setActionsMenu(null)}
                  className={`${menuItemClass} ${
                    hasBalance ? "text-[#0F6B5B]" : "text-[#344054]"
                  }`}
                >
                  {hasBalance ? "Make Payment" : "Open Invoice"}
                </Link>
              </div>
            );
          })()}
      </div>
    </main>
  );
}