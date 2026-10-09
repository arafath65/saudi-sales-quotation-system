"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type InvoiceSummary = {
  id: number;
  invoiceNo: string;
  status: string;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceAmount: string | number;
} | null;

type QuotationRow = {
  id: number;
  quotationNo: string;
  quotationDate: string;
  validUntil: string | null;
  customerId: number;
  customerName: string;
  customerMobile: string;
  subtotal: string | number;
  discount: string | number;
  totalAmount: string | number;
  status: string;
  createdAt: string;
  customer: { customerCode: string; passportNo: string | null };
  invoice: InvoiceSummary;
  _count: { items: number };
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  quotations?: QuotationRow[];
};

type ActionsMenuState = {
  quotationId: number;
  top: number;
  left: number;
} | null;

type PaginationItem = number | "left-ellipsis" | "right-ellipsis";

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "right-ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "left-ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "left-ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "right-ellipsis",
    totalPages,
  ];
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function quotationStatusLabel(status: string) {
  switch (status) {
    case "DRAFT": return "Draft";
    case "GENERATED": return "Generated";
    case "ACCEPTED": return "Accepted";
    case "REJECTED": return "Rejected";
    case "CANCELLED": return "Cancelled";
    default: return status.replaceAll("_", " ");
  }
}

function quotationStatusClass(status: string) {
  switch (status) {
    case "ACCEPTED": return "bg-green-50 text-green-700";
    case "REJECTED":
    case "CANCELLED": return "bg-red-50 text-red-700";
    case "DRAFT": return "bg-gray-100 text-gray-700";
    default: return "bg-[#0F6B5B]/10 text-[#0F6B5B]";
  }
}

function invoiceStatusLabel(status: string) {
  switch (status) {
    case "PAID": return "Paid";
    case "PARTIALLY_PAID": return "Partially Paid";
    case "CANCELLED": return "Cancelled";
    default: return "Unpaid";
  }
}

function invoiceStatusClass(status: string) {
  switch (status) {
    case "PAID": return "text-green-700";
    case "PARTIALLY_PAID": return "text-amber-700";
    case "CANCELLED": return "text-red-700";
    default: return "text-red-600";
  }
}

