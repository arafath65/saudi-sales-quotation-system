"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type QuotationTermsSelection = {
  serviceType: string;
  termsConditionId: number;
};

export type QuotationOptionsSelection = {
  selectedBankIds: number[];
  termsConditionSelections: QuotationTermsSelection[];
};

type BankOption = {
  id: number | null;
  slot: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string | null;
  swiftCode: string | null;
  branchName: string | null;
};

type TermsOption = {
  id: number;
  serviceType: string;
  title: string;
  content: string;
  isActive: boolean;
};

type Props = {
  serviceTypes: string[];
  value: QuotationOptionsSelection;
  onChange: (value: QuotationOptionsSelection) => void;
};

const SERVICE_LABELS: Record<string, string> = {
  UMRAH_VISA: "Umrah Visa",
  RAWDHA: "Rawdha",
  HOTEL_ACCOMMODATION: "Hotel Accommodation",
  AIR_TICKET: "Air Ticket",
  TRANSPORTATION: "Transportation",
};

export default function QuotationBankTermsSelector({
  serviceTypes,
  value,
  onChange,
}: Props) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [termsOptions, setTermsOptions] = useState<TermsOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const response = await fetch("/api/quotation-options", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load quotation options."
          );
        }

        if (cancelled) return;

        setBanks(
          (data.banks ?? []).filter((bank: BankOption) =>
            Boolean(
              bank.id &&
                bank.bankName?.trim() &&
                bank.accountName?.trim() &&
                bank.accountNumber?.trim()
            )
          )
        );

        setTermsOptions(
          (data.termsConditions ?? []).filter(
            (row: TermsOption) => row.isActive
          )
        );
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load quotation options."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const usedServiceTypes = useMemo(
    () =>
      Array.from(new Set(serviceTypes)).filter((type) =>
        Boolean(SERVICE_LABELS[type])
      ),
    [serviceTypes]
  );

  function toggleBank(bankId: number, checked: boolean) {
    setSelectionError("");

    const selected = value.selectedBankIds;

    if (checked && selected.length >= 2) {
      setSelectionError("You can select up to two bank accounts.");
      return;
    }

    const selectedBankIds = checked
      ? [...selected, bankId]
      : selected.filter((id) => id !== bankId);

    onChange({ ...value, selectedBankIds });
  }

  function changeTerms(serviceType: string, rawId: string) {
    const termsConditionId = Number(rawId);

    const withoutCurrent = value.termsConditionSelections.filter(
      (selection) => selection.serviceType !== serviceType
    );

    const termsConditionSelections =
      termsConditionId > 0
        ? [...withoutCurrent, { serviceType, termsConditionId }]
        : withoutCurrent;

    onChange({ ...value, termsConditionSelections });
  }

  return (
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C9A227]">
            Quotation Footer
          </p>

          <h2 className="mt-1 text-lg font-black text-[#1F2933]">
            Bank Details & Terms
          </h2>

          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Bank details are optional. Select zero, one, or up to two saved bank
            accounts, and choose terms for each service type as needed.
          </p>
        </div>

        <Link
          href="/settings/quotation-options"
          target="_blank"
          className="text-xs font-bold text-[#0F6B5B] underline underline-offset-4"
        >
          Manage saved options ↗
        </Link>
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {loadError}
        </p>
      )}

      {selectionError && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {selectionError}
        </p>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#344054]">
            Select Bank Accounts
          </h3>

          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              value.selectedBankIds.length > 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {value.selectedBankIds.length === 0
              ? "Optional · none selected"
              : `${value.selectedBankIds.length} selected`}
          </span>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-[#667085]">
            Loading saved banks…
          </p>
        ) : banks.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[#D0D5DD] p-4 text-sm leading-6 text-[#667085]">
            No complete bank accounts have been saved.{" "}
            <Link
              href="/settings/quotation-options"
              className="font-bold text-[#0F6B5B] underline"
            >
              Add bank details in Settings
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {banks.map((bank) => {
              const checked = value.selectedBankIds.includes(
                bank.id as number
              );

              return (
                <label
                  key={bank.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    checked
                      ? "border-[#0F6B5B] bg-[#0F6B5B]/5 ring-1 ring-[#0F6B5B]/15"
                      : "border-[#E4E7EC] hover:border-[#0F6B5B]/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      toggleBank(
                        bank.id as number,
                        event.target.checked
                      )
                    }
                    className="mt-1 h-4 w-4 accent-[#0F6B5B]"
                  />

                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#1F2933]">
                      {bank.bankName}
                    </span>

                    <span className="mt-1 block text-xs text-[#667085]">
                      {bank.accountName}
                    </span>

                    <span className="mt-1 block break-all text-[11px] text-[#98A2B3]">
                      {bank.accountNumber}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-[#E4E7EC] pt-5">
        <h3 className="text-sm font-bold text-[#344054]">
          Terms & Conditions by Service
        </h3>

        {usedServiceTypes.length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">
            Add at least one service to select its terms & conditions.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {usedServiceTypes.map((serviceType) => {
              const templates = termsOptions.filter(
                (row) => row.serviceType === serviceType
              );

              const selected =
                value.termsConditionSelections.find(
                  (row) => row.serviceType === serviceType
                )?.termsConditionId ?? "";

              return (
                <label
                  key={serviceType}
                  className="text-xs font-bold text-[#344054]"
                >
                  {SERVICE_LABELS[serviceType]}

                  <select
                    value={selected}
                    onChange={(event) =>
                      changeTerms(serviceType, event.target.value)
                    }
                    disabled={loading || templates.length === 0}
                    className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#0F6B5B] disabled:bg-[#F9FAFB] disabled:text-[#98A2B3]"
                  >
                    <option value="">
                      {templates.length
                        ? "Choose terms & conditions"
                        : "No templates saved for this service"}
                    </option>

                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>

                  {templates.length === 0 && (
                    <span className="mt-1.5 block font-normal text-[#98A2B3]">
                      Create a template in{" "}
                      <Link
                        href="/settings/quotation-options"
                        className="font-bold text-[#0F6B5B] underline"
                      >
                        Quotation Options Settings
                      </Link>
                      .
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}