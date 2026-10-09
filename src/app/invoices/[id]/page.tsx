"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

type CompanySettings = {
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

type CustomerSnapshot = {
  id?: number;
  customerCode?: string;
  name: string;
  mobile: string;
  iqamaNo?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  nationality?: string | null;
  passportNo?: string | null;
};

type InvoiceItem = {
  id: number;
  serviceType: string;
  description: string;
  visaType?: string | null;
  hotelName?: string | null;
  paxCount?: number | null;
  acType?: string | null;
  boardType?: string | null;
  ticketType?: string | null;
  route?: { id: number; name: string } | null;
  vehicleType?: { id: number; name: string; seatCount: number | null } | null;
  amount: string | number;
  quantity: string | number;
  discount: string | number;
  totalAmount: string | number;
};

type Payment = {
  id: number;
  paymentDate: string;
  amount: string | number;
  method: string;
  referenceNo?: string | null;
  notes?: string | null;
  createdBy?: { id: number; name: string } | null;
};

type Invoice = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  customer: CustomerSnapshot;
  customerName?: string;
  customerMobile?: string;
  customerIqamaNo?: string | null;
  customerWhatsapp?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerNationality?: string | null;
  customerPassportNo?: string | null;
  subtotal: string | number;
  discount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceAmount: string | number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | string;
  notes?: string | null;
  items: InvoiceItem[];
  payments: Payment[];
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  invoice?: Invoice;
  company?: CompanySettings;
};

type PaymentMethod = "CASH" | "CARD" | "ONLINE_TRANSFER" | "CHEQUE" | "OTHER";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  ONLINE_TRANSFER: "Online Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

const SERVICE_LABELS: Record<string, string> = {
  UMRAH_VISA: "Umrah Visa",
  HOTEL_ACCOMMODATION: "Hotel Accommodation",
  AIR_TICKET: "Air Ticket",
  TRANSPORTATION: "Transportation",
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function logoUrl(path: string | null | undefined) {
  if (!path) return null;
  const filename = path.split(/[\\/]/).pop();
  return filename ? `/api/company-settings/logo/${encodeURIComponent(filename)}` : null;
}

function getServiceDescription(item: InvoiceItem) {
  const pieces: string[] = [];

  if (item.serviceType === "UMRAH_VISA") {
    pieces.push(
      item.visaType === "INDIVIDUAL_VISA"
        ? "Individual Visa"
        : item.visaType === "HOST_UMRAH_VISA"
          ? "Host Umrah Visa"
          : "Group"
    );
  }

  if (item.serviceType === "HOTEL_ACCOMMODATION") {
    if (item.hotelName) pieces.push(item.hotelName);
    if (item.paxCount) pieces.push(`${item.paxCount} Pax`);
    pieces.push(item.acType === "NON_AC" ? "Non-AC" : "AC");
    pieces.push(item.boardType === "BED_BREAKFAST" ? "Bed & Breakfast" : "Room Only");
  }

  if (item.serviceType === "AIR_TICKET") {
    pieces.push(item.ticketType === "RETURN" ? "Return Ticket" : "One Way Ticket");
  }

  if (item.serviceType === "TRANSPORTATION") {
    if (item.route?.name) pieces.push(item.route.name);
    if (item.vehicleType?.name) {
      pieces.push(
        item.vehicleType.seatCount
          ? `${item.vehicleType.name} (${item.vehicleType.seatCount} seats)`
          : item.vehicleType.name
      );
    }
  }

  return pieces.length ? pieces.join(" · ") : item.description;
}

function statusLabel(status: string) {
  switch (status) {
    case "PAID":
      return "PAID";
    case "PARTIALLY_PAID":
      return "PARTIALLY PAID";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UNPAID";
  }
}

export default function InvoicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);

  const loadInvoice = useCallback(async () => {
  if (!invoiceId) return;

  try {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/invoices/${invoiceId}`, {
      cache: "no-store",
    });

    const text = await response.text();
    let data: ApiResponse = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Invoice API returned an invalid response (HTTP ${response.status}).`
      );
    }

    if (!response.ok || !data.success || !data.invoice) {
      throw new Error(
        data.message ||
          `Unable to load invoice (HTTP ${response.status}).`
      );
    }

    setInvoice(data.invoice);
    setCompany(data.company ?? null);
  } catch (err) {
    console.error(err);
    setError(
      err instanceof Error ? err.message : "Unable to load invoice."
    );
  } finally {
    setLoading(false);
  }
}, [invoiceId]);

useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadInvoice();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadInvoice]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadInvoice();
  }, 0);

  return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [invoiceId]);

  const customer = useMemo<CustomerSnapshot | null>(() => {
    if (!invoice) return null;

    return {
      ...(invoice.customer ?? { name: "", mobile: "" }),
      name: invoice.customer?.name ?? invoice.customerName ?? "",
      mobile: invoice.customer?.mobile ?? invoice.customerMobile ?? "",
      iqamaNo: invoice.customer?.iqamaNo ?? invoice.customerIqamaNo ?? null,
      whatsapp: invoice.customer?.whatsapp ?? invoice.customerWhatsapp ?? null,
      email: invoice.customer?.email ?? invoice.customerEmail ?? null,
      address: invoice.customer?.address ?? invoice.customerAddress ?? null,
      nationality: invoice.customer?.nationality ?? invoice.customerNationality ?? null,
      passportNo: invoice.customer?.passportNo ?? invoice.customerPassportNo ?? null,
    };
  }, [invoice]);
  const balance = Math.max(0, Number(invoice?.balanceAmount ?? 0));

  function openPayment() {
    if (!invoice || balance <= 0 || invoice.status === "CANCELLED") return;

    setPaymentAmount(balance.toFixed(2));
    setPaymentMethod("CASH");
    setReferenceNo("");
    setPaymentNotes("");
    setPaymentError("");
    setPaymentOpen(true);
  }

  function closePayment() {
    if (savingPayment) return;
    setPaymentOpen(false);
    setPaymentError("");
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();

    if (!invoice) return;

    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }

    if (amount > balance + 0.0001) {
      setPaymentError(`Payment cannot exceed the current due of SAR ${money(balance)}.`);
      return;
    }

    try {
      setSavingPayment(true);
      setPaymentError("");

      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PAYMENT",
          amount,
          method: paymentMethod,
          referenceNo: referenceNo.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        }),
      });

      const text = await response.text();
      let data: ApiResponse = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Payment API returned an invalid response (HTTP ${response.status}).`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Unable to record payment (HTTP ${response.status}).`);
      }

      setPaymentOpen(false);
      await loadInvoice();

      // Automatically open the printable invoice after a successful payment.
      window.setTimeout(() => {
        document.body.classList.remove("receipt-printing");
        window.print();
      }, 350);
    } catch (err) {
      console.error(err);
      setPaymentError(err instanceof Error ? err.message : "Unable to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  function printInvoice() {
    document.body.classList.remove("receipt-printing");
    window.print();
  }

  const selectedPayment = invoice?.payments.find(
    (payment) => payment.id === selectedPaymentId
  ) ?? null;

  function generatePaymentReceipt() {
    if (!selectedPayment) return;

    setReceiptPaymentId(selectedPayment.id);
    document.body.classList.add("receipt-printing");

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.body.classList.remove("receipt-printing");
        setReceiptPaymentId(null);
      }, 100);
    }, 80);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-5 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-[#E4E7EC]" />
          <div className="mt-6 h-[720px] animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-5 sm:p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Sales / Invoice</p>
          <h1 className="mt-2 text-2xl font-bold text-[#1F2933]">Unable to open invoice</h1>
          <p className="mt-3 text-sm leading-6 text-[#667085]">{error || "Invoice not found."}</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => loadInvoice()}
              className="rounded-xl bg-[#0F6B5B] px-4 py-3 text-sm font-bold text-white hover:bg-[#0A4F44]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm font-bold text-[#344054]"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const logos = [company?.logo1Path, company?.logo2Path, company?.logo3Path]
    .map(logoUrl)
    .filter((value): value is string => Boolean(value));

  const receiptPayment = invoice.payments.find(
    (payment) => payment.id === receiptPaymentId
  ) ?? null;

  return (
    <>
      <style jsx global>{`
        .payment-receipt-print-only {
          display: none;
        }

        /* Zero page margins suppress the browser's printed date/title/URL
           header and footer. The invoice gets its own print padding below. */
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
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .payment-receipt-print-only {
            display: none;
          }

          .invoice-print-content main {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: #fff !important;
          }

          .invoice-page-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
          }

          .invoice-document-header {
            padding: 0 0 5mm !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .invoice-customer-details,
          .invoice-items-wrapper,
          .invoice-totals-section,
          .invoice-document-footer {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          /* Keep invoice metadata at the top-right even if the print viewport
             is narrower than Tailwind's md breakpoint. */
          .invoice-header-layout {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 4mm !important;
          }

          .invoice-header-company {
            width: 65% !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
          }

          .invoice-header-meta {
            width: 30% !important;
            min-width: 0 !important;
            flex: 0 0 30% !important;
          }

          .invoice-payment-history {
            display: none !important;
          }

          body.receipt-printing .invoice-print-content {
            display: none !important;
          }

          body.receipt-printing .payment-receipt-print-only {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 100%;
          }
        }
      `}</style>

      <div className="payment-receipt-print-only">
        {receiptPayment && (
          <div className="mx-auto max-w-xl p-10 text-[#1F2933]">
            <div className="border-b-4 border-[#0F6B5B] pb-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C9A227]">
                Payment Receipt
              </p>
              <h1 className="mt-2 text-2xl font-black">
                {company?.companyName ?? "Company"}
              </h1>
              {company?.phone && <p className="mt-2 text-xs text-[#667085]">{company.phone}</p>}
              {company?.email && <p className="text-xs text-[#667085]">{company.email}</p>}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-6 border-b border-[#E4E7EC] pb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#98A2B3]">Customer</p>
                <p className="mt-2 text-base font-bold">{customer?.name || "—"}</p>
                <p className="mt-1 text-xs text-[#667085]">Iqama: {customer?.iqamaNo || "—"}</p>
                <p className="mt-1 text-xs text-[#667085]">Contact: {customer?.mobile || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#98A2B3]">Invoice</p>
                <p className="mt-2 text-base font-black text-[#0F6B5B]">{invoice.invoiceNo}</p>
                <p className="mt-1 text-xs text-[#667085]">{formatDate(receiptPayment.paymentDate)}</p>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-[#E4E7EC] p-6">
              <div className="flex justify-between gap-4 border-b border-[#E4E7EC] pb-4">
                <span className="text-sm text-[#667085]">Payment Method</span>
                <span className="text-sm font-bold">
                  {PAYMENT_METHOD_LABELS[receiptPayment.method as PaymentMethod] ?? receiptPayment.method}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#E4E7EC] py-4">
                <span className="text-sm text-[#667085]">Reference No.</span>
                <span className="text-sm font-bold">{receiptPayment.referenceNo || "—"}</span>
              </div>
              <div className="flex justify-between gap-4 pt-4">
                <span className="text-base font-bold">Amount Received</span>
                <span className="text-2xl font-black text-[#0F6B5B]">
                  SAR {money(receiptPayment.amount)}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-[#F7F8F6] p-5">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Invoice Total</span>
                <span className="font-bold">SAR {money(invoice.totalAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Total Paid</span>
                <span className="font-bold text-green-700">SAR {money(invoice.paidAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="font-bold">Balance Due</span>
                <span className="font-black text-red-600">SAR {money(invoice.balanceAmount)}</span>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-[#667085]">
              Thank you for your payment.
            </p>
          </div>
        )}
      </div>

      <div className="invoice-print-content">
    <main className="min-h-screen bg-[#F7F8F6] px-4 py-5 print:bg-white print:p-0 sm:px-6 lg:px-8">
      <div className="invoice-page-container mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Sales</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2933]">Invoice</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-xs font-bold text-[#344054] hover:bg-[#FAFAF8]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={openPayment}
              disabled={balance <= 0 || invoice.status === "CANCELLED"}
              className="rounded-xl border border-[#0F6B5B] bg-white px-4 py-2.5 text-xs font-bold text-[#0F6B5B] hover:bg-[#F2F8F6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              + New Payment
            </button>
            <button
              type="button"
              onClick={printInvoice}
              className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
            >
              Generate Invoice
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <header className="invoice-document-header border-b border-[#E4E7EC] px-6 py-7 sm:px-8">
            <div className="invoice-header-layout flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="invoice-header-company min-w-0">
                {logos.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {logos.map((src, index) => (
                      <div
                        key={`${src}-${index}`}
                        className="flex h-16 min-w-16 items-center justify-center rounded-xl border border-[#E4E7EC] bg-white px-3 py-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Company logo ${index + 1}`} className="max-h-12 max-w-32 object-contain" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inline-flex h-16 items-center rounded-xl bg-[#0F6B5B] px-5 text-lg font-black text-white">
                    {company?.companyName ?? "Company"}
                  </div>
                )}

                <h2 className="mt-5 text-2xl font-black tracking-tight text-[#1F2933]">
                  {company?.companyName ?? "Company"}
                </h2>
                <div className="mt-2 space-y-1 text-xs leading-5 text-[#667085]">
                  {company?.address && <p>{company.address}</p>}
                  {company?.phone && <p>Phone: {company.phone}</p>}
                  {company?.email && <p>Email: {company.email}</p>}
                  {company?.website && <p>Web: {company.website}</p>}
                  {company?.taxNumber && <p>Tax No: {company.taxNumber}</p>}
                </div>
              </div>

              <div className="invoice-header-meta shrink-0 md:min-w-[260px]">
                <div className="flex flex-col items-end gap-3 text-right">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                      Invoice
                    </p>
                    <p className="mt-1 text-xl font-black text-[#0F6B5B]">
                      {invoice.invoiceNo}
                    </p>
                  </div>

                  <div className="text-xs text-[#667085]">
                    <p className="font-semibold text-[#344054]">Date</p>
                    <p className="mt-1">{formatDate(invoice.invoiceDate)}</p>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                      invoice.status === "PAID"
                        ? "bg-green-50 text-green-700"
                        : invoice.status === "PARTIALLY_PAID"
                          ? "bg-amber-50 text-amber-700"
                          : invoice.status === "CANCELLED"
                            ? "bg-red-50 text-red-700"
                            : "bg-[#0F6B5B]/10 text-[#0F6B5B]"
                    }`}
                  >
                    {statusLabel(invoice.status)}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="invoice-customer-details grid grid-cols-1 gap-5 border-b border-[#E4E7EC] px-6 py-5 sm:grid-cols-3 sm:gap-6 sm:px-8 print:grid-cols-3 print:gap-6 print:py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#98A2B3]">Customer Name</p>
              <p className="mt-2 break-words text-sm font-bold text-[#1F2933]">{customer?.name || "—"}</p>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#98A2B3]">Iqama Number</p>
              <p className="mt-2 break-words text-sm font-semibold text-[#344054]">{customer?.iqamaNo || "—"}</p>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#98A2B3]">Contact Number</p>
              <p className="mt-2 break-words text-sm font-semibold text-[#344054]">{customer?.mobile || "—"}</p>
            </div>
          </div>

          <div className="invoice-items-wrapper px-0 sm:px-8">
            <div className="overflow-visible">
              <table className="w-full table-fixed text-left print:table-fixed">

                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                    <th className="w-[18%] px-2 py-3 sm:px-0">Service</th>
                    <th className="w-[19%] px-1 py-3">Description</th>
                    <th className="w-[15%] px-1 py-3 text-right">Rate</th>
                    <th className="w-[9%] px-1 py-3 text-right">Qty</th>
                    <th className="w-[16%] px-1 py-3 text-right">Discount</th>
                    <th className="w-[23%] px-2 py-3 text-right sm:px-0">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#F0F2F4] align-top last:border-b-0">
                      <td className="px-2 py-4 text-sm font-bold text-[#1F2933] break-words sm:px-0">
                        {SERVICE_LABELS[item.serviceType] ?? item.serviceType}
                      </td>
                      <td className="px-1 py-4 text-xs leading-5 text-[#667085] break-words">{getServiceDescription(item)}</td>
                      <td className="px-1 py-4 text-right text-xs font-semibold text-[#344054] whitespace-nowrap">
                        SAR {money(item.amount)}
                      </td>
                      <td className="px-1 py-4 text-right text-xs font-semibold text-[#344054] whitespace-nowrap">
                        {money(item.quantity)}
                      </td>
                      <td className="px-1 py-4 text-right text-xs font-semibold text-[#667085] whitespace-nowrap">
                        SAR {money(item.discount)}
                      </td>
                      <td className="px-2 py-4 text-right text-sm font-black text-[#1F2933] whitespace-nowrap sm:px-0">
                        SAR {money(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-totals-section grid gap-6 border-t border-[#E4E7EC] px-6 py-5 sm:px-8 md:grid-cols-[1fr_340px] print:py-4">
            <div>
              {invoice.notes && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#98A2B3]">Notes</p>
                  <p className="mt-2 max-w-xl whitespace-pre-wrap text-xs leading-6 text-[#667085]">{invoice.notes}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Subtotal</span>
                <span className="font-semibold text-[#1F2933]">SAR {money(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Discount</span>
                <span className="font-semibold text-[#1F2933]">SAR {money(invoice.discount)}</span>
              </div>
              <div className="border-t border-[#E4E7EC] pt-4">
                <div className="flex justify-between gap-4">
                  <span className="text-sm font-bold text-[#344054]">Invoice Total</span>
                  <span className="text-xl font-black text-[#0F6B5B]">SAR {money(invoice.totalAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="text-[#667085]">Paid</span>
                  <span className="font-bold text-green-700">SAR {money(invoice.paidAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="font-semibold text-[#344054]">Balance Due</span>
                  <span className="font-black text-red-600">SAR {money(invoice.balanceAmount)}</span>
                </div>
              </div>
            </div>
          </div>
<div className="invoice-payment-history border-t border-[#E4E7EC] px-6 py-7 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#98A2B3]">Payment History</p>
                <h3 className="mt-1 text-lg font-bold text-[#1F2933]">Installments & Payments</h3>
              </div>
              <button
                type="button"
                onClick={openPayment}
                disabled={balance <= 0 || invoice.status === "CANCELLED"}
                className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
              >
                + Payment
              </button>
            </div>

            {invoice.payments.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-[#D0D5DD] bg-[#FAFAF8] px-5 py-8 text-center">
                <p className="text-sm font-semibold text-[#1F2933]">No payments recorded</p>
                <p className="mt-1 text-xs text-[#98A2B3]">The full invoice balance is currently due.</p>
              </div>
            ) : (
              <>
              <div className="mt-4 overflow-visible rounded-xl border border-[#E4E7EC]">
                <div className="overflow-visible">
                  <table className="w-full table-fixed text-left print:table-fixed">
                    <thead>
                      <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                        <th className="w-[10%] px-2 py-3 text-center">Select</th>
                        <th className="w-[15%] px-2 py-3">Date</th>
                        <th className="w-[19%] px-2 py-3">Method</th>
                        <th className="w-[20%] px-2 py-3">Reference</th>
                        <th className="w-[18%] px-2 py-3">Added By</th>
                        <th className="w-[18%] px-2 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((payment) => (
                        <tr
                          key={payment.id}
                          className={[
                            "border-b border-[#F0F2F4] last:border-b-0",
                            selectedPaymentId === payment.id ? "bg-[#F2F8F6]" : "",
                          ].join(" ")}
                        >
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedPaymentId === payment.id}
                              onChange={() =>
                                setSelectedPaymentId((current) =>
                                  current === payment.id ? null : payment.id
                                )
                              }
                              className="h-4 w-4 cursor-pointer accent-[#0F6B5B]"
                              aria-label={`Select payment ${payment.id}`}
                            />
                          </td>
                          <td className="px-2 py-3 text-xs text-[#667085]">{formatDate(payment.paymentDate)}</td>
                          <td className="px-2 py-3 text-xs font-semibold text-[#1F2933] break-words">
                            {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}
                          </td>
                          <td className="px-2 py-3 text-xs text-[#667085] break-words">{payment.referenceNo || "—"}</td>
                          <td className="px-2 py-3 text-xs text-[#667085] break-words">{payment.createdBy?.name || "—"}</td>
                          <td className="px-2 py-3 text-right text-sm font-black text-green-700 whitespace-nowrap">SAR {money(payment.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#E4E7EC] bg-[#FAFAF8] p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div>
                  {selectedPayment ? (
                    <>
                      <p className="text-xs font-bold text-[#1F2933]">
                        Payment selected
                      </p>
                      <p className="mt-1 text-[11px] text-[#667085]">
                        {formatDate(selectedPayment.paymentDate)} · {PAYMENT_METHOD_LABELS[selectedPayment.method as PaymentMethod] ?? selectedPayment.method} · SAR {money(selectedPayment.amount)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[#667085]">
                      Select one payment to generate its payment receipt.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={generatePaymentReceipt}
                  disabled={!selectedPayment}
                  className="rounded-xl border border-[#0F6B5B] bg-white px-4 py-2.5 text-xs font-bold text-[#0F6B5B] hover:bg-[#F2F8F6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Generate Payment Receipt
                </button>
              </div>
              </>
            )}
          </div>

          <footer className="invoice-document-footer border-t border-[#E4E7EC] px-6 py-6 text-center sm:px-8">
            <p className="text-[10px] text-[#98A2B3]">This invoice is generated from the Saudi Sales Quotation System.</p>
          </footer>
        </section>
      </div>

      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#101828]/50 p-4 backdrop-blur-sm print:hidden sm:p-6">
          <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
            <div className="flex shrink-0 items-start justify-between border-b border-[#E4E7EC] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Invoice Payment</p>
                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">Record Payment</h2>
                <p className="mt-1 text-xs text-[#667085]">Current due: SAR {money(balance)}</p>
              </div>
              <button
                type="button"
                onClick={closePayment}
                disabled={savingPayment}
                className="rounded-lg px-3 py-2 text-xl text-[#667085] hover:bg-[#F7F8F6]"
              >
                ×
              </button>
            </div>

            <form onSubmit={recordPayment} className="min-h-0 overflow-y-auto p-6">
              {paymentError && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {paymentError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#1F2933]" htmlFor="paymentAmount">
                    Payment Amount (SAR)
                  </label>
                  <input
                    id="paymentAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={balance}
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    autoFocus
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(balance.toFixed(2))}
                      className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-[11px] font-bold text-[#344054]"
                    >
                      Pay Full Due
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount("")}
                      className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-[11px] font-bold text-[#344054]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F2933]" htmlFor="paymentMethod">
                    Payment Method
                  </label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  >
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F2933]" htmlFor="referenceNo">
                    Reference No.
                  </label>
                  <input
                    id="referenceNo"
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    placeholder="Optional"
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#1F2933]" htmlFor="paymentNotes">
                    Notes
                  </label>
                  <textarea
                    id="paymentNotes"
                    rows={3}
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    placeholder="Optional payment note"
                    className="mt-2 w-full resize-none rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-[#F7F8F6] p-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[#667085]">Current Due</span>
                  <span className="font-bold text-[#1F2933]">SAR {money(balance)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="text-[#667085]">This Payment</span>
                  <span className="font-bold text-[#0F6B5B]">SAR {money(paymentAmount)}</span>
                </div>
                <div className="mt-3 border-t border-[#E4E7EC] pt-3">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-[#344054]">Remaining Due</span>
                    <span className="font-black text-red-600">
                      SAR {money(Math.max(0, balance - (Number(paymentAmount) || 0)))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button
                  type="button"
                  onClick={closePayment}
                  disabled={savingPayment}
                  className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-bold text-[#344054]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment || !paymentAmount || balance <= 0}
                  className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPayment ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
      </div>
    </>
  );
}
