"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type BankDetail = {
  id: number | null;
  slot: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string | null;
  swiftCode: string | null;
  branchName: string | null;
};

type TermsCondition = {
  id: number | null;
  serviceType: string;
  title: string;
  content: string;
  isActive: boolean;
};

const SERVICE_TYPES = [
  { value: "UMRAH_VISA", label: "Umrah Visa" },
  { value: "HOTEL_ACCOMMODATION", label: "Hotel Accommodation" },
  { value: "AIR_TICKET", label: "Air Ticket" },
  { value: "TRANSPORTATION", label: "Transportation" },
];

function emptyBank(slot: number): BankDetail {
  return {
    id: null,
    slot,
    bankName: "",
    accountName: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
    branchName: "",
  };
}

export default function QuotationOptionsSettingsPage() {
  const [banks, setBanks] = useState<BankDetail[]>([
    1, 2, 3,
  ].map(emptyBank));

  const [termsConditions, setTermsConditions] = useState<
    TermsCondition[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
          [1, 2, 3].map((slot) => {
            const bank = (data.banks ?? []).find(
              (item: BankDetail) => item.slot === slot
            );

            return bank
              ? { ...emptyBank(slot), ...bank }
              : emptyBank(slot);
          })
        );

        setTermsConditions(
          (data.termsConditions ?? []).map(
            (row: TermsCondition) => ({ ...row })
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
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

  function updateBank(
    slot: number,
    field:
      | "bankName"
      | "accountName"
      | "accountNumber"
      | "iban"
      | "swiftCode"
      | "branchName",
    value: string
  ) {
    setBanks((current) =>
      current.map((bank) =>
        bank.slot === slot ? { ...bank, [field]: value } : bank
      )
    );
  }

  function updateTerms(
    index: number,
    field: keyof TermsCondition,
    value: string | boolean
  ) {
    setTermsConditions((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addTermsTemplate() {
    setTermsConditions((current) => [
      ...current,
      {
        id: null,
        serviceType: "UMRAH_VISA",
        title: "",
        content: "",
        isActive: true,
      },
    ]);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const incompleteRow = termsConditions.find(
        (row) => !row.title.trim() || !row.content.trim()
      );

      if (incompleteRow) {
        throw new Error(
          "Complete the title and text for every terms & conditions template, or remove the empty row."
        );
      }

      const response = await fetch("/api/quotation-options", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banks: banks.map((bank) => ({
            slot: bank.slot,
            bankName: bank.bankName,
            accountName: bank.accountName,
            accountNumber: bank.accountNumber,
            iban: bank.iban ?? "",
            swiftCode: bank.swiftCode ?? "",
            branchName: bank.branchName ?? "",
          })),
          termsConditions,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to save quotation options."
        );
      }

      setBanks(
        [1, 2, 3].map((slot) => {
          const bank = (data.banks ?? []).find(
            (item: BankDetail) => item.slot === slot
          );

          return bank
            ? { ...emptyBank(slot), ...bank }
            : emptyBank(slot);
        })
      );

      setTermsConditions(
        (data.termsConditions ?? []).map(
          (row: TermsCondition) => ({ ...row })
        )
      );

      setMessage(
        "Bank details and terms & conditions saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save quotation options."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6 sm:p-8">
        <div className="mx-auto max-w-6xl animate-pulse rounded-2xl bg-white p-10 text-sm text-[#667085]">
          Loading quotation options…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
              Settings
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1F2933]">
              Quotation Options
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Save three company bank accounts and reusable terms &
              conditions by service type. Pick two bank accounts when
              generating each quotation.
            </p>
          </div>

          <Link
            href="/quotations/new"
            className="inline-flex w-fit rounded-xl bg-[#0F6B5B] px-4 py-3 text-sm font-bold text-white hover:bg-[#0A4F44]"
          >
            Back to New Quotation
          </Link>
        </div>

        {(error || message) && (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">
                Bank Details
              </h2>

              <p className="mt-1 text-sm text-[#667085]">
                Maintain three bank account slots. Only completed accounts
                will be available to select on a quotation.
              </p>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {banks.map((bank) => (
                <div
                  key={bank.slot}
                  className="rounded-xl border border-[#E4E7EC] bg-[#FAFAF8] p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-[#1F2933]">
                      Bank Account {bank.slot}
                    </h3>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#667085]">
                      Slot {bank.slot}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-[#344054]">
                      Bank Name
                      <input
                        value={bank.bankName}
                        onChange={(event) =>
                          updateBank(
                            bank.slot,
                            "bankName",
                            event.target.value
                          )
                        }
                        maxLength={150}
                        placeholder="e.g. Al Rajhi Bank"
                        className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>

                    <label className="text-xs font-semibold text-[#344054]">
                      Account Name
                      <input
                        value={bank.accountName}
                        onChange={(event) =>
                          updateBank(
                            bank.slot,
                            "accountName",
                            event.target.value
                          )
                        }
                        maxLength={150}
                        placeholder="Account holder name"
                        className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>

                    <label className="text-xs font-semibold text-[#344054]">
                      Account Number
                      <input
                        value={bank.accountNumber}
                        onChange={(event) =>
                          updateBank(
                            bank.slot,
                            "accountNumber",
                            event.target.value
                          )
                        }
                        maxLength={100}
                        placeholder="Account number"
                        className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>

                    <label className="text-xs font-semibold text-[#344054]">
                      IBAN
                      <input
                        value={bank.iban ?? ""}
                        onChange={(event) =>
                          updateBank(
                            bank.slot,
                            "iban",
                            event.target.value
                          )
                        }
                        maxLength={100}
                        placeholder="IBAN"
                        className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>

                    <label className="text-xs font-semibold text-[#344054]">
                      SWIFT / BIC
                      <input
                        value={bank.swiftCode ?? ""}
                        onChange={(event) =>
                          updateBank(
                            bank.slot,
                            "swiftCode",
                            event.target.value
                          )
                        }
                        maxLength={50}
                        placeholder="Optional"
                        className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>

                    <label className="text-xs font-semibold text-[#344054]">
                      Branch
                      <input
                        value={bank.branchName ?? ""}
                        onChange={(event) =>
                          updateBank(
                            bank.slot,
                            "branchName",
                            event.target.value
                          )
                        }
                        maxLength={150}
                        placeholder="Optional branch"
                        className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#1F2933]">
                  Service Terms & Conditions
                </h2>

                <p className="mt-1 text-sm text-[#667085]">
                  Create reusable templates for each service type. A
                  quotation can select one template for each service type
                  it contains.
                </p>
              </div>

              <button
                type="button"
                onClick={addTermsTemplate}
                className="inline-flex w-fit rounded-lg border border-[#0F6B5B]/30 bg-[#0F6B5B]/5 px-3 py-2.5 text-xs font-bold text-[#0F6B5B] hover:bg-[#0F6B5B]/10"
              >
                + Add Terms Template
              </button>
            </div>

            {termsConditions.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-[#D0D5DD] px-4 py-8 text-center text-sm text-[#667085]">
                No terms & conditions templates yet. Select “Add Terms
                Template” to create one.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {termsConditions.map((row, index) => (
                  <div
                    key={row.id ?? `new-${index}`}
                    className="rounded-xl border border-[#E4E7EC] p-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="text-xs font-semibold text-[#344054]">
                        Service Type
                        <select
                          value={row.serviceType}
                          onChange={(event) =>
                            updateTerms(
                              index,
                              "serviceType",
                              event.target.value
                            )
                          }
                          className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                        >
                          {SERVICE_TYPES.map((service) => (
                            <option
                              key={service.value}
                              value={service.value}
                            >
                              {service.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs font-semibold text-[#344054]">
                        Template Title
                        <input
                          value={row.title}
                          onChange={(event) =>
                            updateTerms(index, "title", event.target.value)
                          }
                          maxLength={150}
                          placeholder="e.g. Air Ticket Conditions"
                          className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#0F6B5B]"
                        />
                      </label>
                    </div>

                    <label className="mt-4 block text-xs font-semibold text-[#344054]">
                      Terms & Conditions Text
                      <textarea
                        value={row.content}
                        onChange={(event) =>
                          updateTerms(index, "content", event.target.value)
                        }
                        rows={5}
                        maxLength={10000}
                        placeholder="Write the terms and conditions..."
                        className="mt-1.5 w-full resize-y rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm font-normal leading-6 outline-none focus:border-[#0F6B5B]"
                      />
                    </label>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setTermsConditions((current) =>
                            current.filter(
                              (_, rowIndex) => rowIndex !== index
                            )
                          )
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        Remove Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/quotations/new"
              className="rounded-xl border border-[#D0D5DD] bg-white px-5 py-3 text-center text-sm font-bold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Quotation Options"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}