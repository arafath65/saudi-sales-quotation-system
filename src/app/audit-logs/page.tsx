import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const MODULES = [
  "AUTH",
  "CUSTOMER",
  "QUOTATION",
  "INVOICE",
  "PAYMENT",
  "COMPANY_SETTINGS",
  "SETTINGS",
  "SERVICE",
  "ROUTE",
  "VEHICLE_TYPE",
] as const;

const ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "VIEW",
  "LIST",
  "CREATE",
  "UPDATE",
  "DELETE",
  "ACCEPT",
  "REJECT",
  "CANCEL",
  "ACTIVATE",
  "DEACTIVATE",
  "PAYMENT_CREATE",
] as const;

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

function param(value: SearchParamValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getColomboDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function buildPageHref(
  targetPage: number,
  filters: { from: string; to: string; module: string; action: string; search: string }
) {
  const query = new URLSearchParams();
  query.set("from", filters.from);
  query.set("to", filters.to);
  if (filters.module) query.set("module", filters.module);
  if (filters.action) query.set("action", filters.action);
  if (filters.search) query.set("search", filters.search);
  query.set("page", String(targetPage));
  return `/audit-logs?${query.toString()}`;
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-bold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#344054] outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const userId = await getSessionUserId();

  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, isActive: true },
  });

  if (!user?.isActive) redirect("/login");

  const params = await searchParams;
  const today = getColomboDate(new Date());
  const defaultFrom = addDays(today, -29);

  const rawFrom = param(params.from);
  const rawTo = param(params.to);
  const fromValue = isDateString(rawFrom) ? rawFrom : defaultFrom;
  const toValue = isDateString(rawTo) ? rawTo : today;
  const from = fromValue <= toValue ? fromValue : toValue;
  const to = fromValue <= toValue ? toValue : fromValue;
  const moduleFilter = param(params.module).trim();
  const actionFilter = param(params.action).trim();
  const search = param(params.search).trim();
  const requestedPage = Number.parseInt(param(params.page), 10);
  const requestedPageSafe = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const startDate = new Date(`${from}T00:00:00+05:30`);
  const endDate = new Date(`${to}T00:00:00+05:30`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: startDate, lt: endDate },
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search } },
            { entity: { contains: search } },
            { entityId: { contains: search } },
            { user: { is: { username: { contains: search } } } },
          ],
        }
      : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPageSafe, totalPages);
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      createdAt: true,
      module: true,
      action: true,
      entity: true,
      entityId: true,
      description: true,
      metadata: true,
      user: { select: { username: true, name: true } },
    },
  });

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);
  const filters = { from, to, module: moduleFilter, action: actionFilter, search };
  const visiblePages = Array.from(
    { length: Math.min(totalPages, 7) },
    (_, index) => {
      if (totalPages <= 7) return index + 1;
      if (page <= 4) return index + 1;
      if (page >= totalPages - 3) return totalPages - 6 + index;
      return page - 3 + index;
    }
  );

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-4 text-[#1F2933] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">System</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Audit Logs</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Review user activity across customers, quotations, invoices, payments and settings.
            </p>
          </div>
          <div className="text-xs text-[#667085]">
            Signed in as <span className="font-bold text-[#344054]">{user.username}</span>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <form method="get">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <FilterField label="From">
                <input name="from" type="date" defaultValue={from} className={fieldClass} />
              </FilterField>
              <FilterField label="To">
                <input name="to" type="date" defaultValue={to} className={fieldClass} />
              </FilterField>
              <FilterField label="Module">
                <select name="module" defaultValue={moduleFilter} className={fieldClass}>
                  <option value="">All Modules</option>
                  {MODULES.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
                </select>
              </FilterField>
              <FilterField label="Action">
                <select name="action" defaultValue={actionFilter} className={fieldClass}>
                  <option value="">All Actions</option>
                  {ACTIONS.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
                </select>
              </FilterField>
              <FilterField label="Search">
                <input name="search" defaultValue={search} placeholder="User, details or record..." className={fieldClass} />
              </FilterField>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[#F0F2F4] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#667085]">
                Showing <span className="font-bold text-[#344054]">{startItem}–{endItem}</span> of <span className="font-bold text-[#344054]">{total}</span> activity records
              </p>
              <div className="flex gap-2">
                <Link href="/audit-logs" className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-xs font-bold text-[#344054] hover:bg-[#FAFAF8]">Reset</Link>
                <button type="submit" className="rounded-xl bg-[#0F6B5B] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#0A4F44]">Apply Filters</button>
              </div>
            </div>
          </form>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black">Activity History</h2>
              <p className="mt-1 text-xs text-[#667085]">Newest events first · {PAGE_SIZE} records per page</p>
            </div>
            {total > 0 && <span className="text-xs font-semibold text-[#667085]">Page {page} of {totalPages}</span>}
          </div>

          {logs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6B5B]/10 text-[#0F6B5B]">≡</div>
              <h3 className="mt-4 text-sm font-bold">No audit activity found</h3>
              <p className="mt-1 text-xs text-[#667085]">Try another date range or clear the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                    <th className="px-5 py-4">Date / Time</th>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Module</th>
                    <th className="px-4 py-4">Action</th>
                    <th className="px-4 py-4">Record</th>
                    <th className="px-5 py-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#F0F2F4] align-top last:border-b-0 hover:bg-[#FAFAF8]/70">
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[#667085]">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-4 text-xs font-semibold text-[#344054]">{log.user?.name || log.user?.username || "System"}</td>
                      <td className="px-4 py-4"><span className="inline-flex rounded-full bg-[#0F6B5B]/10 px-2.5 py-1 text-[10px] font-bold text-[#0F6B5B]">{formatLabel(log.module)}</span></td>
                      <td className="px-4 py-4"><span className="inline-flex rounded-full bg-[#C9A227]/15 px-2.5 py-1 text-[10px] font-bold text-[#8A6D13]">{formatLabel(log.action)}</span></td>
                      <td className="px-4 py-4 text-xs text-[#667085]">{log.entity ? formatLabel(log.entity) : "—"}{log.entityId ? <span className="mt-1 block text-[10px] text-[#98A2B3]">ID: {log.entityId}</span> : null}</td>
                      <td className="max-w-md px-5 py-4">
                        <p className="whitespace-normal text-xs leading-5 text-[#344054]">{log.description}</p>
                        {log.metadata ? (
                          <details className="mt-2">
                            <summary className="w-fit cursor-pointer text-[10px] font-bold text-[#0F6B5B]">View details</summary>
                            <pre className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#F7F8F6] p-3 text-[10px] leading-4 text-[#667085]">{JSON.stringify(log.metadata, null, 2)}</pre>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#667085]">Showing {startItem}–{endItem} of {total}</p>
              <nav aria-label="Audit log pagination" className="flex flex-wrap items-center gap-1">
                <Link aria-disabled={page <= 1} href={buildPageHref(Math.max(1, page - 1), filters)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${page <= 1 ? "pointer-events-none border-[#EAECF0] text-[#C0C5CC]" : "border-[#D0D5DD] text-[#344054] hover:bg-[#FAFAF8]"}`}>Previous</Link>
                {totalPages > 7 && page > 4 ? <><Link href={buildPageHref(1, filters)} className="min-w-9 rounded-lg border border-[#D0D5DD] px-3 py-2 text-center text-xs font-bold text-[#344054]">1</Link><span className="px-1 text-[#98A2B3]">…</span></> : null}
                {visiblePages.map((pageNumber) => (
                  <Link key={pageNumber} href={buildPageHref(pageNumber, filters)} aria-current={pageNumber === page ? "page" : undefined} className={`min-w-9 rounded-lg px-3 py-2 text-center text-xs font-bold ${pageNumber === page ? "bg-[#0F6B5B] text-white" : "border border-[#D0D5DD] text-[#344054] hover:bg-[#FAFAF8]"}`}>{pageNumber}</Link>
                ))}
                {totalPages > 7 && page < totalPages - 3 ? <><span className="px-1 text-[#98A2B3]">…</span><Link href={buildPageHref(totalPages, filters)} className="min-w-9 rounded-lg border border-[#D0D5DD] px-3 py-2 text-center text-xs font-bold text-[#344054]">{totalPages}</Link></> : null}
                <Link aria-disabled={page >= totalPages} href={buildPageHref(Math.min(totalPages, page + 1), filters)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${page >= totalPages ? "pointer-events-none border-[#EAECF0] text-[#C0C5CC]" : "border-[#D0D5DD] text-[#344054] hover:bg-[#FAFAF8]"}`}>Next</Link>
              </nav>
            </div>
          )}
        </section>

        <p className="mt-4 text-[10px] leading-5 text-[#98A2B3]">Audit records are read-only. Activity is listed in descending date/time order.</p>
      </div>
    </main>
  );
}
