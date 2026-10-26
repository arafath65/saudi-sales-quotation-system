"use client";


import CompanyDocumentHeader, {
  QuotationBusinessFooter,
} from "@/components/documents/CompanyDocumentHeader";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

type Company = {
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  logo1Path: string | null;
  logo2Path: string | null;
  logo3Path: string | null;
};

type TermsSnapshot = {
  templateId?: number;
  serviceType?: string;
  title: string;
  content: string;
};

type TermsOption = {
  id: number;
  serviceType: string;
  title: string;
  content: string;
  isActive: boolean;
};

type HotelConfirmation = {
  id: number;
  receiptNo: string;
  hotelConfirmationNumber: string;
  status: "TENTATIVE" | "DEFINITE";
  checkIn: string;
  checkOut: string;
  customerName: string;
  customerMobile: string;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  customerPassportNo: string | null;
  hotelName: string;
  roomType: string;
  numberOfDays: number | null;
  roomQuantity: string | number;
  paxCount: number | null;
  acType: string | null;
  boardType: string | null;
  currency: string;
  amount: string | number;
  discount: string | number;
  totalAmount: string | number;
  termsConditionsSnapshot: unknown;
  notes: string | null;
  quotationId: number;
  quotationItemId: number;
  createdAt: string;
  updatedAt: string;
  quotation?: {
    id: number;
    quotationNo: string;
    quotationDate?: string;
    currency: string;
  };
  quotationItem?: {
    id: number;
    description: string;
    serviceType: string;
  };
  createdBy?: { id: number; name: string };
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : "0.00";
}

function dateInput(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "";
}

