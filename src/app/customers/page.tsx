"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";

type Customer = {
  id: number;
  customerCode: string;
  name: string;
  mobile: string;
  whatsapp: string | null;
  iqamaNo: string | null;
  nationality: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CustomerForm = {
  name: string;
  mobile: string;
  whatsapp: string;
  nationality: string;
  notes: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type ApiResponse = {
  success?: boolean;
  message?: string;
  customers?: Customer[];
  customer?: Customer;
};

const EMPTY_FORM: CustomerForm = {
  name: "",
  mobile: "",
  whatsapp: "",
  nationality: "",
  notes: "",
};

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const customerFormRef = useRef<HTMLFormElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCustomers();
  }, []);

  useLayoutEffect(() => {
    if (!pageRef.current || loading) return;

    const context = gsap.context(() => {
      gsap.from(".customer-header", {
        opacity: 0,
        y: 14,
        duration: 0.45,
        ease: "power3.out",
      });
      gsap.from(".customer-card", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        delay: 0.08,
        ease: "power3.out",
      });
    }, pageRef);

    return () => context.revert();
  }, [loading]);

  useEffect(() => {
    if (!modalOpen) return;
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [modalOpen, editingCustomer]);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/customers", {
        cache: "no-store",
        credentials: "same-origin",
      });

      // The customer API uses the same login cookie as the dashboard API.
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to load customers.");
      }

      setCustomers(data.customers ?? []);
    } catch (err) {
      console.error("Load customers error:", err);
      setError(err instanceof Error ? err.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEditModal(customer: Customer) {
  setEditingCustomer(customer);

  setForm({
    name: customer.name,
    mobile: customer.mobile,
    whatsapp: customer.whatsapp ?? "",
    nationality: customer.nationality ?? "",
    notes: customer.notes ?? "",
  });

  setError("");
  setMessage("");
  setModalOpen(true);
}

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setError("");
  }

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleEnterToNextField(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();

    const formElement = customerFormRef.current;
    if (!formElement) return;

    const focusableFields = Array.from(
      formElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[data-enter-next='true'], textarea[data-enter-next='true']"
      )
    );
    const currentIndex = focusableFields.indexOf(event.currentTarget);
    if (currentIndex < 0) return;

    const nextField = focusableFields[currentIndex + 1];
    if (nextField) {
      nextField.focus();
      nextField.select?.();
      return;
    }

    formElement.requestSubmit();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Customer name is required.");
      nameInputRef.current?.focus();
      return;
    }

    if (!form.mobile.trim()) {
      setError("Contact number is required.");
      customerFormRef.current?.querySelector<HTMLInputElement>("#mobile")?.focus();
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const editing = Boolean(editingCustomer);
      const url = editing
        ? `/api/customers/${editingCustomer!.id}`
        : "/api/customers";
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  name: form.name.trim(),
  iqamaNo: "",
  mobile: form.mobile.trim(),
  whatsapp: form.whatsapp.trim(),
  nationality: form.nationality.trim(),
  notes: form.notes.trim(),
}),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to save customer.");
      }

      setModalOpen(false);
      setForm(EMPTY_FORM);
      setMessage(editing ? "Customer updated successfully." : "Customer created successfully.");
      await loadCustomers();
    } catch (err) {
      console.error("Save customer error:", err);
      setError(err instanceof Error ? err.message : "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(customer: Customer) {
    try {
      setUpdatingId(customer.id);
      setError("");
      setMessage("");

      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !customer.isActive }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success || !data.customer) {
        throw new Error(data.message ?? "Unable to update customer status.");
      }

      setCustomers((current) =>
        current.map((item) => (item.id === customer.id ? data.customer! : item))
      );
      setMessage(`Customer ${customer.isActive ? "deactivated" : "activated"} successfully.`);
    } catch (err) {
      console.error("Update customer status error:", err);
      setError(err instanceof Error ? err.message : "Unable to update customer status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && customer.isActive) ||
        (statusFilter === "INACTIVE" && !customer.isActive);

      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        customer.customerCode,
        customer.name,
        customer.mobile,
        customer.whatsapp,
        customer.nationality,
        customer.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [customers, search, statusFilter]);

  const totalPages = Math.max(
  1,
  Math.ceil(filteredCustomers.length / PAGE_SIZE)
);

const safeCurrentPage = Math.min(currentPage, totalPages);

const paginatedCustomers = useMemo(() => {
  const start = (safeCurrentPage - 1) * PAGE_SIZE;
  return filteredCustomers.slice(start, start + PAGE_SIZE);
}, [filteredCustomers, safeCurrentPage]);

const firstItem =
  filteredCustomers.length === 0
    ? 0
    : (safeCurrentPage - 1) * PAGE_SIZE + 1;

const lastItem = Math.min(
  safeCurrentPage * PAGE_SIZE,
  filteredCustomers.length
);

  function goToPage(page: number) {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }

  function getPaginationPages() {
    const pages: number[] = [];
    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page++) pages.push(page);
      return pages;
    }

    pages.push(1);
    if (currentPage > 4) pages.push(-1);
    for (
      let page = Math.max(2, currentPage - 1);
      page <= Math.min(totalPages - 1, currentPage + 1);
      page++
    ) {
      pages.push(page);
    }
    if (currentPage < totalPages - 3) pages.push(-2);
    pages.push(totalPages);
    return pages;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-60 animate-pulse rounded-lg bg-[#E4E7EC]" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-[#E4E7EC]" />
          <div className="mt-8 h-[500px] animate-pulse rounded-2xl border border-[#E4E7EC] bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main ref={pageRef} className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="customer-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Sales</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1F2933]">Customers</h1>
            <p className="mt-2 text-sm text-[#667085]">
              Manage customer details used for quotations and invoices.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0A4F44]"
          >
            + Add Customer
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}
        {error && !modalOpen && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => void loadCustomers()} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold">
              Try Again
            </button>
          </div>
        )}

        <section className="customer-card mt-6 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="border-b border-[#E4E7EC] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1F2933]">Customer List</h2>
                <p className="mt-1 text-xs text-[#667085]">
                  {filteredCustomers.length} customer{filteredCustomers.length === 1 ? "" : "s"} found
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <div className="w-full sm:w-80">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
  setSearch(event.target.value);
  setCurrentPage(1);
}}
                    placeholder="Search name, contact, WhatsApp..."
                    className="w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>
                <div className="w-full sm:w-40">
                  <select
                    value={statusFilter}
                    onChange={(event) => {
  setStatusFilter(event.target.value as StatusFilter);
  setCurrentPage(1);
}}
                    className="w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-medium text-[#344054] outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-left">
                  <th className="px-5 py-3 font-semibold text-[#667085]">Customer Name</th>
                  <th className="px-5 py-3 font-semibold text-[#667085]">Contact</th>
                  <th className="px-5 py-3 font-semibold text-[#667085]">WhatsApp</th>
                  <th className="px-5 py-3 font-semibold text-[#667085]">Nationality</th>
                  <th className="px-5 py-3 font-semibold text-[#667085]">Status</th>
                  <th className="px-5 py-3 text-right font-semibold text-[#667085]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <p className="text-sm font-semibold text-[#1F2933]">No customers found</p>
                        <p className="mt-1 text-xs text-[#98A2B3]">
                          Try changing the search or status filter, or add a new customer.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-[#F0F2F4] last:border-b-0 hover:bg-[#FAFAF8]">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#1F2933]">{customer.name}</div>
                        <div className="mt-1 text-[11px] text-[#98A2B3]">{customer.customerCode}</div>
                      </td>
                      <td className="px-5 py-4 text-[#667085]">{customer.mobile}</td>
                      <td className="px-5 py-4 text-[#667085]">{customer.whatsapp || "—"}</td>
                      <td className="px-5 py-4 text-[#667085]">{customer.nationality || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${customer.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {customer.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(customer)}
                            className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#344054] transition hover:bg-[#F9FAFB]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleStatus(customer)}
                            disabled={updatingId === customer.id}
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${customer.isActive ? "border border-red-200 bg-white text-red-600 hover:bg-red-50" : "bg-[#0F6B5B] text-white hover:bg-[#0A4F44]"}`}
                          >
                            {updatingId === customer.id ? "Updating..." : customer.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#667085]">
                Showing <span className="font-semibold text-[#344054]">{firstItem}</span>
                {" – "}<span className="font-semibold text-[#344054]">{lastItem}</span>
                {" of "}<span className="font-semibold text-[#344054]">{filteredCustomers.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                {getPaginationPages().map((page, index) =>
                  page < 0 ? (
                    <span key={`ellipsis-${page}-${index}`} className="px-2 text-sm text-[#98A2B3]">…</span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => goToPage(page)}
                      aria-current={currentPage === page ? "page" : undefined}
                      className={`min-w-9 rounded-lg px-3 py-2 text-xs font-bold transition ${currentPage === page ? "bg-[#0F6B5B] text-white" : "border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"}`}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E4E7EC] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                  {editingCustomer ? "Edit" : "New"}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">
                  {editingCustomer ? "Edit Customer" : "Add Customer"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close customer form"
                className="rounded-lg px-3 py-2 text-xl text-[#667085] transition hover:bg-[#F7F8F6]"
              >
                ×
              </button>
            </div>

            <form ref={customerFormRef} onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="customerName" className="block text-sm font-semibold text-[#1F2933]">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    id="customerName"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    onKeyDown={handleEnterToNextField}
                    data-enter-next="true"
                    autoComplete="off"
                    placeholder="Enter customer name"
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div>
                  <label htmlFor="mobile" className="block text-sm font-semibold text-[#1F2933]">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="mobile"
                    type="tel"
                    value={form.mobile}
                    onChange={(event) => updateField("mobile", event.target.value)}
                    onKeyDown={handleEnterToNextField}
                    data-enter-next="true"
                    autoComplete="off"
                    placeholder="Enter contact number"
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div>
                  <label htmlFor="whatsapp" className="block text-sm font-semibold text-[#1F2933]">WhatsApp Number</label>
                  <input
                    id="whatsapp"
                    type="tel"
                    value={form.whatsapp}
                    onChange={(event) => updateField("whatsapp", event.target.value)}
                    onKeyDown={handleEnterToNextField}
                    data-enter-next="true"
                    autoComplete="off"
                    placeholder="Enter WhatsApp number"
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div>
                  <label htmlFor="nationality" className="block text-sm font-semibold text-[#1F2933]">Nationality</label>
                  <input
                    id="nationality"
                    value={form.nationality}
                    onChange={(event) => updateField("nationality", event.target.value)}
                    onKeyDown={handleEnterToNextField}
                    data-enter-next="true"
                    autoComplete="off"
                    placeholder="Enter nationality"
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-semibold text-[#1F2933]">Notes</label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    onKeyDown={handleEnterToNextField}
                    data-enter-next="true"
                    placeholder="Additional notes about this customer"
                    className="mt-2 w-full resize-y rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                  <p className="mt-1 text-[11px] text-[#98A2B3]">Press Enter to save. Use Shift + Enter for a new line.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#D0D5DD] bg-white px-5 py-3 text-sm font-bold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingCustomer ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
