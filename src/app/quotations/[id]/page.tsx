
"use client";

import { useEffect, useState } from "react";
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

  return `/api/company-settings/logo/${encodeURIComponent(
    path
  )}`;
}

export default function QuotationPreviewPage() {
  const params = useParams();
  const router = useRouter();

  const [quotation, setQuotation] =
    useState<Quotation | null>(null);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuotation();
  }, []);

  async function loadQuotation() {
    try {
      const response = await fetch(
        `/api/quotations/${params.id}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            "Unable to load quotation."
        );
      }

      setQuotation(data.quotation);
      setCompany(data.company);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load quotation."
      );
    } finally {
      setLoading(false);
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
            onClick={() =>
              router.push("/quotations/new")
            }
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
        @media print {
          body {
            background: white !important;
          }

          .print-hidden {
            display: none !important;
          }

          .quotation-page {
            box-shadow: none !important;
            border: none !important;
            max-width: none !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-[#F7F8F6] p-4 sm:p-8">
        <div className="print-hidden mx-auto mb-5 flex max-w-4xl justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              router.push("/quotations/new")
            }
            className="rounded-xl border border-[#D0D5DD] bg-white px-5 py-3 text-sm font-bold text-[#344054]"
          >
            New Quotation
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-[#0F6B5B] px-5 py-3 text-sm font-bold text-white"
          >
            Print / Save PDF
          </button>
        </div>

        <article className="quotation-page mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-xl">
          {/* HEADER */}
          <header className="border-b-4 border-[#0F6B5B] p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  {logo1 && (
                    <img
                      src={logo1}
                      alt="Logo 1"
                      className="h-16 max-w-[140px] object-contain"
                    />
                  )}

                  {logo2 && (
                    <img
                      src={logo2}
                      alt="Logo 2"
                      className="h-16 max-w-[140px] object-contain"
                    />
                  )}

                  {logo3 && (
                    <img
                      src={logo3}
                      alt="Logo 3"
                      className="h-16 max-w-[140px] object-contain"
                    />
                  )}
                </div>

                <h1 className="mt-5 text-2xl font-black text-[#1F2933]">
                  {company?.companyName ||
                    "Company Name"}
                </h1>

                {company?.address && (
                  <p className="mt-2 max-w-md whitespace-pre-line text-xs leading-5 text-[#667085]">
                    {company.address}
                  </p>
                )}

                <div className="mt-2 space-y-1 text-xs text-[#667085]">
                  {company?.phone && (
                    <p>{company.phone}</p>
                  )}

                  {company?.email && (
                    <p>{company.email}</p>
                  )}

                  {company?.website && (
                    <p>{company.website}</p>
                  )}
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
                  ).toLocaleDateString()}
                </p>
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

              <div className="mt-2 grid gap-1 text-xs text-[#667085] sm:grid-cols-2">
                <p>
                  Mobile:{" "}
                  {quotation.customerMobile}
                </p>

                {quotation.customerWhatsapp && (
                  <p>
                    WhatsApp:{" "}
                    {quotation.customerWhatsapp}
                  </p>
                )}

                {quotation.customerEmail && (
                  <p>
                    Email:{" "}
                    {quotation.customerEmail}
                  </p>
                )}

                {quotation.customerAddress && (
                  <p className="whitespace-pre-line sm:col-span-2">
                    Address:{" "}
                    {quotation.customerAddress}
                  </p>
                )}
              </div>
            </div>

            {/* ITEMS */}
            <div className="mt-8 overflow-hidden rounded-xl border border-[#E4E7EC]">
              <table className="w-full text-sm">
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
                      Discount
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
                          {item.serviceType
                            .replaceAll("_", " ")}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-center text-[#667085]">
                        {Number(item.quantity)}
                      </td>

                      <td className="px-4 py-4 text-right text-[#667085]">
                        SAR{" "}
                        {Number(
                          item.amount
                        ).toFixed(2)}
                      </td>

                      <td className="px-4 py-4 text-right text-[#667085]">
                        SAR{" "}
                        {Number(
                          item.discount
                        ).toFixed(2)}
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-[#1F2933]">
                        SAR{" "}
                        {Number(
                          item.totalAmount
                        ).toFixed(2)}
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

                  <span>
                    SAR{" "}
                    {Number(
                      quotation.subtotal
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-sm text-[#667085]">
                  <span>Discount</span>

                  <span>
                    SAR{" "}
                    {Number(
                      quotation.discount
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="border-t-2 border-[#0F6B5B] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-[#1F2933]">
                      Grand Total
                    </span>

                    <span className="text-2xl font-black text-[#0F6B5B]">
                      SAR{" "}
                      {Number(
                        quotation.totalAmount
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
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