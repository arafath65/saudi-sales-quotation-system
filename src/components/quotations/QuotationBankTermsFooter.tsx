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

type Props = {
  bankDetails: BankDetailSnapshot[] | null | undefined;
  termsConditions: TermsConditionSnapshot[] | null | undefined;
};

export default function QuotationBankTermsFooter({
  bankDetails,
  termsConditions,
}: Props) {
  const banks = Array.isArray(bankDetails)
    ? bankDetails.slice(0, 2)
    : [];

  const terms = Array.isArray(termsConditions)
    ? termsConditions
    : [];

  if (banks.length === 0 && terms.length === 0) return null;

  return (
    <section className="quotation-bank-terms mx-6 mb-6 border-t border-[#E4E7EC] px-0 pt-5 sm:mx-8">
      {banks.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0F6B5B]">
            Bank Details
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {banks.map((bank, index) => (
              <div
                key={`${bank.bankName}-${index}`}
                className="min-w-0 rounded-lg border border-[#E4E7EC] p-3"
              >
                <h3 className="break-words text-xs font-black text-[#1F2933]">
                  {bank.bankName}
                </h3>

                <div className="mt-2 space-y-1 text-[10px] leading-4 text-[#475467]">
                  <p>
                    <span className="font-bold">Account Name:</span>{" "}
                    <span className="break-words">{bank.accountName}</span>
                  </p>

                  <p>
                    <span className="font-bold">Account No:</span>{" "}
                    <span className="break-all">{bank.accountNumber}</span>
                  </p>

                  {bank.iban && (
                    <p>
                      <span className="font-bold">IBAN:</span>{" "}
                      <span className="break-all">{bank.iban}</span>
                    </p>
                  )}

                  {bank.swiftCode && (
                    <p>
                      <span className="font-bold">SWIFT / BIC:</span>{" "}
                      <span className="break-all">{bank.swiftCode}</span>
                    </p>
                  )}

                  {bank.branchName && (
                    <p>
                      <span className="font-bold">Branch:</span>{" "}
                      <span className="break-words">{bank.branchName}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {terms.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0F6B5B]">
            Terms & Conditions
          </h2>

          <div className="mt-2 space-y-3">
            {terms.map((term, index) => (
              <div
                key={`${term.serviceType}-${term.title}-${index}`}
                className="break-inside-avoid"
              >
                <h3 className="text-[11px] font-black text-[#1F2933]">
                  {term.serviceLabel || term.serviceType.replaceAll("_", " ")}
                  {" — "}
                  {term.title}
                </h3>

                <p className="mt-1 whitespace-pre-line break-words text-[10px] leading-4 text-[#475467]">
                  {term.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}