"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type QuotationItem = {
  id: number;
  serviceType: string;
  description: string;
  amount: string;
  quantity: string;
  discount: string;
  totalAmount: string;
};

type Quotation = {
  id: number;
  quotationNo: string;
  quotationDate: string;
  validUntil: string | null;
  
  customerId?: number;
  customerName: string;
  customerMobile: string;
  customerIqamaNo?: string | null;
  customer?: {
    id?: number;
    iqamaNo?: string | null;
  } | null;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  totalAmount: string;
  subtotal: string;
  discount: string;
  status: string;
  items: QuotationItem[];
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

function logoUrl(path: string | null) {
  if (!path) return null;

  return `/api/company-settings/logo/${encodeURIComponent(path)}`;
}

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

  const loadQuotation = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to load quotation.");
      }

      let customerIqamaNo: string | null =
        data.quotation.customerIqamaNo ??
        data.quotation.customer?.iqamaNo ??
        null;

      const customerId =
        data.quotation.customerId ?? data.quotation.customer?.id;

      if (!customerIqamaNo && customerId) {
        try {
          const customerResponse = await fetch(
            `/api/customers/${customerId}`,
            { cache: "no-store" }
          );

          const customerData = await customerResponse.json();

          if (customerResponse.ok && customerData.success) {
            customerIqamaNo = customerData.customer?.iqamaNo ?? null;
          }
        } catch (customerError) {
          console.error("Unable to load customer Iqama:", customerError);
        }
      }

      setQuotation({
        ...data.quotation,
        customerIqamaNo,
      });

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

  const logo1 = logoUrl(company?.logo1Path ?? null);
  const logo2 = logoUrl(company?.logo2Path ?? null);
  const logo3 = logoUrl(company?.logo3Path ?? null);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
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
            padding: 5mm 0 6mm !important;
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

          .quotation-page img {
            max-height: 16mm !important;
            max-width: 34mm !important;
            object-fit: contain !important;
          }

          .quotation-page * {
            break-inside: avoid;
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
          <header className="border-b-4 border-[#0F6B5B] p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  {logo1 && (
                    <Image
                      src={logo1}
                      alt="Logo 1"
                      width={140}
                      height={64}
                      unoptimized
                      className="h-16 w-auto max-w-[140px] object-contain"
                    />
                  )}

                  {logo2 && (
                    <Image
                      src={logo2}
                      alt="Logo 2"
                      width={140}
                      height={64}
                      unoptimized
                      className="h-16 max-w-[140px] object-contain"
                    />
                  )}

                  {logo3 && (
                    <Image
                      src={logo3}
                      alt="Logo 3"
                      width={140}
                      height={64}
                      unoptimized
                      className="h-16 max-w-[140px] object-contain"
                    />
                  )}
                </div>

                <h1 className="mt-5 text-2xl font-black text-[#1F2933]">
                  {company?.companyName || "Company Name"}
                </h1>

                {company?.address && (
                  <p className="mt-2 max-w-md whitespace-pre-line text-xs leading-5 text-[#667085]">
                    {company.address}
                  </p>
                )}

                <div className="mt-2 space-y-1 text-xs text-[#667085]">
                  {company?.phone && <p>{company.phone}</p>}
                  {company?.email && <p>{company.email}</p>}
                  {company?.website && <p>{company.website}</p>}
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                  Quotation
                </p>

                <p className="mt-2 text-2xl font-black text-[#0F6B5B]">
                  {quotation.quotationNo}
                </p>

                <p className="mt-2 text-xs text-[#667085]">
  Date:{" "}
  {new Date(
    quotation.quotationDate
  ).toLocaleDateString("en-GB")}
</p>

{quotation.validUntil && (
  <p className="mt-1 text-xs font-semibold text-[#344054]">
    Valid Until:{" "}
    {new Date(
      `${String(quotation.validUntil).slice(0, 10)}T00:00:00`
    ).toLocaleDateString("en-GB")}
  </p>
)}
              </div>
            </div>
          </header>

          {/* CUSTOMER */}
          <section className="p-6 sm:p-8">
            <div className="rounded-xl border border-[#E4E7EC] bg-[#FAFAF8] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C9A227]">
                Customer
              </p>

              <h2 className="mt-2 text-lg font-bold text-[#1F2933]">
                {quotation.customerName}
              </h2>

              <div className="mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-[#344054]">
                    Iqama Number:
                  </span>{" "}
                  {quotation.customerIqamaNo || "—"}
                </p>

                <p>
                  <span className="font-semibold text-[#344054]">
                    Contact Number:
                  </span>{" "}
                  {quotation.customerMobile || "—"}
                </p>
              </div>
            </div>

            {/* ITEMS */}
            <div className="mt-8 overflow-hidden rounded-xl border border-[#E4E7EC]">
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
                          {item.serviceType.replaceAll("_", " ")}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-center text-[#667085]">
                        {Number(item.quantity)}
                      </td>

                      <td className="px-4 py-4 text-right text-[#667085]">
                        SAR {money(item.amount)}
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-[#1F2933]">
                        SAR {money(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTAL */}
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between text-sm text-[#667085]">
                  <span>Subtotal</span>
                  <span>SAR {money(quotation.subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm text-[#667085]">
                  <span>Discount</span>
                  <span>SAR {money(quotation.discount)}</span>
                </div>

                <div className="border-t-2 border-[#0F6B5B] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-[#1F2933]">
                      Grand Total
                    </span>

                    <span className="text-2xl font-black text-[#0F6B5B]">
                      SAR {money(quotation.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

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

          <footer className="border-t border-[#E4E7EC] bg-[#FAFAF8] px-6 py-5 text-center sm:px-8">
            <p className="text-xs text-[#667085]">
              Thank you for your business.
            </p>

            {company?.taxNumber && (
              <p className="mt-1 text-[10px] text-[#98A2B3]">
                Tax / VAT No: {company.taxNumber}
              </p>
            )}
          </footer>
        </article>
      </main>
    </>
  );
}