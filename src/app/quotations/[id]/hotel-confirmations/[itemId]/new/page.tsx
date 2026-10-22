"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

type HotelItem = {
  id: number;
  serviceType: string;
  description: string;
  hotelName?: string | null;
  roomType?: string | null;
  numberOfDays?: number | null;
  quantity?: string | number;
  paxCount?: number | null;
  acType?: string | null;
  boardType?: string | null;
  amount?: string | number;
  discount?: string | number;
  totalAmount?: string | number;
};

type QuotationData = {
  id: number;
  quotationNo: string;
  currency?: string | null;
  customerName: string;
  customerMobile: string;
  customerWhatsapp?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerPassportNo?: string | null;
  items: HotelItem[];
};

type TermsOption = {
  id: number;
  serviceType: string;
  title: string;
  content: string;
  isActive: boolean;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : "0.00";
}

function detailLabel(value: string | null | undefined) {
  if (!value) return "—";
  if (value === "AC") return "Air-conditioned";
  if (value === "NON_AC") return "Non-air-conditioned";
  if (value === "ROOM_ONLY") return "Room Only";
  if (value === "BED_BREAKFAST") return "Bed & Breakfast";
  return value.replaceAll("_", " ");
}

export default function NewHotelConfirmationPage() {
  const params = useParams<{ id: string; itemId: string }>();
  const quotationId = String(params.id);
  const itemId = Number(params.itemId);
  const router = useRouter();

  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [termsOptions, setTermsOptions] = useState<TermsOption[]>([]);
  const [selectedTermsIds, setSelectedTermsIds] = useState<number[]>([]);
  const [hotelConfirmationNumber, setHotelConfirmationNumber] = useState("");
  const [status, setStatus] = useState<"TENTATIVE" | "DEFINITE">("TENTATIVE");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hotelItem = useMemo(
    () => quotation?.items.find((item) => item.id === itemId && item.serviceType === "HOTEL_ACCOMMODATION") ?? null,
    [quotation, itemId],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new Error("Invalid hotel service selected.");
      }

      const [quotationResponse, optionsResponse] = await Promise.all([
        fetch(`/api/quotations/${quotationId}`, { cache: "no-store" }),
        fetch("/api/quotation-options", { cache: "no-store" }),
      ]);
      const [quotationJson, optionsJson] = await Promise.all([
        quotationResponse.json(),
        optionsResponse.json(),
      ]);

      if (!quotationResponse.ok || !quotationJson.success || !quotationJson.quotation) {
        throw new Error(quotationJson.message || "Unable to load quotation.");
      }
      if (!optionsResponse.ok || !optionsJson.success) {
        throw new Error(optionsJson.message || "Unable to load Terms & Conditions templates.");
      }

      const loadedQuotation = quotationJson.quotation as QuotationData;
      const selectedItem = loadedQuotation.items?.find(
        (item) => item.id === itemId && item.serviceType === "HOTEL_ACCOMMODATION",
      );
      if (!selectedItem) {
        throw new Error("This quotation does not contain the selected hotel service.");
      }

      setQuotation(loadedQuotation);
      setTermsOptions(
        (Array.isArray(optionsJson.termsConditions) ? optionsJson.termsConditions : []).filter(
          (row: TermsOption) => row.isActive && row.serviceType === "HOTEL_ACCOMMODATION",
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load hotel confirmation form.");
    } finally {
      setLoading(false);
    }
  }, [quotationId, itemId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  function toggleTerms(id: number, checked: boolean) {
    setSelectedTermsIds((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quotation || !hotelItem) return;

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError("Check-out date must be later than check-in date.");
      return;
    }
    if (!hotelConfirmationNumber.trim()) {
      setError("Enter the hotel's confirmation number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/quotations/${quotation.id}/hotel-confirmations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationItemId: hotelItem.id,
          hotelConfirmationNumber: hotelConfirmationNumber.trim(),
          status,
          checkIn,
          checkOut,
          termsConditionIds: selectedTermsIds,
          notes: notes.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.hotelConfirmation?.id) {
        throw new Error(data.message || `Unable to create confirmation (HTTP ${response.status}).`);
      }

      router.push(`/hotel-confirmations/${data.hotelConfirmation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create hotel confirmation.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#F7F8F6] p-6"><div className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-white p-10 text-sm text-[#667085]">Loading hotel service…</div></main>;
  }

  if (!quotation || !hotelItem) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6">
          <p className="text-sm text-red-700">{error || "Hotel service not found."}</p>
          <button type="button" onClick={() => router.back()} className="mt-4 rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-sm font-bold text-white">Go back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#C9A227]">Hotel Operations</p>
            <h1 className="mt-1 text-2xl font-black text-[#1F2933]">New Hotel Confirmation</h1>
            <p className="mt-1 text-sm text-[#667085]">Quotation {quotation.quotationNo} · details are prefilled from the selected hotel service.</p>
          </div>
          <button type="button" onClick={() => router.push(`/quotations/${quotation.id}`)} className="self-start rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-bold text-[#344054]">Back to quotation</button>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-black text-[#1F2933]">Customer Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["Customer", quotation.customerName],
                ["Mobile", quotation.customerMobile],
                ["WhatsApp", quotation.customerWhatsapp],
                ["Email", quotation.customerEmail],
                ["Passport Number", quotation.customerPassportNo],
                ["Address", quotation.customerAddress],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#FAFAF8] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-[#1F2933]">{value || "—"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-black text-[#1F2933]">Selected Hotel Service</h2>
              <span className="self-start rounded-full bg-[#E7F3EF] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0F6B5B]">{quotation.currency || "SAR"}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-[#1F2933]">{hotelItem.description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Hotel Name", hotelItem.hotelName],
                ["Room Type", hotelItem.roomType],
                ["Rooms", String(Number(hotelItem.quantity ?? 0))],
                ["Number of Days", hotelItem.numberOfDays ? String(hotelItem.numberOfDays) : "—"],
                ["AC Type", detailLabel(hotelItem.acType)],
                ["Board / Meal Plan", detailLabel(hotelItem.boardType)],
                ["Passengers / Guests", hotelItem.paxCount ? String(hotelItem.paxCount) : "—"],
                ["Rate", `${quotation.currency || "SAR"} ${money(hotelItem.amount)}`],
                ["Service Total", `${quotation.currency || "SAR"} ${money(hotelItem.totalAmount)}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#EAECF0] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-[#1F2933]">{value || "—"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-black text-[#1F2933]">Booking Confirmation</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#344054]">
                Hotel Confirmation Number <span className="text-red-600">*</span>
                <input required value={hotelConfirmationNumber} onChange={(event) => setHotelConfirmationNumber(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" placeholder="Enter hotel booking reference" />
              </label>
              <label className="block text-xs font-bold text-[#344054]">
                Confirmation Status <span className="text-red-600">*</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as "TENTATIVE" | "DEFINITE")} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]">
                  <option value="TENTATIVE">Tentative Confirmation</option>
                  <option value="DEFINITE">Definite Confirmation</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-[#344054]">
                Check-in Date <span className="text-red-600">*</span>
                <input type="date" required value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" />
              </label>
              <label className="block text-xs font-bold text-[#344054]">
                Check-out Date <span className="text-red-600">*</span>
                <input type="date" required min={checkIn || undefined} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" />
              </label>
            </div>
            <label className="mt-4 block text-xs font-bold text-[#344054]">
              Notes (optional)
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" placeholder="Additional booking notes" />
            </label>
          </section>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-black text-[#1F2933]">Hotel Terms & Conditions</h2>
            <p className="mt-1 text-xs leading-5 text-[#667085]">Select the terms that belong on this receipt. The chosen wording is saved with the confirmation, so later template edits will not alter this receipt.</p>
            {termsOptions.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[#FAFAF8] p-4 text-sm text-[#667085]">No active hotel terms templates were found. You can add them in Settings → Quotation Options.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {termsOptions.map((term) => (
                  <label key={term.id} className="flex cursor-pointer gap-3 rounded-xl border border-[#EAECF0] p-4 hover:border-[#B7D3CB]">
                    <input type="checkbox" checked={selectedTermsIds.includes(term.id)} onChange={(event) => toggleTerms(term.id, event.target.checked)} className="mt-1 h-4 w-4 accent-[#0F6B5B]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#1F2933]">{term.title}</span>
                      <span className="mt-1 block whitespace-pre-line text-xs leading-5 text-[#667085]">{term.content}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => router.push(`/quotations/${quotation.id}`)} disabled={saving} className="rounded-xl border border-[#D0D5DD] bg-white px-5 py-3 text-sm font-bold text-[#344054] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving confirmation…" : "Create Hotel Confirmation →"}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
