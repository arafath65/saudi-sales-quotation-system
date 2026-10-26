import Image from "next/image";
import type { ReactNode } from "react";

type CompanyDocumentInfo = {
  companyName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxNumber?: string | null;
  logo1Path?: string | null;
};

type ContactIconName = "address" | "phone" | "email" | "website" | "tax";

type CompanyDocumentHeaderProps = {
  company: CompanyDocumentInfo | null | undefined;
  children: ReactNode;
  compact?: boolean;
  showTaxNumber?: boolean;
  quotationStyle?: boolean;
};

function ContactIcon({
  name,
  quotationStyle = false,
}: {
  name: ContactIconName;
  quotationStyle?: boolean;
}) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: `mt-[1px] h-3.5 w-3.5 shrink-0 ${
      quotationStyle ? "text-[#262626]" : "text-[#0F6B5B]"
    }`,
  };

  switch (name) {
    case "address":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.08 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.69A2 2 0 0 1 22 16.92Z" />
        </svg>
      );

    case "email":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );

    case "website":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );

    case "tax":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

function ContactRow({
  icon,
  children,
  quotationStyle = false,
  inline = false,
  alignRight = false,
}: {
  icon: ContactIconName;
  children: ReactNode;
  quotationStyle?: boolean;
  inline?: boolean;
  alignRight?: boolean;
}) {
  const alignmentClass = alignRight
    ? "justify-end text-right"
    : quotationStyle
      ? "justify-start text-left"
      : "justify-end text-right";

  return (
    <p
      className={`flex max-w-full items-start gap-1.5 text-[10px] leading-[1.3] sm:text-[11px] ${
        inline ? "w-auto" : "w-full"
      } ${alignmentClass}`}
    >
      <ContactIcon name={icon} quotationStyle={quotationStyle} />

      <span
        className={`min-w-0 whitespace-pre-line break-words ${
          alignRight || !quotationStyle ? "text-right" : "text-left"
        }`}
      >
        {children}
      </span>
    </p>
  );
}

export default function CompanyDocumentHeader({
  company,
  children,
  compact = false,
  showTaxNumber = false,
  quotationStyle = false,
}: CompanyDocumentHeaderProps) {
  const logo = company?.logo1Path
    ? `/api/company-settings/logo/${encodeURIComponent(company.logo1Path)}`
    : null;

  const companyName = company?.companyName?.trim() ?? "";
  const address = company?.address?.trim() ?? "";
  const phone = company?.phone?.trim() ?? "";
  const email = company?.email?.trim() ?? "";
  const website = company?.website?.trim() ?? "";
  const taxNumber = company?.taxNumber?.trim() ?? "";

  const contactDetails = (
    <>
      {address ? (
        <ContactRow icon="address">{address}</ContactRow>
      ) : null}

      {phone ? (
        <ContactRow icon="phone">{phone}</ContactRow>
      ) : null}

      {email ? (
        <ContactRow icon="email">{email}</ContactRow>
      ) : null}

      {website ? (
        <ContactRow icon="website">{website}</ContactRow>
      ) : null}

      {showTaxNumber && taxNumber ? (
        <ContactRow icon="tax">Tax / VAT No: {taxNumber}</ContactRow>
      ) : null}
    </>
  );

  return (
    <header
      className={`company-document-header ${
        quotationStyle
          ? "border-b-2 border-[#262626] px-4 py-2 sm:px-6 sm:py-2"
          : "border-b-4 border-[#0F6B5B] px-4 py-4 sm:px-6"
      } ${compact ? "company-document-header-compact" : ""}`}
    >
      <div
        className={
          quotationStyle
            ? "grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:gap-6"
            : `grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-6 ${
                compact ? "sm:min-h-[100px]" : "sm:min-h-[165px]"
              }`
        }
      >
        {/* LEFT: Company logo */}
        <div
          className={
            quotationStyle
              ? "flex min-w-0 items-start justify-start"
              : `flex items-center justify-start ${
                  compact
                    ? "min-h-[80px] sm:min-h-[110px]"
                    : "min-h-[115px] sm:min-h-[180px]"
                }`
          }
        >
          {logo ? (
            <Image
              src={logo}
              alt="Company logo"
              width={520}
              height={220}
              unoptimized
              className={`company-document-logo h-auto w-auto max-w-full object-contain object-left ${
                quotationStyle
                  ? "max-h-[78px]"
                  : compact
                    ? "max-h-[110px]"
                    : "max-h-[180px]"
              }`}
            />
          ) : null}
        </div>

        {/* RIGHT: Quotation number/date or other document metadata */}
        <div
          className={
            quotationStyle
              ? "flex min-w-0 flex-col items-end justify-start text-right"
              : `flex min-w-0 flex-col justify-between gap-3 text-right ${
                  compact ? "sm:min-h-[110px]" : "sm:min-h-[180px]"
                }`
          }
        >
          <div className="min-w-0 text-right">{children}</div>

          {!quotationStyle ? (
            <div
              className={`flex flex-col items-end gap-0.5 ${
                compact ? "mt-0.5" : "mt-1"
              }`}
            >
              {companyName ? (
                <p
                  className={`font-black leading-tight text-[#1F2933] ${
                    compact ? "text-xs" : "text-sm sm:text-base"
                  }`}
                >
                  {companyName}
                </p>
              ) : null}

              {contactDetails}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * Quotation-only footer.
 *
 * Left: address and phone.
 * Centre: thank-you message and optional tax number.
 * Right: email and website.
 */
export function QuotationBusinessFooter({
  company,
}: {
  company: CompanyDocumentInfo | null | undefined;
}) {
  const address = company?.address?.trim() ?? "";
  const phone = company?.phone?.trim() ?? "";
  const email = company?.email?.trim() ?? "";
  const website = company?.website?.trim() ?? "";
  const taxNumber = company?.taxNumber?.trim() ?? "";

  return (
    <footer className="quotation-company-footer border-t border-[#D5D5D5] bg-[#FAF7F0] px-4 py-3 sm:px-6">
      <div className="quotation-footer-layout grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        {/* LEFT: Address and phone */}
        <div className="flex min-w-0 flex-col items-start gap-1 text-left">
          {address ? (
            <ContactRow icon="address" quotationStyle>
              {address}
            </ContactRow>
          ) : null}

          {phone ? (
            <ContactRow icon="phone" quotationStyle>
              {phone}
            </ContactRow>
          ) : null}
        </div>

        {/* CENTRE: Thank-you message */}
        <div className="flex min-w-0 flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-[#262626]">
            Thank you for your business.
          </p>

          {taxNumber ? (
            <p className="mt-1 text-[10px] text-[#667085]">
              Tax / VAT No: {taxNumber}
            </p>
          ) : null}
        </div>

        {/* RIGHT: Email and website */}
        <div className="flex min-w-0 flex-col items-end gap-1 text-right">
          {email ? (
            <ContactRow
              icon="email"
              quotationStyle
              inline
              alignRight
            >
              {email}
            </ContactRow>
          ) : null}

          {website ? (
            <ContactRow
              icon="website"
              quotationStyle
              inline
              alignRight
            >
              {website}
            </ContactRow>
          ) : null}
        </div>
      </div>
    </footer>
  );
}