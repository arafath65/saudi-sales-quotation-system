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
};

function ContactIcon({ name }: { name: ContactIconName }) {
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
    className: "mt-[1px] h-3.5 w-3.5 shrink-0 text-[#0F6B5B]",
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
}: {
  icon: ContactIconName;
  children: ReactNode;
}) {
  return (
    <p className="flex max-w-full items-start justify-end gap-1.5 text-[10px] leading-[1.2] text-[#667085] sm:text-[11px]">
      <ContactIcon name={icon} />
      <span className="min-w-0 whitespace-pre-line break-words text-right">
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

  return (
    <header className={`company-document-header border-b-4 border-[#0F6B5B] px-4 py-4 sm:px-6 ${compact ? "company-document-header-compact" : ""}`}>
      <div
        className={`grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-6 ${compact ? "sm:min-h-[100px]" : "sm:min-h-[165px]"}`}
      >
        <div className={`flex items-center justify-start ${compact ? "min-h-[80px] sm:min-h-[110px]" : "min-h-[115px] sm:min-h-[180px]"}`}>
          {logo ? (
            <Image
              src={logo}
              alt="Company logo"
              width={420}
              height={220}
              unoptimized
              className={`company-document-logo h-auto w-auto max-w-full object-contain object-left ${compact ? "max-h-[110px]" : "max-h-[180px]"}`}
            />
          ) : null}
        </div>

        <div className={`flex min-w-0 flex-col justify-between gap-3 text-right ${compact ? "sm:min-h-[110px]" : "sm:min-h-[180px]"}`}>
          <div className="min-w-0 text-right">{children}</div>

          <div className={`flex flex-col items-end gap-0.5 ${compact ? "mt-0.5" : "mt-1"}`}>
            {companyName ? (
              <p className={`font-black leading-tight text-[#1F2933] ${compact ? "text-xs" : "text-sm sm:text-base"}`}>
                {companyName}
              </p>
            ) : null}
            {address ? <ContactRow icon="address">{address}</ContactRow> : null}
            {phone ? <ContactRow icon="phone">{phone}</ContactRow> : null}
            {email ? <ContactRow icon="email">{email}</ContactRow> : null}
            {website ? <ContactRow icon="website">{website}</ContactRow> : null}
            {showTaxNumber && taxNumber ? (
              <ContactRow icon="tax">Tax / VAT No: {taxNumber}</ContactRow>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