function dateLabel(value: string | null | undefined) {
  const part = dateInput(value);
  if (!part) return "—";
  const parsed = new Date(`${part}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? part : parsed.toLocaleDateString("en-GB");
}

function detailLabel(value: string | null | undefined) {
  if (!value) return "—";
  if (value === "AC") return "Air-conditioned";
  if (value === "NON_AC") return "Non-air-conditioned";
  if (value === "ROOM_ONLY") return "Room Only";
  if (value === "BED_BREAKFAST") return "Bed & Breakfast";
  return value.replaceAll("_", " ");
}

function parseTermsSnapshot(value: unknown): TermsSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is TermsSnapshot =>
    Boolean(row && typeof row === "object" && typeof (row as TermsSnapshot).title === "string" && typeof (row as TermsSnapshot).content === "string"),
  );
}

export default function HotelConfirmationReceiptPage() {
  const params = useParams<{ id: string }>();
  const confirmationId = String(params.id);
  const router = useRouter();

  const [confirmation, setConfirmation] = useState<HotelConfirmation | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [termsOptions, setTermsOptions] = useState<TermsOption[]>([]);
  const [selectedTermsIds, setSelectedTermsIds] = useState<number[]>([]);
  const [termsDirty, setTermsDirty] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<"TENTATIVE" | "DEFINITE">("TENTATIVE");
  const [checkInDraft, setCheckInDraft] = useState("");
  const [checkOutDraft, setCheckOutDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const savedTerms = useMemo(
    () => parseTermsSnapshot(confirmation?.termsConditionsSnapshot),
    [confirmation?.termsConditionsSnapshot],
  );

  const loadConfirmation = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/hotel-confirmations/${confirmationId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success || !data.hotelConfirmation) {
        throw new Error(data.message || "Unable to load hotel confirmation.");
      }

      const loaded = data.hotelConfirmation as HotelConfirmation;
      setConfirmation(loaded);
      setNumberDraft(loaded.hotelConfirmationNumber || "");
      setStatusDraft(loaded.status);
      setCheckInDraft(dateInput(loaded.checkIn));
      setCheckOutDraft(dateInput(loaded.checkOut));
      setNotesDraft(loaded.notes || "");
      setTermsDirty(false);

      const [optionsResponse, quotationResponse] = await Promise.all([
        fetch("/api/quotation-options", { cache: "no-store" }),
        fetch(`/api/quotations/${loaded.quotationId}`, { cache: "no-store" }),
      ]);
      const [optionsJson, quotationJson] = await Promise.all([
        optionsResponse.json(),
        quotationResponse.json(),
      ]);
      const activeHotelTerms: TermsOption[] =
        optionsResponse.ok && optionsJson.success && Array.isArray(optionsJson.termsConditions)
          ? optionsJson.termsConditions.filter((row: TermsOption) => row.isActive && row.serviceType === "HOTEL_ACCOMMODATION")
          : [];
      setTermsOptions(activeHotelTerms);

      const snapshot = parseTermsSnapshot(loaded.termsConditionsSnapshot);
      const snapshotIds = snapshot
        .map((row) => Number(row.templateId))
        .filter((id) => Number.isInteger(id) && id > 0 && activeHotelTerms.some((term) => term.id === id));
      setSelectedTermsIds(Array.from(new Set(snapshotIds)));

      if (quotationResponse.ok && quotationJson.success) {
        setCompany(quotationJson.company ?? null);
      } else {
        setCompany(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load hotel confirmation.");
    } finally {
      setLoading(false);
    }
  }, [confirmationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConfirmation(), 0);
    return () => window.clearTimeout(timer);
  }, [loadConfirmation]);

  function toggleTerms(id: number, checked: boolean) {
    setTermsDirty(true);
    setSelectedTermsIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id),
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation) return;

    if (!numberDraft.trim()) {
      setError("The hotel's confirmation number is required.");
      return;
    }
    if (!checkInDraft || !checkOutDraft || checkOutDraft <= checkInDraft) {
      setError("Check-out date must be later than check-in date.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload: Record<string, unknown> = {
        hotelConfirmationNumber: numberDraft.trim(),
        status: statusDraft,
        checkIn: checkInDraft,
        checkOut: checkOutDraft,
        notes: notesDraft.trim(),
      };
      if (termsDirty) payload.termsConditionIds = selectedTermsIds;

      const response = await fetch(`/api/hotel-confirmations/${confirmation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.hotelConfirmation) {
        throw new Error(data.message || `Unable to update confirmation (HTTP ${response.status}).`);
      }

      setConfirmation(data.hotelConfirmation as HotelConfirmation);
      setTermsDirty(false);
      setMessage(data.message || "Hotel confirmation updated successfully.");
      await loadConfirmation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update hotel confirmation.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#F7F8F6] p-6"><div className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-white p-10 text-sm text-[#667085]">Loading confirmation receipt…</div></main>;
  }

  if (!confirmation) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6">
          <p className="text-sm text-red-700">{error || "Hotel confirmation not found."}</p>
          <button type="button" onClick={() => router.back()} className="mt-4 rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-sm font-bold text-white">Go back</button>
        </div>
      </main>
    );
  }
  const statusLabel = confirmation.status === "DEFINITE" ? "Definite Confirmation" : "Tentative Confirmation";

  return (
    <>
      <style jsx global>{`

        /* Consistent black, antique-gold and warm-cream document styling. */
        .hotel-receipt {
          --document-black: #1b1b1b;
          --document-gold: #b99343;
          --document-cream: #faf7f0;
          color: #222 !important;
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
          box-shadow: 0 18px 45px rgba(24, 24, 24, 0.07),
            0 2px 10px rgba(185, 147, 67, 0.1) !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .hotel-receipt > header {
          border-bottom: 3px solid #262626 !important;
        }

        /* Match the quotation/invoice masthead on the actual page as well as in print:
           compact logo on the left, confirmation metadata on the right. */
        .hotel-receipt .company-document-header {
          display: block !important;
          box-sizing: border-box !important;
          width: 100% !important;
          padding: 10px 20px !important;
          border-bottom: 3px solid #262626 !important;
          border-bottom-color: #262626 !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .hotel-receipt .company-document-header > div {
          display: grid !important;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr) !important;
          grid-template-rows: auto !important;
          grid-auto-flow: row !important;
          align-items: center !important;
          gap: 4mm !important;
          width: 100% !important;
          min-height: 0 !important;
        }

        .hotel-receipt .company-document-header > div > div:first-child {
          grid-column: 1 !important;
          grid-row: 1 !important;
          display: flex !important;
          justify-content: flex-start !important;
          align-items: center !important;
          min-width: 0 !important;
          min-height: 92px !important;
        }

        .hotel-receipt .company-document-header > div > div:last-child {
          grid-column: 2 !important;
          grid-row: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: flex-end !important;
          min-width: 0 !important;
          min-height: 92px !important;
          text-align: right !important;
        }

        .hotel-receipt .company-document-header .company-document-logo {
          display: block !important;
          width: auto !important;
          max-width: 78mm !important;
          max-height: 25mm !important;
          object-fit: contain !important;
          object-position: left center !important;
        }

        .hotel-receipt .company-document-header p,
        .hotel-receipt .company-document-header h2,
        .hotel-receipt .company-document-header span {
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        .hotel-receipt .company-document-header h2 {
          font-size: 26px !important;
          line-height: 1.15 !important;
        }

        .hotel-receipt .company-document-header > div > div:last-child > div:first-child {
          width: 100% !important;
          min-width: 0 !important;
          text-align: right !important;
        }

        /* quotationStyle leaves the company address/contact details in the footer only. */

        .hotel-receipt [class~="bg-[#0F6B5B]"] {
          background-color: #1b1b1b !important;
          color: #fff !important;
        }

        .hotel-receipt [class~="text-[#0F6B5B]"] {
          color: #1b1b1b !important;
        }

        .hotel-receipt [class~="border-[#0F6B5B]"] {
          border-color: #b99343 !important;
        }

        .hotel-receipt [class~="bg-[#FAFAF8]"],
        .hotel-receipt [class~="bg-[#F7F8F6]"] {
          background-color: #faf7f0 !important;
        }

        .quotation-company-footer {
          color: #262626 !important;
          background-color: #faf7f0 !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .quotation-footer-layout {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 3mm !important;
        }

        .quotation-footer-layout > div:first-child,
        .quotation-footer-layout > div:last-child {
          min-width: 0 !important;
        }

        .quotation-footer-layout > div:nth-child(2) {
          min-width: max-content;
          text-align: center !important;
        }

        .quotation-company-footer p {
          overflow-wrap: anywhere;
        }

        .hotel-receipt .rounded-xl {
          border-radius: 12px !important;
        }

        .hotel-receipt .hotel-confirmation-reference {
          border-color: #e9e0cf !important;
          background: #faf7f0 !important;
          color: #262626 !important;
        }

        .hotel-receipt .hotel-confirmation-reference {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @media screen and (max-width: 640px) {
          .hotel-receipt .company-document-header {
            padding: 12px 14px !important;
          }

          .hotel-receipt .company-document-header > div {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 10px !important;
          }

          .hotel-receipt .company-document-header > div > div:first-child,
          .hotel-receipt .company-document-header > div > div:last-child {
            min-height: 76px !important;
          }

          .hotel-receipt .company-document-logo {
            max-width: 100% !important;
            max-height: 70px !important;
          }

          .hotel-receipt .company-document-header h2 {
            font-size: 21px !important;
          }
        }

        /* Hotel confirmation print settings retained; the screen style above mirrors the quotation. */
        @page { size: A5 portrait; margin: 5mm; }

        @media print {
          html,
          body {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body { font-size: 8pt !important; }
          .print-hidden { display: none !important; }

          .hotel-receipt-print-shell {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .hotel-receipt {
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: #1F2933 !important;
            font-size: 8pt !important;
          }

          /* Compact, two-column masthead: don't let the header consume a page. */
          .hotel-receipt > header {
            padding: 3mm !important;
            border-bottom-width: 1mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .hotel-receipt > header > div {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 3mm !important;
          }

          .hotel-receipt > header > div > div:first-child {
            flex: 1 1 52% !important;
            min-width: 0 !important;
          }

          .hotel-receipt > header > div > div:last-child {
            flex: 1 1 48% !important;
            min-width: 0 !important;
            text-align: right !important;
          }

          /* Only the first configured company logo belongs on customer PDFs. */
          .hotel-receipt > header img:not(.company-document-logo) {
            display: none !important;
          }

          .hotel-receipt > header .company-document-logo {
  max-width: 68mm !important;
  max-height: 32mm !important;
  object-fit: contain !important;
}

          .hotel-receipt > header h1 {
            margin-top: 1.5mm !important;
            font-size: 11pt !important;
            line-height: 1.15 !important;
          }

          .hotel-receipt > header h2 {
            margin-top: 1mm !important;
            font-size: 12pt !important;
            line-height: 1.15 !important;
          }

          .hotel-receipt > header p,
          .hotel-receipt > header .space-y-1 {
            margin-top: 1mm !important;
            font-size: 6.5pt !important;
            line-height: 1.25 !important;
          }

          .hotel-receipt > header span {
            margin-top: 1.5mm !important;
            padding: 1mm 2mm !important;
            font-size: 6pt !important;
          }

          /* CRITICAL: the whole content section must flow after the header.
             Avoiding a break on this parent was pushing ALL content to page 2. */
          .hotel-receipt > section {
            display: block !important;
            padding: 3mm !important;
            margin: 0 !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .hotel-receipt > section > div,
          .hotel-receipt > section > section {
            margin-top: 2.5mm !important;
          }

          .hotel-receipt > section > div:first-child {
            margin-top: 0 !important;
          }

          .hotel-receipt .rounded-xl {
            border-radius: 2mm !important;
          }

          .hotel-receipt > section > div:first-child {
            padding: 2.5mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .hotel-receipt > section > div:first-child h3 {
            margin-top: 1mm !important;
            font-size: 10pt !important;
            line-height: 1.2 !important;
          }

          .hotel-receipt > section > div:first-child > div {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 1.5mm 3mm !important;
            margin-top: 1.5mm !important;
          }

          .hotel-receipt > section > div:first-child > div p {
            font-size: 7pt !important;
            line-height: 1.25 !important;
            overflow-wrap: anywhere !important;
          }

          /* Hotel details table: two narrow columns with less padding. */
          .hotel-receipt > section > div:nth-child(2) {
            break-inside: auto !important;
            page-break-inside: auto !important;
            overflow: visible !important;
          }

          .hotel-receipt > section > div:nth-child(2) > div:first-child {
            padding: 2mm 2.5mm !important;
            font-size: 7pt !important;
          }

          .hotel-receipt > section > div:nth-child(2) > div:nth-child(2) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.3mm !important;
          }

          .hotel-receipt > section > div:nth-child(2) > div:nth-child(2) > div {
            padding: 1.8mm 2.2mm !important;
            min-width: 0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .hotel-receipt > section > div:nth-child(2) p {
            line-height: 1.2 !important;
          }

          .hotel-receipt > section > div:nth-child(2) p:first-child {
            font-size: 6.2pt !important;
          }

          .hotel-receipt > section > div:nth-child(2) p:last-child {
            margin-top: 0.8mm !important;
            font-size: 8pt !important;
          }

          /* Booking amount and terms are compact, but may flow if genuinely long. */
          .hotel-receipt > section > div:nth-child(3),
          .hotel-receipt > section > section {
            padding: 2.5mm !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .hotel-receipt > section > div:nth-child(3) h3,
          .hotel-receipt > section > section h3 {
            font-size: 8pt !important;
          }

          .hotel-receipt > section > div:nth-child(3) > div {
            margin-top: 1.5mm !important;
            gap: 1mm !important;
            font-size: 7.5pt !important;
          }

          .hotel-receipt > section > div:nth-child(3) > div > div:last-child {
            padding-top: 1.5mm !important;
          }

          .hotel-receipt > section > section > div {
            margin-top: 1.5mm !important;
            gap: 2mm !important;
          }

          .hotel-receipt > section > section p {
            font-size: 7pt !important;
            line-height: 1.3 !important;
          }

          .hotel-receipt > footer {
            padding: 2.5mm 3mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .hotel-receipt > footer p:first-child {
            font-size: 7pt !important;
            line-height: 1.25 !important;
          }

          .hotel-receipt > footer p:last-child {
            margin-top: 1mm !important;
            font-size: 6pt !important;
            line-height: 1.2 !important;
          }

          .hotel-receipt > header {
            border-bottom: 1mm solid #262626 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .hotel-receipt .quotation-company-footer {
            display: block !important;
            padding: 2.5mm 3mm !important;
            margin-top: 2mm !important;
            background-color: #faf7f0 !important;
            color: #262626 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .hotel-receipt .quotation-footer-layout {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 2mm !important;
          }

          .hotel-receipt .quotation-footer-layout > div:nth-child(2) {
            text-align: center !important;
          }

          .hotel-receipt .quotation-company-footer p {
            font-size: 5.8pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .hotel-receipt .company-document-logo {
            max-width: 68mm !important;
            max-height: 32mm !important;
            object-fit: contain !important;
            object-position: left center !important;
          }

          .hotel-confirmation-reference {
            padding: 1.5mm 2mm !important;
            background: #faf7f0 !important;
            color: #262626 !important;
          }

          .hotel-receipt .hotel-confirmation-reference p {
            font-size: 5.8pt !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>

      <main className="hotel-receipt-print-shell min-h-screen bg-[#F7F8F6] p-4 sm:p-8">
        <div className="print-hidden mx-auto mb-5 flex max-w-4xl flex-wrap justify-end gap-3">
          <button type="button" onClick={() => router.push(`/quotations/${confirmation.quotationId}`)} className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-bold text-[#344054]">Open quotation</button>
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#0F6B5B] px-5 py-2.5 text-sm font-bold text-white">Print / Save PDF</button>
        </div>

        <article className="hotel-receipt mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-xl">
          <CompanyDocumentHeader company={company} quotationStyle>
<p className="text-xs font-black uppercase tracking-[0.18em] text-[#C9A227]">Temporary Hotel Booking</p>
                <h2 className="mt-1 text-2xl font-black text-[#0F6B5B]">Confirmation</h2>
                <p className="mt-2 text-sm font-black text-[#1F2933]">{confirmation.receiptNo}</p>
                <p className="mt-1 text-xs text-[#667085]">Quotation: {confirmation.quotation?.quotationNo || `#${confirmation.quotationId}`}</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${confirmation.status === "DEFINITE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{statusLabel}</span>
          </CompanyDocumentHeader>

          <section className="p-6 sm:p-8">
            <div className="rounded-xl border border-[#E4E7EC] bg-[#FAFAF8] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C9A227]">Guest / Customer Details</p>
              <h3 className="mt-2 text-lg font-black text-[#1F2933]">{confirmation.customerName}</h3>
              <div className="mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-2">
                <p><span className="font-bold text-[#344054]">Mobile: </span>{confirmation.customerMobile || "—"}</p>
                <p><span className="font-bold text-[#344054]">WhatsApp: </span>{confirmation.customerWhatsapp || "—"}</p>
                <p><span className="font-bold text-[#344054]">Email: </span>{confirmation.customerEmail || "—"}</p>
                <p><span className="font-bold text-[#344054]">Passport: </span>{confirmation.customerPassportNo || "—"}</p>
                {confirmation.customerAddress && <p className="sm:col-span-2"><span className="font-bold text-[#344054]">Address: </span>{confirmation.customerAddress}</p>}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-[#E4E7EC]">
              <div className="bg-[#0F6B5B] px-5 py-3 text-xs font-black uppercase tracking-wider text-white">Hotel Accommodation Details</div>
              <div className="grid gap-px bg-[#EAECF0] sm:grid-cols-2">
                {[
                  ["Hotel Name", confirmation.hotelName],
                  ["Hotel Confirmation Number", confirmation.hotelConfirmationNumber],
                  ["Room Type", confirmation.roomType],
                  ["Room Quantity", String(Number(confirmation.roomQuantity))],
                  ["Number of Days", confirmation.numberOfDays ? String(confirmation.numberOfDays) : "—"],
                  ["Guests / Passengers", confirmation.paxCount ? String(confirmation.paxCount) : "—"],
                  ["AC Type", detailLabel(confirmation.acType)],
                  ["Board / Meal Plan", detailLabel(confirmation.boardType)],
                  ["Check-in Date", dateLabel(confirmation.checkIn)],
                  ["Check-out Date", dateLabel(confirmation.checkOut)],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">{label}</p>
                    <p className="mt-1 break-words text-sm font-bold text-[#1F2933]">{value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#E4E7EC] p-5">
              <h3 className="text-sm font-black text-[#1F2933]">Booking Amount</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3 text-[#667085]"><span>Rate / Amount</span><span>{confirmation.currency} {money(confirmation.amount)}</span></div>
                <div className="flex justify-between gap-3 text-[#667085]"><span>Discount</span><span>{confirmation.currency} {money(confirmation.discount)}</span></div>
                <div className="flex justify-between gap-3 border-t-2 border-[#0F6B5B] pt-3 font-black text-[#0F6B5B]"><span>Total</span><span>{confirmation.currency} {money(confirmation.totalAmount)}</span></div>
              </div>
            </div>

            {savedTerms.length > 0 && (
              <section className="mt-6 rounded-xl border border-[#E4E7EC] p-5">
                <h3 className="text-sm font-black text-[#1F2933]">Hotel Terms & Conditions</h3>
                <div className="mt-3 space-y-4">
                  {savedTerms.map((term, index) => (
                    <div key={`${term.templateId ?? index}-${term.title}`}>
                      <h4 className="text-xs font-black text-[#344054]">{term.title}</h4>
                      <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#667085]">{term.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {confirmation.notes && (
              <section className="mt-6 rounded-xl bg-[#FAFAF8] p-5">
                <h3 className="text-xs font-black text-[#344054]">Notes</h3>
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#667085]">{confirmation.notes}</p>
              </section>
            )}
          </section>

          <footer className="hotel-confirmation-reference border-t border-[#E9E0CF] bg-[#FAF7F0] px-4 py-2 text-center">
            <p className="text-[10px] font-semibold text-[#262626]">
              Booking reference: {confirmation.hotelConfirmationNumber} · Quotation {confirmation.quotation?.quotationNo || confirmation.quotationId}.
            </p>
          </footer>
          <QuotationBusinessFooter company={company} />
        </article>

        <section className="print-hidden mx-auto mt-6 max-w-4xl rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C9A227]">Manage Booking</p>
            <h3 className="mt-1 text-base font-black text-[#1F2933]">Update confirmation</h3>
            <p className="mt-1 text-xs leading-5 text-[#667085]">Change Tentative to Definite after the hotel finalizes the booking. This updates the existing receipt number rather than creating another receipt.</p>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</div>}

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#344054]">Hotel Confirmation Number
                <input required value={numberDraft} onChange={(event) => setNumberDraft(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" />
              </label>
              <label className="block text-xs font-bold text-[#344054]">Confirmation Status
                <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as "TENTATIVE" | "DEFINITE")} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]">
                  <option value="TENTATIVE">Tentative Confirmation</option>
                  <option value="DEFINITE">Definite Confirmation</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-[#344054]">Check-in Date
                <input type="date" required value={checkInDraft} onChange={(event) => setCheckInDraft(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" />
              </label>
              <label className="block text-xs font-bold text-[#344054]">Check-out Date
                <input type="date" required min={checkInDraft || undefined} value={checkOutDraft} onChange={(event) => setCheckOutDraft(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" />
              </label>
            </div>

            {termsOptions.length > 0 && (
              <div className="rounded-xl border border-[#EAECF0] p-4">
                <h4 className="text-xs font-black text-[#344054]">Replace / update Terms & Conditions</h4>
                <p className="mt-1 text-[11px] leading-5 text-[#667085]">Only change these selections if you want to replace the saved wording on this receipt. Existing wording remains unchanged unless you change and save the selection.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {termsOptions.map((term) => (
                    <label key={term.id} className="flex gap-2 rounded-lg bg-[#FAFAF8] p-3 text-xs text-[#344054]">
                      <input type="checkbox" checked={selectedTermsIds.includes(term.id)} onChange={(event) => toggleTerms(term.id, event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0F6B5B]" />
                      <span><span className="font-bold">{term.title}</span><span className="mt-1 block whitespace-pre-line text-[#667085]">{term.content}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="block text-xs font-bold text-[#344054]">Notes
              <textarea rows={3} value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]" />
            </label>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
