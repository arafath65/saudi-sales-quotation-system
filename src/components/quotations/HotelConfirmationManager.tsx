"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type HotelService = {
  id: number;
  description: string;
};

type ConfirmationSummary = {
  id: number;
  quotationItemId?: number;
  receiptNo: string;
  hotelConfirmationNumber: string;
  status: "TENTATIVE" | "DEFINITE";
  checkIn: string;
  checkOut: string;
  hotelName: string;
  roomType: string;
  numberOfDays: number | null;
};

type Props = {
  quotationId: number;
  items: HotelService[];
};

function dateLabel(value: string) {
  if (!value) return "—";
  const datePart = String(value).slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.getTime()) ? datePart : date.toLocaleDateString("en-GB");
}

export default function HotelConfirmationManager({ quotationId, items }: Props) {
  const router = useRouter();
  const [confirmations, setConfirmations] = useState<ConfirmationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConfirmations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/quotations/${quotationId}/hotel-confirmations`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load hotel confirmations.");
      }

      setConfirmations(Array.isArray(data.hotelConfirmations) ? data.hotelConfirmations : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load hotel confirmations.");
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void loadConfirmations();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadConfirmations]);

  if (items.length === 0) return null;

  function getExistingConfirmation(item: HotelService) {
    const byItemId = confirmations.find((row) => row.quotationItemId === item.id);
    if (byItemId) return byItemId;

    // Compatibility fallback for older API responses that do not yet return quotationItemId.
    const parts = item.description.split(" · ").map((part) => part.trim());
    return confirmations.find((row) =>
      row.hotelName === parts[0] && row.roomType === parts[1],
    );
  }

  return (
    <section className="print-hidden mx-6 mb-6 rounded-2xl border border-[#D8E8E3] bg-[#F5FAF8] p-5 sm:mx-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C9A227]">
            Hotel Operations
          </p>
          <h3 className="mt-1 text-base font-black text-[#1F2933]">Hotel confirmations</h3>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Create a separate hotel receipt for each hotel service. Existing confirmations can be reopened to update their status or booking details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadConfirmations()}
          disabled={loading}
          className="self-start rounded-lg border border-[#B7D3CB] bg-white px-3 py-2 text-xs font-bold text-[#0F6B5B] disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const existing = getExistingConfirmation(item);
          return (
            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1F2933]">{item.description || "Hotel accommodation"}</p>
                <p className="mt-1 text-[11px] text-[#667085]">Service ID: {item.id}</p>
                {existing && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#0F6B5B]">{existing.receiptNo}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${existing.status === "DEFINITE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {existing.status === "DEFINITE" ? "DEFINITE CONFIRMATION" : "TENTATIVE CONFIRMATION"}
                    </span>
                    <span className="text-[#667085]">{dateLabel(existing.checkIn)} – {dateLabel(existing.checkOut)}</span>
                  </div>
                )}
              </div>
              {existing ? (
                <button
                  type="button"
                  onClick={() => router.push(`/hotel-confirmations/${existing.id}`)}
                  className="shrink-0 rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
                >
                  Open confirmation →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(`/quotations/${quotationId}/hotel-confirmations/${item.id}/new`)}
                  className="shrink-0 rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
                >
                  Create confirmation →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
