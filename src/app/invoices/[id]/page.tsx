"use client";


import CompanyDocumentHeader, {
  QuotationBusinessFooter,
} from "@/components/documents/CompanyDocumentHeader";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  quotationId: number;
  invoiceNo: string;
  invoiceDate: string;
  currency?: "SAR" | "LKR" | "USD" | null;
  customer: CustomerSnapshot;
  customerName?: string;
  customerMobile?: string;
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
  RAWDHA: "Rawdha",
  HOTEL_ACCOMMODATION: "Hotel Accommodation",
  AIR_TICKET: "Air Ticket",
  TRANSPORTATION: "Transportation",
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : "0.00";
}

function formatPaymentAmount(value: string) {
  const normalized = value.replace(/,/g, "");

  if (!normalized) return "";

  const [wholePart, ...fractionParts] = normalized.split(".");
  const wholeDigits = wholePart.replace(/\D/g, "");
  const fractionDigits = fractionParts
    .join("")
    .replace(/\D/g, "")
    .slice(0, 2);

  const groupedWhole = wholeDigits.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );

  return normalized.includes(".")
    ? `${groupedWhole}.${fractionDigits}`
    : groupedWhole;
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

  async function loadInvoice() {
  if (!invoiceId) return;

  try {
    // Do not synchronously update React state here.
    // The initial loading state is already true.
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

    // These state updates happen after the asynchronous request.
    setError("");
    setInvoice(data.invoice);
    setCompany(data.company ?? null);
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : "Unable to load invoice."
    );
  } finally {
    setLoading(false);
  }
}

    useEffect(() => {
    // Defer the request so state updates inside loadInvoice()
    // are not treated as synchronous updates within this effect.
    const timer = window.setTimeout(() => {
      void loadInvoice();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const customer = useMemo<CustomerSnapshot | null>(() => {
    if (!invoice) return null;

    return {
      ...(invoice.customer ?? { name: "", mobile: "" }),
      name: invoice.customer?.name ?? invoice.customerName ?? "",
      mobile: invoice.customer?.mobile ?? invoice.customerMobile ?? "",
      whatsapp: invoice.customer?.whatsapp ?? invoice.customerWhatsapp ?? null,
      email: invoice.customer?.email ?? invoice.customerEmail ?? null,
      address: invoice.customer?.address ?? invoice.customerAddress ?? null,
      nationality: invoice.customer?.nationality ?? invoice.customerNationality ?? null,
      passportNo: invoice.customer?.passportNo ?? invoice.customerPassportNo ?? null,
    };
  }, [invoice]);

  const total = Number(invoice?.totalAmount ?? 0);
  const paid = Number(invoice?.paidAmount ?? 0);
  const balance = Math.max(0, Number(invoice?.balanceAmount ?? 0));
  const paidPercent = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;

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

    const amount = Number(paymentAmount.replace(/,/g, ""));

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }

    if (amount > balance + 0.0001) {
      setPaymentError(`Payment cannot exceed the current due of ${invoice.currency ?? "SAR"} ${money(balance)}.`);
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
  onClick={() => {
    setLoading(true);
    setError("");
    void loadInvoice();
  }}
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

  const receiptPayment = invoice.payments.find(
    (payment) => payment.id === receiptPaymentId
  ) ?? null;

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        .invoice-print-content,
        .payment-receipt-document {
          --document-black: #1b1b1b;
          --document-gold: #b99343;
          --document-cream: #faf7f0;
          color: #222222;
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .invoice-page {
          border-color: #ded8cc !important;
          box-shadow: 0 18px 45px rgba(24, 24, 24, 0.07),
            0 2px 10px rgba(185, 147, 67, 0.1) !important;
        }

        /* Match the quotation masthead: smaller logo, no duplicated contact block,
           invoice details remain in the right column, and a black separator. */
        .invoice-page .company-document-header {
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

        /* Force a two-column masthead at every viewport size:
           company logo on the left, invoice details on the right. */
        .invoice-page .company-document-header > div {
          display: grid !important;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr) !important;
          grid-template-rows: auto !important;
          grid-auto-flow: row !important;
          align-items: center !important;
          gap: 4mm !important;
          width: 100% !important;
          min-height: 0 !important;
        }

        .invoice-page .company-document-header > div > div:first-child {
          grid-column: 1 !important;
          grid-row: 1 !important;
          display: flex !important;
          justify-content: flex-start !important;
          align-items: center !important;
          min-width: 0 !important;
          min-height: 92px !important;
        }

        .invoice-page .company-document-header > div > div:last-child {
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

        .invoice-page .company-document-header > div > div:last-child > div:first-child {
          width: 100% !important;
          min-width: 0 !important;
          text-align: right !important;
        }

        /* quotationStyle already omits the company contact block from the masthead.
           Do not hide the nested right-side slot: it contains invoice metadata. */

        .invoice-page .company-document-logo {
          display: block !important;
          width: auto !important;
          max-width: 78mm !important;
          max-height: 25mm !important;
          object-fit: contain !important;
          object-position: left center !important;
        }

        .invoice-page > header {
          border-bottom: 3px solid #262626 !important;
        }

        .invoice-page .invoice-customer-card {
          background: #faf7f0 !important;
          border-color: #e4e7ec !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .invoice-page .invoice-customer-card p {
          overflow-wrap: anywhere;
        }

        .invoice-page table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        /* The invoice item table uses a rounded outer frame, like the quotation. */
        .invoice-page .invoice-items-wrapper table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }

        .invoice-page table thead,
        .invoice-page table thead tr {
          background: var(--document-black) !important;
          color: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .invoice-page table thead th {
          background: #1b1b1b !important;
          color: #fff !important;
          border-color: #262626 !important;
        }

        .invoice-page .invoice-items-wrapper table thead th:first-child {
          border-top-left-radius: 10px !important;
        }

        .invoice-page .invoice-items-wrapper table thead th:last-child {
          border-top-right-radius: 10px !important;
        }

        .invoice-page .invoice-table-header,
        .invoice-page .invoice-table-header th {
          background: #1b1b1b !important;
          color: #fff !important;
          border-color: #262626 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .invoice-page table tbody tr {
          border-color: #e9e0cf !important;
        }

        .invoice-page [class~="text-[#0F6B5B]"],
        .payment-receipt-document [class~="text-[#0F6B5B]"] {
          color: var(--document-black) !important;
        }

        .invoice-page [class~="border-[#0F6B5B]"],
        .payment-receipt-document [class~="border-[#0F6B5B]"] {
          border-color: var(--document-gold) !important;
        }

        .invoice-page [class~="bg-[#0F6B5B]"],
        .payment-receipt-document [class~="bg-[#0F6B5B]"] {
          background-color: var(--document-black) !important;
          color: #fff !important;
        }

        .invoice-page [class~="bg-[#0F6B5B]/10"],
        .payment-receipt-document [class~="bg-[#0F6B5B]/10"] {
          background-color: var(--document-cream) !important;
        }

        .invoice-page [class~="bg-[#F7F8F6]"],
        .invoice-page [class~="bg-[#FAFAF8]"],
        .payment-receipt-document [class~="bg-[#F7F8F6]"],
        .payment-receipt-document [class~="bg-[#FAFAF8]"] {
          background-color: var(--document-cream) !important;
        }

        .payment-receipt-print-only {
          display: none;
        }

        .quotation-company-footer {
          color: #262626 !important;
          background-color: var(--document-cream, #faf7f0) !important;
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

          .payment-receipt-print-only {
            display: none;
          }

          /* Use the printable A4 height so a short invoice still fills the page. */
          .invoice-print-content main {
            box-sizing: border-box !important;
            display: block !important;
            width: 100% !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: #fff !important;
          }

          /* Stretch the document wrapper within the page's printable area. */
          .invoice-print-content main > div {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            max-width: none !important;
            min-height: calc(297mm - 16mm) !important;
            margin: 0 !important;
          }

          /* A flex column lets the company footer move to the page bottom when
             there is spare space, while longer invoices can still grow naturally. */
          .invoice-page {
            display: flex !important;
            flex: 1 0 auto !important;
            flex-direction: column !important;
            width: 100% !important;
            min-height: calc(297mm - 16mm) !important;
            max-width: none !important;
            margin: 0 !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .invoice-page > .invoice-document-footer {
            width: 100% !important;
            margin-top: auto !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .invoice-page > header {
            padding: 0 0 4mm !important;
            border-bottom: 3px solid #262626 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Keep invoice metadata on the right of the logo in saved PDFs too. */
          .invoice-page .company-document-header > div {
            display: grid !important;
            grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr) !important;
            grid-template-rows: auto !important;
            align-items: center !important;
            gap: 4mm !important;
          }

          .invoice-page .company-document-header > div > div:first-child {
            grid-column: 1 !important;
            grid-row: 1 !important;
          }

          .invoice-page .company-document-header > div > div:last-child {
            grid-column: 2 !important;
            grid-row: 1 !important;
            justify-content: center !important;
            align-items: flex-end !important;
          }

          .invoice-page .company-document-logo {
            max-width: 78mm !important;
            max-height: 25mm !important;
          }

          /* Keep the same inset around the customer card and rounded table in the PDF. */
          .invoice-page .invoice-customer-details,
          .invoice-page .invoice-items-wrapper,
          .invoice-page .invoice-totals-section {
            padding-left: 4mm !important;
            padding-right: 4mm !important;
          }

          .invoice-page .invoice-customer-details {
            padding-top: 3mm !important;
            padding-bottom: 3mm !important;
          }

          .invoice-page .invoice-items-wrapper > div {
            margin-top: 2mm !important;
          }

          .invoice-page .invoice-items-wrapper table thead th:first-child {
            border-top-left-radius: 2mm !important;
          }

          .invoice-page .invoice-items-wrapper table thead th:last-child {
            border-top-right-radius: 2mm !important;
          }

          .invoice-page .invoice-items-wrapper table th,
          .invoice-page .invoice-items-wrapper table td {
            padding: 2.2mm 1.5mm !important;
            vertical-align: top !important;
            overflow-wrap: anywhere !important;
          }

          .invoice-page .invoice-items-wrapper table thead tr {
            background: var(--document-black) !important;
            color: #fff !important;
          }

          .invoice-page .invoice-items-wrapper table thead th {
            font-size: 7.5pt !important;
          }

          .invoice-page .invoice-items-wrapper table tbody td {
            font-size: 7.5pt !important;
            line-height: 1.25 !important;
          }

          .invoice-page .invoice-totals-section {
            padding-top: 4mm !important;
            padding-bottom: 4mm !important;
            gap: 4mm !important;
          }

          .invoice-page .invoice-totals-section > div:last-child {
            min-width: 68mm !important;
          }

          .invoice-page .invoice-totals-section .space-y-3 > div {
            font-size: 9pt !important;
          }

          .invoice-page .invoice-totals-section .border-t {
            border-color: var(--document-gold) !important;
          }

          .quotation-company-footer {
            display: block !important;
            padding: 3mm 4mm !important;
            margin: 0 !important;
            background-color: #faf7f0 !important;
            color: #262626 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .quotation-footer-layout {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 4mm !important;
          }

          .quotation-footer-layout > div:nth-child(2) {
            text-align: center !important;
          }

          .quotation-company-footer p {
            font-size: 7.5pt !important;
            line-height: 1.25 !important;
            overflow-wrap: anywhere !important;
          }

          body.receipt-printing .invoice-print-content {
            display: none !important;
          }

          body.receipt-printing .payment-receipt-print-only {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 100%;
            background: #fff !important;
          }

          .payment-receipt-document .company-document-header {
            border-bottom: 3px solid #262626 !important;
            border-bottom-color: #262626 !important;
            background: #fff !important;
          }

          /* Keep payment receipt title/metadata visible in the compact masthead. */

          .payment-receipt-document .company-document-logo {
            max-width: 78mm !important;
            max-height: 25mm !important;
            object-fit: contain !important;
            object-position: left center !important;
          }

          .payment-receipt-document {
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: #fff !important;
            color: #222 !important;
          }

          .payment-receipt-title {
            font-size: 13pt !important;
            line-height: 1.2 !important;
            letter-spacing: 0.2em !important;
          }

          .payment-receipt-document > header {
            border-bottom: 3px solid #262626 !important;
            padding-bottom: 4mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Push the company address/footer to the bottom on short receipts.
             Longer receipts can still expand beyond one page naturally. */
          .payment-receipt-document .quotation-company-footer {
            margin-top: auto !important;
            flex-shrink: 0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .payment-receipt-document .rounded-2xl {
            border-radius: 2mm !important;
          }

          .payment-receipt-document .mt-7 {
            margin-top: 4mm !important;
          }

          .payment-receipt-document .p-6,
          .payment-receipt-document .p-5 {
            padding: 4mm !important;
          }

          .payment-receipt-document img:not(.company-document-logo) {
            display: none !important;
          }

          .payment-receipt-document .company-document-logo {
            max-width: 62mm !important;
            max-height: 22mm !important;
            object-fit: contain !important;
            object-position: left center !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="payment-receipt-print-only">
        {receiptPayment && (
          <div className="payment-receipt-document mx-auto max-w-3xl p-10 text-[#1F2933]">
            <CompanyDocumentHeader company={company} compact quotationStyle>
              <p className="payment-receipt-title text-lg font-black uppercase tracking-[0.24em] text-[#C9A227]">
                Payment Receipt
              </p>
            </CompanyDocumentHeader>

            <div className="mt-7 grid grid-cols-2 gap-6 border-b border-[#E4E7EC] pb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#98A2B3]">Customer</p>
                <p className="mt-2 text-base font-bold">{customer?.name}</p>
                <p className="mt-1 text-xs text-[#667085]">{customer?.mobile}</p>
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
                  {invoice.currency ?? "SAR"} {money(receiptPayment.amount)}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-[#F7F8F6] p-5">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Invoice Total</span>
                <span className="font-bold">{invoice.currency ?? "SAR"} {money(invoice.totalAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Total Paid</span>
                <span className="font-bold text-green-700">{invoice.currency ?? "SAR"} {money(invoice.paidAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="font-bold">Balance Due</span>
                <span className="font-black text-red-600">{invoice.currency ?? "SAR"} {money(invoice.balanceAmount)}</span>
              </div>
            </div>

            <QuotationBusinessFooter company={company} />
          </div>
        )}
      </div>

      <div className="invoice-print-content">
    <main className="min-h-screen bg-[#F7F8F6] px-4 py-5 print:bg-white print:p-0 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
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
              onClick={() => router.push(`/quotations/${invoice.quotationId}`)}
              className="rounded-xl border border-[#0F6B5B] bg-white px-4 py-2.5 text-xs font-bold text-[#0F6B5B] hover:bg-[#F2F8F6]"
            >
              Edit Service Quantities
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

        <section className="invoice-page overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <CompanyDocumentHeader company={company} quotationStyle>
<p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">Invoice</p>
                <p className="mt-2 break-words text-xl font-black leading-tight text-[#0F6B5B]">
  {invoice.invoiceNo}
</p>
                <p className="mt-2 text-xs text-[#667085]">Date: {formatDate(invoice.invoiceDate)}</p>
                <span
                  className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
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
          </CompanyDocumentHeader>

          {/* CUSTOMER DETAILS — match the quotation's warm cream customer card */}
          <div className="invoice-customer-details px-5 py-4 sm:px-5">
            <div className="invoice-customer-card rounded-xl border border-[#E4E7EC] bg-[#FAF7F0] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C9A227]">
                Customer
              </p>
              <p className="mt-2 text-base font-bold leading-tight text-[#1F2933]">
                {customer?.name || "—"}
              </p>
              <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs leading-tight text-[#667085] sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-[#344054]">Contact Number:</span>{" "}
                  {customer?.mobile || "—"}
                </p>
                {customer?.whatsapp && (
                  <p>
                    <span className="font-semibold text-[#344054]">WhatsApp:</span>{" "}
                    {customer.whatsapp}
                  </p>
                )}
                {customer?.email && (
                  <p>
                    <span className="font-semibold text-[#344054]">Email:</span>{" "}
                    {customer.email}
                  </p>
                )}
                {customer?.address && (
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-[#344054]">Address:</span>{" "}
                    {customer.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SERVICE TABLE — rounded container clips the black header corners like the quotation */}
          <div className="invoice-items-wrapper px-5 sm:px-5 print:px-5">
  <div className="mt-5 overflow-hidden rounded-xl border border-[#D8D8D8] print:overflow-visible print:rounded-none print:border-0">
    <table className="w-full table-fixed border-separate border-spacing-0 text-left">
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "20%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "20%" }} />
      </colgroup>

      <thead>
        <tr className="invoice-table-header border-b border-[#262626] bg-[#1b1b1b] text-[9px] font-black uppercase tracking-[0.06em] text-white">
          <th className="px-1.5 py-3 text-left text-white">Service</th>
          <th className="px-1.5 py-3 text-left text-white">Description</th>
          <th className="px-1.5 py-3 text-right text-white">Rate</th>
          <th className="px-1.5 py-3 text-right text-white">Qty</th>
          <th className="px-1.5 py-3 text-right text-white">Total</th>
        </tr>
      </thead>

      <tbody>
        {invoice.items.map((item) => (
          <tr
            key={item.id}
            className="border-b border-[#F0F2F4] align-top last:border-b-0"
          >
            <td className="break-words px-1.5 py-4 text-xs font-bold leading-4 text-[#1F2933]">
              {SERVICE_LABELS[item.serviceType] ?? item.serviceType}
            </td>

            <td className="break-words whitespace-normal px-1.5 py-4 text-[10px] leading-4 text-[#667085]">
              {getServiceDescription(item)}
            </td>

            <td className="break-words whitespace-normal px-1.5 py-4 text-right text-[10px] font-semibold leading-4 text-[#344054]">
              <span>
                {invoice.currency ?? "SAR"} {money(item.amount)}
              </span>
            </td>

            <td className="break-words px-1.5 py-4 text-right text-[10px] font-semibold leading-4 text-[#344054]">
              {money(item.quantity)}
            </td>

            <td className="break-words whitespace-normal px-1.5 py-4 text-right text-[10px] font-black leading-4 text-[#1F2933]">
              <span>
                {invoice.currency ?? "SAR"} {money(item.totalAmount)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

          <div className="invoice-totals-section grid gap-6 border-t border-[#E4E7EC] px-6 py-7 sm:px-8 md:grid-cols-[1fr_340px]">
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
                <span className="font-semibold text-[#1F2933]">{invoice.currency ?? "SAR"} {money(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-[#667085]">Discount</span>
                <span className="font-semibold text-[#1F2933]">{invoice.currency ?? "SAR"} {money(invoice.discount)}</span>
              </div>
              <div className="border-t border-[#E4E7EC] pt-4">
                <div className="flex justify-between gap-4">
                  <span className="text-sm font-bold text-[#344054]">Invoice Total</span>
                  <span className="text-xl font-black text-[#0F6B5B]">{invoice.currency ?? "SAR"} {money(invoice.totalAmount)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="text-[#667085]">Paid</span>
                  <span className="font-bold text-green-700">{invoice.currency ?? "SAR"} {money(invoice.paidAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="font-semibold text-[#344054]">Balance Due</span>
                  <span className="font-black text-red-600">{invoice.currency ?? "SAR"} {money(invoice.balanceAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E4E7EC] px-6 py-6 sm:px-8 print:hidden">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#98A2B3]">Payment Progress</p>
                <p className="mt-1 text-xs text-[#667085]">{paidPercent.toFixed(0)}% of the invoice has been paid.</p>
              </div>
              <p className="text-sm font-black text-[#0F6B5B]">{invoice.currency ?? "SAR"} {money(invoice.paidAmount)} / {invoice.currency ?? "SAR"} {money(invoice.totalAmount)}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E4E7EC]">
              <div className="h-full rounded-full bg-[#0F6B5B] transition-all" style={{ width: `${paidPercent}%` }} />
            </div>
          </div>

          <div className="border-t border-[#E4E7EC] px-6 py-7 sm:px-8 print:hidden">
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
              <div className="mt-4 overflow-hidden rounded-xl border border-[#E4E7EC]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[740px] text-left">
                    <thead>
                      <tr className="border-b border-[#E4E7EC] bg-[#FAFAF8] text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                        <th className="w-12 px-4 py-3 text-center">Select</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Added By</th>
                        <th className="px-4 py-3 text-right">Amount</th>
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
                          <td className="px-4 py-4 text-center">
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
                          <td className="px-4 py-4 text-xs text-[#667085]">{formatDate(payment.paymentDate)}</td>
                          <td className="px-4 py-4 text-xs font-semibold text-[#1F2933]">
                            {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}
                          </td>
                          <td className="px-4 py-4 text-xs text-[#667085]">{payment.referenceNo || "—"}</td>
                          <td className="px-4 py-4 text-xs text-[#667085]">{payment.createdBy?.name || "—"}</td>
                          <td className="px-4 py-4 text-right text-sm font-black text-green-700">{invoice.currency ?? "SAR"} {money(payment.amount)}</td>
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
                        {formatDate(selectedPayment.paymentDate)} · {PAYMENT_METHOD_LABELS[selectedPayment.method as PaymentMethod] ?? selectedPayment.method} · {invoice.currency ?? "SAR"} {money(selectedPayment.amount)}
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

          <div className="invoice-document-footer">
            <QuotationBusinessFooter company={company} />
          </div>
        </section>
      </div>

      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#101828]/50 p-4 backdrop-blur-sm print:hidden sm:p-6">
          <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
            <div className="flex shrink-0 items-start justify-between border-b border-[#E4E7EC] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">Invoice Payment</p>
                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">Record Payment</h2>
                <p className="mt-1 text-xs text-[#667085]">Current due: {invoice.currency ?? "SAR"} {money(balance)}</p>
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
                    Payment Amount ({invoice.currency ?? "SAR"})
                  </label>
                  <input
  id="paymentAmount"
  type="text"
  inputMode="decimal"
  value={formatPaymentAmount(paymentAmount)}
  onChange={(event) =>
    setPaymentAmount(event.target.value.replace(/,/g, ""))
  }
  autoFocus
  placeholder="0.00"
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
                  <span className="font-bold text-[#1F2933]">{invoice.currency ?? "SAR"} {money(balance)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="text-[#667085]">This Payment</span>
                  <span className="font-bold text-[#0F6B5B]">{invoice.currency ?? "SAR"} {money(paymentAmount)}</span>
                </div>
                <div className="mt-3 border-t border-[#E4E7EC] pt-3">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-[#344054]">Remaining Due</span>
                    <span className="font-black text-red-600">
                      {invoice.currency ?? "SAR"} {money(Math.max(0, balance - (Number(paymentAmount.replace(/,/g, "")) || 0)))}
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
