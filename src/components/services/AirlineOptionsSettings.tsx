"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Airline = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
const PAGE_SIZE = 8;

export default function AirlineOptionsSettings() {
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Airline | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAirlines = useCallback(async () => {
    try {
      const response = await fetch("/api/airlines", {
        cache: "no-store",
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        airlines?: Airline[];
      };

      if (
        !response.ok ||
        data.success !== true ||
        !Array.isArray(data.airlines)
      ) {
        throw new Error(data.message ?? "Unable to load airlines.");
      }

      setAirlines(data.airlines);
      setError("");
    } catch (err) {
      console.error("Airline load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load airlines."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAirlines();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAirlines]);

  const filteredAirlines = useMemo(() => {
    const query = search.trim().toLowerCase();

    return airlines.filter((airline) => {
      const statusMatches =
        status === "ALL" ||
        (status === "ACTIVE" && airline.isActive) ||
        (status === "INACTIVE" && !airline.isActive);

      return (
        statusMatches &&
        (!query || airline.name.toLowerCase().includes(query))
      );
    });
  }, [airlines, search, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAirlines.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const displayedAirlines = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredAirlines.slice(start, start + PAGE_SIZE);
  }, [filteredAirlines, currentPage]);

  function openAdd() {
    setEditing(null);
    setName("");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEdit(airline: Airline) {
    setEditing(airline);
    setName(airline.name);
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    setName("");
    setError("");
  }

  async function saveAirline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Airline name is required.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Airline name cannot exceed 100 characters.");
      return;
    }

    const wasEditing = Boolean(editing);

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        editing ? `/api/airlines/${editing.id}` : "/api/airlines",
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to save airline.");
      }

      setModalOpen(false);
      setEditing(null);
      setName("");
      setPage(1);

      setMessage(
        wasEditing
          ? "Airline updated successfully."
          : "Airline added successfully."
      );

      await loadAirlines();
    } catch (err) {
      console.error("Airline save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save airline."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(airline: Airline) {
    try {
      setUpdatingId(airline.id);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/airlines/${airline.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !airline.isActive,
          }),
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to update airline status."
        );
      }

      setAirlines((current) =>
        current.map((item) =>
          item.id === airline.id
            ? { ...item, isActive: !airline.isActive }
            : item
        )
      );

      setMessage(
        `${airline.name} ${
          airline.isActive ? "deactivated" : "activated"
        } successfully.`
      );
    } catch (err) {
      console.error("Airline status error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update airline status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function pagination() {
    const pages: number[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) pages.push(-1);

      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }

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
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-xs text-[#98A2B3]"
            >
              …
            </span>
          ) : (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                pageNumber === currentPage
                  ? "bg-[#0F6B5B] text-white"
                  : "border border-[#D0D5DD] text-[#344054]"
              }`}
            >
              {pageNumber}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() =>
            setPage(Math.min(totalPages, currentPage + 1))
          }
          disabled={currentPage === totalPages}
          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#E4E7EC] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
            Air Ticket Service
          </p>

          <h2 className="mt-1 text-xl font-bold text-[#1F2933]">
            Airlines
          </h2>

          <p className="mt-1 text-sm text-[#667085]">
            Manage the airline names available in air-ticket quotations.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white hover:bg-[#0B594B]"
        >
          + Add Airline
        </button>
      </div>

      <div className="space-y-4 p-6">
        {(error || message) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search airlines..."
            className="w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#667085]">
            Loading airlines...
          </div>
        ) : displayedAirlines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D0D5DD] px-6 py-12 text-center">
            <h3 className="text-sm font-bold text-[#1F2933]">
              No airlines found
            </h3>

            <p className="mt-1 text-sm text-[#667085]">
              Add an airline to make it available in air-ticket quotations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E4E7EC]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3 font-bold">Airline Name</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E4E7EC]">
                {displayedAirlines.map((airline) => (
                  <tr key={airline.id}>
                    <td className="px-4 py-4 font-semibold text-[#1F2933]">
                      {airline.name}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          airline.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {airline.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(airline)}
                          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold text-[#344054]"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleStatus(airline)}
                          disabled={updatingId === airline.id}
                          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50"
                        >
                          {updatingId === airline.id
                            ? "Saving..."
                            : airline.isActive
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredAirlines.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#E4E7EC] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#667085]">
              Showing{" "}
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                currentPage * PAGE_SIZE,
                filteredAirlines.length
              )}{" "}
              of {filteredAirlines.length}
            </p>

            {pagination()}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101828]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                  Air Ticket Service
                </p>

                <h3 className="mt-1 text-xl font-bold text-[#1F2933]">
                  {editing ? "Edit Airline" : "Add Airline"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
                className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveAirline} className="p-6">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <label
                htmlFor="airline-name"
                className="text-sm font-semibold text-[#1F2933]"
              >
                Airline Name *
              </label>

              <input
                id="airline-name"
                type="text"
                required
                maxLength={100}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. SriLankan Airlines"
                className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
              />

              <p className="mt-2 text-xs text-[#98A2B3]">
                Inactive airlines stay on saved quotations but cannot be
                selected for new tickets.
              </p>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-bold text-[#344054] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Update Airline"
                      : "Save Airline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}