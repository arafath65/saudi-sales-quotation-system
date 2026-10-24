"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type HotelOption = {
  id: number;
  name?: string;
  days?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type OptionField = "name" | "days";
type ResponseKey = "roomTypes" | "durations";

type OptionManagerProps = {
  title: string;
  description: string;
  endpoint: string;
  responseKey: ResponseKey;
  field: OptionField;
  itemLabel: string;
  addButtonLabel: string;
  placeholder: string;
  emptyTitle: string;
  emptyDescription: string;
  inputType: "text" | "number";
};

const PAGE_SIZE = 8;

function OptionManager({
  title,
  description,
  endpoint,
  responseKey,
  field,
  itemLabel,
  addButtonLabel,
  placeholder,
  emptyTitle,
  emptyDescription,
  inputType,
}: OptionManagerProps) {
  const [items, setItems] = useState<HotelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HotelOption | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadItems = useCallback(async () => {
    try {
      // Await the request before changing React state. This avoids
      // synchronous state updates inside the loading effect.
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok || data.success !== true) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : `Unable to load ${title.toLowerCase()}.`
        );
      }

      const result = data[responseKey];
      if (!Array.isArray(result)) {
        throw new Error(`Invalid response while loading ${title}.`);
      }

      setItems(result as HotelOption[]);
      setError("");
    } catch (err) {
      console.error(`${title} load error:`, err);
      setError(
        err instanceof Error
          ? err.message
          : `Unable to load ${title.toLowerCase()}.`
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, responseKey, title]);

  useEffect(() => {
    // Start the request after the effect's synchronous phase.
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const statusMatches =
        status === "ALL" ||
        (status === "ACTIVE" && item.isActive) ||
        (status === "INACTIVE" && !item.isActive);

      if (!statusMatches) return false;

      const searchableValue =
        field === "name" ? item.name ?? "" : String(item.days ?? "");

      return !query || searchableValue.toLowerCase().includes(query);
    });
  }, [items, search, status, field]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  // Clamp the current page as derived data; don't reset state inside an effect.
  const currentPage = Math.min(page, totalPages);

  const displayedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  function openAdd() {
    setEditing(null);
    setValue("");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEdit(item: HotelOption) {
    setEditing(item);
    setValue(field === "name" ? item.name ?? "" : String(item.days ?? ""));
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setValue("");
    setError("");
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      setError(field === "name" ? "Room type name is required." : "Number of days is required.");
      return;
    }

    let payload: { name?: string; days?: number };
    if (field === "name") {
      if (trimmedValue.length > 100) {
        setError("Name cannot exceed 100 characters.");
        return;
      }
      payload = { name: trimmedValue };
    } else {
      const days = Number(trimmedValue);
      if (!Number.isSafeInteger(days) || days <= 0) {
        setError("Number of days must be a positive whole number.");
        return;
      }
      payload = { days };
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        editing ? `${endpoint}/${editing.id}` : endpoint,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? `Unable to save ${itemLabel.toLowerCase()}.`);
      }

      setModalOpen(false);
      setEditing(null);
      setValue("");
      setPage(1);
      setMessage(editing ? `${itemLabel} updated successfully.` : `${itemLabel} added successfully.`);
      await loadItems();
    } catch (err) {
      console.error(`${itemLabel} save error:`, err);
      setError(err instanceof Error ? err.message : `Unable to save ${itemLabel.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: HotelOption) {
    try {
      setUpdatingId(item.id);
      setError("");
      setMessage("");

      const response = await fetch(`${endpoint}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? `Unable to update ${itemLabel.toLowerCase()} status.`);
      }

      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? { ...existing, isActive: !item.isActive }
            : existing
        )
      );
      setMessage(`${itemLabel} ${item.isActive ? "deactivated" : "activated"} successfully.`);
    } catch (err) {
      console.error(`${itemLabel} status error:`, err);
      setError(err instanceof Error ? err.message : `Unable to update ${itemLabel.toLowerCase()} status.`);
    } finally {
      setUpdatingId(null);
    }
  }

  function pagination() {
    const pages: number[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push(-1);
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) pages.push(i);
      if (currentPage < totalPages - 2) pages.push(-2);
      pages.push(totalPages);
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Previous
        </button>
        {pages.map((pageNumber, index) =>
          pageNumber < 0 ? (
            <span key={`${pageNumber}-${index}`} className="px-2 text-[#98A2B3]">…</span>
          ) : (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              aria-current={currentPage === pageNumber ? "page" : undefined}
              className={`min-w-9 rounded-lg px-3 py-2 text-xs font-bold ${
                currentPage === pageNumber
                  ? "bg-[#0F6B5B] text-white"
                  : "border border-[#D0D5DD] bg-white text-[#344054]"
              }`}
            >
              {pageNumber}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => setPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    );
  }

  function displayValue(item: HotelOption) {
    return field === "name"
      ? item.name ?? ""
      : `${item.days ?? 0} ${item.days === 1 ? "day" : "days"}`;
  }

  return (
    <>
      <section className="service-card overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
        <div className="border-b border-[#E4E7EC] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1F2933]">{title}</h2>
              <p className="mt-1 text-xs text-[#667085]">{description}</p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="shrink-0 rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
            >
              {addButtonLabel}
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${title.toLowerCase()}...`}
              aria-label={`Search ${title}`}
              className="min-w-0 flex-1 rounded-xl border border-[#D0D5DD] px-4 py-2.5 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
            />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              aria-label={`${title} status filter`}
              className="w-28 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#0F6B5B] sm:w-32"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {message && !modalOpen && (
          <div className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>
        )}
        {error && !modalOpen && (
          <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
        )}

        <div className="divide-y divide-[#F0F2F4]">
          {loading ? (
            <div className="px-5 py-14 text-center text-sm text-[#667085]">Loading {title.toLowerCase()}...</div>
          ) : displayedItems.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-semibold text-[#1F2933]">{emptyTitle}</p>
              <p className="mt-1 text-xs text-[#98A2B3]">{emptyDescription}</p>
            </div>
          ) : (
            displayedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#FAFAF8]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1F2933]">{displayValue(item)}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEdit(item)} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054]">Edit</button>
                  <button
                    type="button"
                    onClick={() => void toggleStatus(item)}
                    disabled={updatingId === item.id}
                    className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${item.isActive ? "border border-red-200 text-red-600" : "bg-[#0F6B5B] text-white"}`}
                  >
                    {updatingId === item.id ? "..." : item.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && filteredItems.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#667085]">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
            </p>
            {pagination()}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Hotel Settings</p>
                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">{editing ? `Edit ${itemLabel}` : `Add ${itemLabel}`}</h2>
              </div>
              <button type="button" onClick={closeModal} disabled={saving} aria-label="Close dialog" className="text-2xl text-[#667085] disabled:opacity-50">×</button>
            </div>

            <form onSubmit={saveItem} className="p-6">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <label htmlFor={`hotel-option-${field}`} className="text-sm font-semibold text-[#1F2933]">
                {field === "name" ? "Room Type Name" : "Number of Days"} *
              </label>
              <input
                id={`hotel-option-${field}`}
                type={inputType}
                min={inputType === "number" ? 1 : undefined}
                step={inputType === "number" ? 1 : undefined}
                maxLength={inputType === "text" ? 100 : undefined}
                required
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={placeholder}
                className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
              />
              {field === "days" && <p className="mt-2 text-xs text-[#98A2B3]">Enter a positive whole number. For example, 1, 2, 3 or 7.</p>}
              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button type="button" onClick={closeModal} disabled={saving} className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-bold text-[#344054] disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? "Saving..." : editing ? `Update ${itemLabel}` : `Save ${itemLabel}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function HotelOptionsSettings() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <OptionManager
        title="Hotel Room Types"
        description="Manage the room types available in hotel quotations."
        endpoint="/api/hotel-room-types"
        responseKey="roomTypes"
        field="name"
        itemLabel="Room Type"
        addButtonLabel="+ Add Room"
        placeholder="e.g. Single, Double, Triple"
        emptyTitle="No room types found"
        emptyDescription="Add a room type to use it in hotel quotations."
        inputType="text"
      />
      <OptionManager
        title="Hotel Stay Durations"
        description="Manage the selectable duration options for hotel stays."
        endpoint="/api/hotel-stay-durations"
        responseKey="durations"
        field="days"
        itemLabel="Stay Duration"
        addButtonLabel="+ Add Duration"
        placeholder="e.g. 3"
        emptyTitle="No stay durations found"
        emptyDescription="Add a duration to use it in hotel quotations."
        inputType="number"
      />
    </div>
  );
}