export default function QuotationsRegisterPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [billing, setBilling] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [updatingQuotationId, setUpdatingQuotationId] = useState<number | null>(null);
  const [actionsMenu, setActionsMenu] = useState<ActionsMenuState>(null);
  const pageSize = 10;

  async function loadQuotations() {
    try {
      setLoading(true);
      setError("");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (status) query.set("status", status);
      if (billing) query.set("billing", billing);

      const response = await fetch(
        `/api/quotations/register${query.toString() ? `?${query.toString()}` : ""}`,
        { cache: "no-store" }
      );
      const text = await response.text();
      let data: ApiResponse = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Quotation API returned an invalid response (HTTP ${response.status}).`);
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Unable to load quotations (HTTP ${response.status}).`);
      }
      setQuotations(data.quotations ?? []);
      setPage(1);
    } catch (err) {
      console.error("Load quotation register error:", err);
      setError(err instanceof Error ? err.message : "Unable to load quotations.");
    } finally {
      setLoading(false);
    }
  }

  async function updateQuotationStatus(
    quotation: QuotationRow,
    nextStatus: "ACCEPTED" | "REJECTED"
  ) {
    const actionLabel = nextStatus === "ACCEPTED" ? "accept" : "reject";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} quotation ${quotation.quotationNo} for ${quotation.customerName}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingQuotationId(quotation.id);
      setError("");

      const response = await fetch(`/api/quotations/${quotation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const text = await response.text();
      let data: { success?: boolean; message?: string } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Quotation status API returned an invalid response (HTTP ${response.status}).`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Unable to update quotation status (HTTP ${response.status}).`);
      }

      await loadQuotations();
    } catch (err) {
      console.error("Update quotation status error:", err);
      setError(err instanceof Error ? err.message : "Unable to update quotation status.");
    } finally {
      setUpdatingQuotationId(null);
    }
  }

  function toggleActionsMenu(
  event: ReactMouseEvent<HTMLButtonElement>,
  quotation: QuotationRow
) {

    const buttonRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const actionCount = quotation.invoice
      ? 2 // Open Quote + Invoice
      : 1 +
        (quotation.status !== "CANCELLED" && quotation.status !== "ACCEPTED" ? 1 : 0) +
        (quotation.status !== "CANCELLED" && quotation.status !== "REJECTED" ? 1 : 0);
    const menuHeight = actionCount * 38 + 12;

    let left = buttonRect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    let top = buttonRect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) {
      top = buttonRect.top - menuHeight - 6;
    }
    top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));

    setActionsMenu({ quotationId: quotation.id, top, left });
  }

  function openQuotation(path: string) {
    setActionsMenu(null);
    router.push(path);
  }

  function chooseQuotationStatus(
    quotation: QuotationRow,
    nextStatus: "ACCEPTED" | "REJECTED"
  ) {
    setActionsMenu(null);
    void updateQuotationStatus(quotation, nextStatus);
  }

  useEffect(() => {
    if (!actionsMenu) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest("[data-quotation-actions-menu]") ||
        target.closest("[data-quotation-actions-trigger]")
      ) {
        return;
      }
      setActionsMenu(null);
    }

    function closeMenu() {
      setActionsMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActionsMenu(null);
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

  useEffect(() => {
    const timer = window.setTimeout(() => loadQuotations(), 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, billing]);

  const pageCount = Math.max(1, Math.ceil(quotations.length / pageSize));
  const paginationItems = useMemo(
    () => getPaginationItems(page, pageCount),
    [page, pageCount]
  );
  const visibleQuotations = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    return quotations.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [quotations, page, pageCount]);

  const summary = useMemo(() => quotations.reduce(
    (result, quotation) => {
      result.totalValue += Number(quotation.totalAmount);
      result.notInvoiced += quotation.invoice ? 0 : 1;
      result.invoiced += quotation.invoice ? 1 : 0;
      result.accepted += quotation.status === "ACCEPTED" ? 1 : 0;
      return result;
    },
    { totalValue: 0, notInvoiced: 0, invoiced: 0, accepted: 0 }
  ), [quotations]);

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-5 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Sales</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1F2933]">Quotations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Find saved quotations by customer or quotation number. Open the original quotation,
              or continue to its invoice when the customer accepts.
            </p>
          </div>
          <Link href="/quotations/new" className="inline-flex w-fit items-center justify-center rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0A4F44]">
            + New Quotation
          </Link>
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">Quotations in Results</p>
            <p className="mt-2 text-2xl font-black text-[#1F2933]">{quotations.length}</p>
          </div>
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">Accepted</p>
            <p className="mt-2 text-2xl font-black text-green-700">{summary.accepted}</p>
          </div>
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">Awaiting Invoice</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{summary.notInvoiced}</p>
          </div>
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98A2B3]">Quotation Value in Results</p>
            <p className="mt-2 text-xl font-black text-[#0F6B5B]">SAR {money(summary.totalValue)}</p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="grid gap-3 border-b border-[#E4E7EC] p-5 lg:grid-cols-[minmax(260px,1fr)_200px_210px]">
            <div>
              <label htmlFor="quotationSearch" className="mb-2 block text-xs font-bold text-[#344054]">Search Quotations</label>
              <input id="quotationSearch" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Quotation no, customer, mobile, passport..."
                className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10" />
            </div>
            <div>
              <label htmlFor="quotationStatus" className="mb-2 block text-xs font-bold text-[#344054]">Quotation Status</label>
              <select id="quotationStatus" value={status} onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm outline-none focus:border-[#0F6B5B]">
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="GENERATED">Generated</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="quotationBilling" className="mb-2 block text-xs font-bold text-[#344054]">Invoice Status</label>
              <select id="quotationBilling" value={billing} onChange={(event) => setBilling(event.target.value)}
                className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm outline-none focus:border-[#0F6B5B]">
                <option value="">All billing</option>
                <option value="NOT_INVOICED">Not invoiced</option>
                <option value="INVOICED">Invoiced</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Invoice cancelled</option>
              </select>
            </div>
          </div>

          {error && <div className="m-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={loadQuotations} className="w-fit rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold">Try Again</button>
          </div>}

          {loading && quotations.length === 0 ? (
            <div className="space-y-3 p-5">
              <div className="h-12 animate-pulse rounded-xl bg-[#F0F2F4]" />
              <div className="h-12 animate-pulse rounded-xl bg-[#F0F2F4]" />
              <div className="h-12 animate-pulse rounded-xl bg-[#F0F2F4]" />
            </div>
          ) : visibleQuotations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6B5B]/10 text-xl text-[#0F6B5B]">▤</div>
              <h2 className="mt-4 text-base font-black text-[#1F2933]">No quotations found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
                Generated quotations will be saved here. Try a different search or create a new quotation.
              </p>
              <Link href="/quotations/new" className="mt-5 inline-flex rounded-xl bg-[#0F6B5B] px-4 py-3 text-xs font-bold text-white hover:bg-[#0A4F44]">Create New Quotation</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                    <th className="px-5 py-4">Quotation</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Services</th>
                    <th className="px-4 py-4 text-right">Total</th>
                    <th className="px-4 py-4">Quotation Status</th>
                    <th className="px-4 py-4">Billing</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleQuotations.map((quotation) => (
                    <tr key={quotation.id} className="border-b border-[#F0F2F4] last:border-b-0 hover:bg-[#FAFAF8]/70">
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => router.push(`/quotations/${quotation.id}`)}
                          className="text-left text-sm font-black text-[#0F6B5B] hover:underline">{quotation.quotationNo}</button>
                        <p className="mt-1 text-[11px] text-[#98A2B3]">{dateLabel(quotation.quotationDate)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-bold text-[#1F2933]">{quotation.customerName}</p>
                        <p className="mt-1 text-xs text-[#667085]">{quotation.customerMobile}</p>
                        <p className="mt-1 text-[10px] text-[#98A2B3]">{quotation.customer.customerCode}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-[#344054]">{quotation._count.items}</p>
                        <p className="text-[10px] text-[#98A2B3]">service{quotation._count.items === 1 ? "" : "s"}</p>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black text-[#1F2933] whitespace-nowrap">SAR {money(quotation.totalAmount)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${quotationStatusClass(quotation.status)}`}>
                          {quotationStatusLabel(quotation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {quotation.invoice ? (
                          <div>
                            <Link href={`/invoices/${quotation.invoice.id}`} className="text-xs font-black text-[#0F6B5B] hover:underline">{quotation.invoice.invoiceNo}</Link>
                            <p className={`mt-1 text-[10px] font-bold ${invoiceStatusClass(quotation.invoice.status)}`}>{invoiceStatusLabel(quotation.invoice.status)}</p>
                            <p className="mt-1 text-[10px] text-[#667085]">Due: SAR {money(quotation.invoice.balanceAmount)}</p>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">Not invoiced</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          data-quotation-actions-trigger
                          aria-label={`Actions for quotation ${quotation.quotationNo}`}
                          aria-haspopup="menu"
                          aria-expanded={actionsMenu?.quotationId === quotation.id}
                          title="More actions"
                          onClick={(event) => toggleActionsMenu(event, quotation)}
                          disabled={updatingQuotationId === quotation.id}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            actionsMenu?.quotationId === quotation.id
                              ? "border-[#0F6B5B] bg-[#0F6B5B]/10 text-[#0F6B5B]"
                              : "border-[#D0D5DD] bg-white text-[#344054] hover:border-[#0F6B5B]/50 hover:bg-[#0F6B5B]/5 hover:text-[#0F6B5B]"
                          }`}
                        >
                          <span aria-hidden="true" className="-mt-1 text-2xl leading-none">⋮</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {quotations.length > 0 && <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#667085]">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, quotations.length)} of {quotations.length} quotations{quotations.length === 500 ? " (maximum 500 shown)" : ""}
            </p>
            <nav aria-label="Quotation register pagination" className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054] transition hover:border-[#0F6B5B]/50 hover:text-[#0F6B5B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              {paginationItems.map((item) => {
                if (typeof item !== "number") {
                  return (
                    <span
                      key={item}
                      aria-hidden="true"
                      className="inline-flex h-9 min-w-8 items-center justify-center px-1 text-xs font-bold text-[#98A2B3]"
                    >
                      …
                    </span>
                  );
                }

                const isCurrentPage = item === page;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-label={`Go to page ${item}`}
                    aria-current={isCurrentPage ? "page" : undefined}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-xs font-bold transition ${
                      isCurrentPage
                        ? "border-[#0F6B5B] bg-[#0F6B5B] text-white shadow-sm"
                        : "border-[#D0D5DD] bg-white text-[#344054] hover:border-[#0F6B5B]/50 hover:text-[#0F6B5B]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount}
                className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054] transition hover:border-[#0F6B5B]/50 hover:text-[#0F6B5B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          </div>}
        </section>

        {actionsMenu && (() => {
          const quotation = quotations.find((item) => item.id === actionsMenu.quotationId);
          if (!quotation) return null;

          const menuItemClass =
            "flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-[#F2F4F7] disabled:cursor-not-allowed disabled:opacity-50";

          return (
            <div
              data-quotation-actions-menu
              role="menu"
              aria-label={`Actions for quotation ${quotation.quotationNo}`}
              style={{ top: actionsMenu.top, left: actionsMenu.left }}
              className="fixed z-[100] w-44 rounded-xl border border-[#E4E7EC] bg-white p-1.5 shadow-xl shadow-slate-900/10"
            >
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                onClick={() => openQuotation(`/quotations/${quotation.id}`)}
              >
                <span className="mr-2 text-[#667085]">▤</span>
                Open Quote
              </button>

              {quotation.invoice ? (
                <Link
                  href={`/invoices/${quotation.invoice.id}`}
                  role="menuitem"
                  onClick={() => setActionsMenu(null)}
                  className={`${menuItemClass} text-[#0F6B5B] hover:bg-[#0F6B5B]/5`}
                >
                  <span className="mr-2">▤</span>
                  Invoice
                </Link>
              ) : (
                <>
                  {quotation.status !== "CANCELLED" && quotation.status !== "ACCEPTED" && (
                    <button
                      type="button"
                      role="menuitem"
                      className={`${menuItemClass} text-green-700`}
                      disabled={updatingQuotationId === quotation.id}
                      onClick={() => chooseQuotationStatus(quotation, "ACCEPTED")}
                    >
                      <span className="mr-2">✓</span>
                      Accept
                    </button>
                  )}

                  {quotation.status !== "CANCELLED" && quotation.status !== "REJECTED" && (
                    <button
                      type="button"
                      role="menuitem"
                      className={`${menuItemClass} text-red-600`}
                      disabled={updatingQuotationId === quotation.id}
                      onClick={() => chooseQuotationStatus(quotation, "REJECTED")}
                    >
                      <span className="mr-2">×</span>
                      Reject
                    </button>
                  )}

                </>
              )}
            </div>
          );
        })()}
      </div>
    </main>
  );
}
