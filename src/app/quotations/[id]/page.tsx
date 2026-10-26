
"use client";


import CompanyDocumentHeader, {
  QuotationBusinessFooter,
} from "@/components/documents/CompanyDocumentHeader";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QuotationBankTermsFooter from "@/components/quotations/QuotationBankTermsFooter";
import HotelConfirmationManager from "@/components/quotations/HotelConfirmationManager";

type QuotationItem = {
  id: number;
  serviceType: string;
  description: string;
  amount: string | number;
  quantity: string | number;
  discount: string | number;
  totalAmount: string | number;
  numberOfDays?: number | null;
  adultPrice?: string | number | null;
  adultQuantity?: number | null;
  childPrice?: string | number | null;
  childQuantity?: number | null;
  infantPrice?: string | number | null;
  infantQuantity?: number | null;
};

type BankDetailSnapshot = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string | null;
  swiftCode?: string | null;
  branchName?: string | null;
};

type TermsConditionSnapshot = {
  serviceType: string;
  serviceLabel: string;
  title: string;
  content: string;
};

type Quotation = {
  id: number;
  currency?: "SAR" | "LKR" | "USD" | null;
  quotationNo: string;
  quotationDate: string;
  validUntil: string | null;
  customerId?: number;
  customerName: string;
  customerMobile: string;
customerWhatsapp: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  totalAmount: string;
  subtotal: string;
  discount: string;
  status: string;
  items: QuotationItem[];
  bankDetailsSnapshot: BankDetailSnapshot[] | null;
  termsConditionsSnapshot: TermsConditionSnapshot[] | null;
};

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

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function QuotationPreviewPage() {
  const params = useParams<{ id: string }>();
  const quotationId = String(params.id);
  const router = useRouter();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("1");
  const [ticketQuantityDraft, setTicketQuantityDraft] = useState({ adult: "0", child: "0", infant: "0" });
  const [savingQuantity, setSavingQuantity] = useState(false);
  const [quantityError, setQuantityError] = useState("");

  const loadQuotation = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to load quotation.");
      }

      setQuotation(data.quotation);

      setCompany(data.company);
      setError("");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Unable to load quotation."
      );
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuotation();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadQuotation]);

  async function createInvoice() {
    if (!quotation) return;

    try {
      setInvoiceLoading(true);
      setInvoiceError("");

      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quotationId: quotation.id,
        }),
      });

      const text = await response.text();

      let data: {
        success?: boolean;
        message?: string;
        invoice?: {
          id?: number;
          invoiceNo?: string;
        };
      } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Invoice API returned an invalid response (HTTP ${response.status}).`
        );
      }

      if (response.ok && data.success && data.invoice?.id) {
        router.push(`/invoices/${data.invoice.id}`);
        return;
      }

      if (response.status === 409 && data.invoice?.id) {
        router.push(`/invoices/${data.invoice.id}`);
        return;
      }

      throw new Error(
        data.message ||
          `Unable to create invoice (HTTP ${response.status}).`
      );
    } catch (err) {
      console.error("Create invoice error:", err);

      setInvoiceError(
        err instanceof Error ? err.message : "Unable to create invoice."
      );
    } finally {
      setInvoiceLoading(false);
    }
  }

  function startQuantityEdit(item: QuotationItem) {
    setEditingItemId(item.id);
    setQuantityDraft(String(item.quantity ?? 1));
    setTicketQuantityDraft({
      adult: String(item.adultQuantity ?? 0),
      child: String(item.childQuantity ?? 0),
      infant: String(item.infantQuantity ?? 0),
    });
    setQuantityError("");
  }

  async function saveQuantityEdit() {
    if (!quotation || editingItemId === null) return;
    const item = quotation.items.find((row) => row.id === editingItemId);
    if (!item) return;

    const payload = item.serviceType === "AIR_TICKET"
      ? {
          adultQuantity: Number(ticketQuantityDraft.adult),
          childQuantity: Number(ticketQuantityDraft.child),
          infantQuantity: Number(ticketQuantityDraft.infant),
        }
      : { quantity: Number(quantityDraft) };

    try {
      setSavingQuantity(true);
      setQuantityError("");
      const response = await fetch(`/api/quotations/${quotation.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let data: { success?: boolean; message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Quantity API returned an invalid response (HTTP ${response.status}).`);
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Unable to update quantity (HTTP ${response.status}).`);
      }
      setEditingItemId(null);
      await loadQuotation();
    } catch (err) {
      console.error("Update service quantity error:", err);
      setQuantityError(err instanceof Error ? err.message : "Unable to update service quantity.");
    } finally {
      setSavingQuantity(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-8">
        <div className="mx-auto max-w-4xl">
          <div className="h-[700px] animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  if (error || !quotation) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">
            {error || "Quotation not found."}
          </p>

          <button
            type="button"
            onClick={() => router.push("/quotations/new")}
            className="mt-5 rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white"
          >
            Create New Quotation
          </button>
        </div>
      </main>
    );
  }
return (
    <>
      <style jsx global>{`
  @page {
    size: A4 portrait;
    margin: 0;
  }

  /* Quotation-only footer: contacts left/right, thank-you centred */
  .quotation-company-footer {
    color: #262626;
    background-color: #FAF7F0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .quotation-footer-layout {
    display: grid !important;
    grid-template-columns:
      minmax(0, 1fr) auto minmax(0, 1fr) !important;
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

  @media print {
    html,
    body {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    main {
      width: 100% !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 8mm !important;
      background: white !important;
    }

    .print-header,
    .print-footer,
    .print-page-header,
    .print-page-footer {
      display: none !important;
    }

    .quotation-terms-section {
      padding-top: 8mm !important;
    }

    .print-hidden {
      display: none !important;
    }

    .quotation-page {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      overflow: visible !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
    }

    .quotation-page header {
      padding: 0 0 4mm !important;
    }

    .quotation-page section {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    .quotation-page section > div {
      max-width: 100% !important;
    }

    .quotation-page table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }

    .quotation-page th,
    .quotation-page td {
      padding: 8px 5px !important;
      vertical-align: top !important;
      overflow-wrap: anywhere;
    }

    .quotation-page th:nth-child(1),
    .quotation-page td:nth-child(1) {
      width: 36% !important;
    }

    .quotation-page th:nth-child(2),
    .quotation-page td:nth-child(2) {
      width: 8% !important;
    }

    .quotation-page th:nth-child(3),
    .quotation-page td:nth-child(3) {
      width: 19% !important;
    }

    .quotation-page th:nth-child(4),
    .quotation-page td:nth-child(4) {
      width: 18% !important;
    }

    .quotation-page th:nth-child(5),
    .quotation-page td:nth-child(5) {
      width: 19% !important;
    }

    .quotation-page th:nth-child(n + 2),
    .quotation-page td:nth-child(n + 2) {
      font-size: 9pt !important;
    }

    .quotation-page td:nth-child(2),
    .quotation-page td:nth-child(3),
    .quotation-page td:nth-child(4),
    .quotation-page td:nth-child(5) {
      white-space: nowrap !important;
      overflow-wrap: normal !important;
    }

    .quotation-page .mt-8 {
      margin-top: 5mm !important;
    }

    .quotation-page .p-6,
    .quotation-page .sm\\:p-8 {
      padding: 5mm 0 !important;
    }

    .quotation-page footer {
      padding: 4mm 0 !important;
    }

    /* Keep the 3-column company footer compact and aligned in PDF */
    .quotation-page .quotation-company-footer {
      padding: 3mm 4mm !important;
      background-color: #FAF7F0 !important;
      color: #262626 !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .quotation-page .quotation-footer-layout {
      display: grid !important;
      grid-template-columns:
        minmax(0, 1fr) auto minmax(0, 1fr) !important;
      align-items: center !important;
      gap: 4mm !important;
    }

    .quotation-page .quotation-footer-layout > div:nth-child(2) {
      text-align: center !important;
    }

    .quotation-page .quotation-company-footer p {
      font-size: 7.5pt !important;
      line-height: 1.25 !important;
      overflow-wrap: anywhere !important;
    }

    .quotation-page img:not(.company-document-logo) {
      max-height: 16mm !important;
      max-width: 34mm !important;
      object-fit: contain !important;
    }

    .quotation-page .company-document-logo {
      max-height: 25mm !important;
      max-width: 78mm !important;
      object-fit: contain !important;
      object-position: left center !important;
    }

    /* Let the quotation flow naturally across pages. */
    .quotation-page * {
      break-inside: auto;
    }

    /* Keep bank account cards together when possible. */
    .quotation-bank-terms > div:first-child {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .quotation-bank-terms .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 3mm !important;
    }

    .quotation-bank-terms .grid > div {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    /* Terms and conditions */
    .quotation-bank-terms > div:nth-child(2) {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      margin-top: 4mm !important;
    }

    .quotation-bank-terms > div:nth-child(2) > h2 {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .quotation-bank-terms > div:nth-child(2) > div > div {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .quotation-bank-terms {
      color: #1f2933 !important;
      margin-top: 4mm !important;
      padding-top: 3mm !important;
    }

    .quotation-bank-terms h2 {
      font-size: 10pt !important;
    }

    .quotation-bank-terms h3 {
      font-size: 8pt !important;
    }

    .quotation-bank-terms p {
      font-size: 7.5pt !important;
      line-height: 1.25 !important;
    }

    .quotation-bank-terms .rounded-lg {
      border-radius: 2px !important;
    }

    .quotation-page .mt-6 {
      margin-top: 3mm !important;
    }
  }

  /* Premium black and antique-gold quotation theme */
  .quotation-page {
    --quotation-black: #1b1b1b;
    --quotation-gold: #b99343;
    --quotation-gold-dark: #92702c;
    --quotation-gold-pale: #faf7f0;

    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
    color: #222222;
    font-kerning: normal;
    text-rendering: optimizeLegibility;

    box-shadow:
      0 18px 45px rgba(24, 24, 24, 0.07),
      0 2px 10px rgba(185, 147, 67, 0.10) !important;
  }

  .quotation-page,
  .quotation-page * {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .quotation-page > header {
    border-bottom: 3px solid #262626 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .quotation-page .quotation-items-table thead,
  .quotation-page .quotation-items-table thead tr {
    background-color: var(--quotation-black) !important;
    color: #ffffff !important;
    border-bottom: 1px solid #262626 !important;
  }

  .quotation-page .quotation-items-table thead th {
    background-color: transparent !important;
    color: #ffffff !important;
  }

  .quotation-page [class~="text-[#0F6B5B]"],
  .quotation-page [class~="text-[#0A4F44]"] {
    color: #1b1b1b !important;
  }

  .quotation-page [class~="border-[#0F6B5B]"] {
    border-color: var(--quotation-gold) !important;
  }

  .quotation-page [class~="bg-[#0F6B5B]"],
  .quotation-page [class~="bg-[#0A4F44]"] {
    background-color: var(--quotation-black) !important;
    color: #ffffff !important;
  }

  .quotation-page [class~="bg-[#0F6B5B]/10"] {
    background-color: var(--quotation-gold-pale) !important;
  }

  .quotation-page [class~="bg-[#F7F8F6]"],
  .quotation-page [class~="bg-[#FAFAF8]"] {
    background-color: var(--quotation-gold-pale) !important;
  }

  .quotation-page .quotation-items-table tbody tr {
    border-color: #e9e0cf !important;
  }

  .quotation-page .quotation-items-table tbody tr:hover {
    background-color: var(--quotation-gold-pale) !important;
  }

  @media print {
    .quotation-page {
      box-shadow: none !important;
    }

    .quotation-page > header {
      border-bottom: 3px solid #262626 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .quotation-page .quotation-items-table thead,
    .quotation-page .quotation-items-table thead tr {
      background-color: var(--quotation-black) !important;
      color: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .quotation-page .quotation-items-table thead th {
      color: #ffffff !important;
    }
  }
`}</style>

      <main className="min-h-screen bg-[#F7F8F6] p-4 sm:p-8">
        <div className="print-hidden mx-auto mb-5 flex max-w-4xl justify-end gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white"
          >
            Print / Save PDF
          </button>
        </div>

        {invoiceError && (
          <div className="print-hidden mx-auto mb-5 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {invoiceError}
          </div>
        )}

        <article className="quotation-page mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-xl">
          {/* HEADER */}
          <CompanyDocumentHeader company={company} quotationStyle>
<p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                  Quotation
                </p>

                <p className="mt-2 text-2xl font-black text-[#0F6B5B]">
                  {quotation.quotationNo}
                </p>

                <p className="mt-2 text-xs text-[#667085]">
                  Date:{" "}
                  {new Date(quotation.quotationDate).toLocaleDateString(
                    "en-GB"
                  )}
                </p>

                {quotation.validUntil && (
                  <p className="mt-1 text-xs font-semibold text-[#344054]">
                    Valid Until:{" "}
                    {new Date(
                      `${String(quotation.validUntil).slice(0, 10)}T00:00:00`
                    ).toLocaleDateString("en-GB")}
                  </p>
                )}
          </CompanyDocumentHeader>

          {/* CUSTOMER AND QUOTATION ITEMS */}
          <section className="p-3 sm:p-4">
  <div className="quotation-customer-card rounded-xl border border-[#E4E7EC] bg-[#FAF7F0] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C9A227]">
                Customer
              </p>

              <h2 className="mt-2 text-base font-bold leading-tight text-[#1F2933]">
                {quotation.customerName}
              </h2>

              <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs leading-tight text-[#667085] sm:grid-cols-2">

                <p>
                  <span className="font-semibold text-[#344054]">
                    Contact Number:
                  </span>{" "}
                  {quotation.customerMobile || "—"}
                </p>
              </div>
            </div>

            {/* ITEMS */}
            <div className="mt-5 overflow-hidden rounded-xl border border-[#D8D8D8]">
              <table className="w-full text-sm quotation-items-table">
                <thead className="bg-[#0F6B5B] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold">
                      Service
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {quotation.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#F0F2F4] last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#1F2933]">
                          {item.description}
                        </p>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#0F6B5B]">
                          {item.serviceType === "RAWDHA"
                            ? "Rawdha"
                            : item.serviceType.replaceAll("_", " ")}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-center text-[#667085]">
                        <div className="flex flex-col items-center gap-1">
                          <span>
                            {item.serviceType === "AIR_TICKET"
                              ? `${Number(item.adultQuantity ?? 0) + Number(item.childQuantity ?? 0) + Number(item.infantQuantity ?? 0)} passenger(s)`
                              : Number(item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => startQuantityEdit(item)}
                            className="print-hidden rounded-lg border border-[#D0D5DD] px-2 py-1 text-[10px] font-bold text-[#0F6B5B] hover:border-[#0F6B5B]"
                          >
                            Edit quantity
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right text-[#667085]">
                        {quotation.currency ?? "SAR"} {money(item.amount)}
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-[#1F2933]">
                        {quotation.currency ?? "SAR"} {money(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTALS */}
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between text-sm text-[#667085]">
                  <span>Subtotal</span>
                  <span>{quotation.currency ?? "SAR"} {money(quotation.subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm text-[#667085]">
                  <span>Discount</span>
                  <span>{quotation.currency ?? "SAR"} {money(quotation.discount)}</span>
                </div>

                <div className="border-t-2 border-[#0F6B5B] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-[#1F2933]">
                      Grand Total
                    </span>

                    <span className="text-2xl font-black text-[#0F6B5B]">
                      {quotation.currency ?? "SAR"} {money(quotation.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* HOTEL CONFIRMATIONS — NOT PRINTED */}
          <HotelConfirmationManager
            quotationId={quotation.id}
            items={quotation.items
              .filter((item) => item.serviceType === "HOTEL_ACCOMMODATION")
              .map((item) => ({ id: item.id, description: item.description }))}
          />

          {/* BILLING ACTION — NOT PRINTED */}
          <section className="print-hidden mx-6 mb-6 rounded-2xl border border-[#E4E7EC] bg-[#F7F8F6] p-5 sm:mx-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C9A227]">
                  Billing
                </p>

                <h3 className="mt-1 text-base font-black text-[#1F2933]">
                  Ready to create the customer invoice?
                </h3>

                <p className="mt-1 text-xs leading-5 text-[#667085]">
                  Payments and installments are recorded against the invoice,
                  not against this quotation.
                </p>
              </div>

              <button
                type="button"
                onClick={createInvoice}
                disabled={invoiceLoading}
                className="shrink-0 rounded-xl bg-[#0A4F44] px-5 py-3 text-xs font-bold text-white hover:bg-[#0F6B5B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {invoiceLoading
                  ? "Opening Invoice..."
                  : "Create / Open Invoice →"}
              </button>
            </div>
          </section>

          {/* BANK DETAILS AND TERMS — ONLY RENDER WHEN THERE IS CONTENT */}
          {((quotation.bankDetailsSnapshot?.length ?? 0) > 0 ||
            (quotation.termsConditionsSnapshot?.length ?? 0) > 0) && (
            <QuotationBankTermsFooter
              bankDetails={quotation.bankDetailsSnapshot}
              termsConditions={quotation.termsConditionsSnapshot}
            />
          )}

          {/* COMPANY FOOTER */}
          {/* COMPANY FOOTER */}
<QuotationBusinessFooter company={company} />
        </article>

        {editingItemId !== null && quotation.items.some((item) => item.id === editingItemId) && (() => {
          const item = quotation.items.find((row) => row.id === editingItemId)!;
          return (
            <div className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A227]">Update service</p>
                    <h2 className="mt-1 text-xl font-black text-[#1F2933]">Edit quantity</h2>
                    <p className="mt-1 text-sm text-[#667085]">{item.serviceType === "RAWDHA" ? "Rawdha" : item.serviceType.replaceAll("_", " ")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditingItemId(null); setQuantityError(""); }}
                    disabled={savingQuantity}
                    aria-label="Close quantity editor"
                    className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-sm text-[#475467] disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={(event) => { event.preventDefault(); void saveQuantityEdit(); }} className="mt-5 space-y-4">
                  {item.serviceType === "AIR_TICKET" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {(["adult", "child", "infant"] as const).map((kind) => (
                        <label key={kind} className="block text-xs font-bold text-[#344054]">
                          {kind[0].toUpperCase() + kind.slice(1)} passengers
                          <input
                            type="number"
                            min="0"
                            max="999999"
                            step="1"
                            required
                            value={ticketQuantityDraft[kind]}
                            onChange={(event) => setTicketQuantityDraft((current) => ({ ...current, [kind]: event.target.value }))}
                            className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="block text-xs font-bold text-[#344054]">
                      {item.serviceType === "HOTEL_ACCOMMODATION" ? "Room quantity" : "Quantity"}
                      <input
                        type="number"
                        min="0.01"
                        max="99999999.99"
                        step="0.01"
                        required
                        value={quantityDraft}
                        onChange={(event) => setQuantityDraft(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>
                  )}

                  <p className="rounded-xl bg-[#F7F8F6] p-3 text-xs leading-5 text-[#667085]">
                    The service total and quotation total will be recalculated. If an invoice exists, its total and outstanding balance will also be recalculated. Existing payment records will not be deleted or changed.
                  </p>
                  {quantityError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{quantityError}</p>}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setEditingItemId(null); setQuantityError(""); }}
                      disabled={savingQuantity}
                      className="rounded-xl border border-[#D0D5DD] px-4 py-2.5 text-xs font-bold text-[#344054] disabled:opacity-50"
                    >Cancel</button>
                    <button
                      type="submit"
                      disabled={savingQuantity}
                      className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >{savingQuantity ? "Saving…" : "Save quantity"}</button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}
      </main>
    </>
  );
}
