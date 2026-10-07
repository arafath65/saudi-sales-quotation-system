"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";

type CompanySettings = {
  id: number;
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

type LogoSlot = 1 | 2 | 3;

function logoUrl(path: string | null) {
  if (!path) {
    return null;
  }

  return `/api/company-settings/logo/${encodeURIComponent(
    path
  )}`;
}

export default function CompanySettingsPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] =
    useState<CompanySettings | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [taxNumber, setTaxNumber] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] =
    useState<LogoSlot | null>(null);
  const [removingSlot, setRemovingSlot] =
    useState<LogoSlot | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  useLayoutEffect(() => {
    if (!pageRef.current || loading) {
      return;
    }

    const context = gsap.context(() => {
      gsap.from(".settings-header", {
        opacity: 0,
        y: 14,
        duration: 0.45,
        ease: "power3.out",
      });

      gsap.from(".settings-card", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        stagger: 0.08,
        delay: 0.08,
        ease: "power3.out",
      });
    }, pageRef);

    return () => {
      context.revert();
    };
  }, [loading]);

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/company-settings", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to load company settings."
        );
      }

      const value = data.settings as CompanySettings | null;

      setSettings(value);

      if (value) {
        setCompanyName(value.companyName ?? "");
        setAddress(value.address ?? "");
        setPhone(value.phone ?? "");
        setEmail(value.email ?? "");
        setWebsite(value.website ?? "");
        setTaxNumber(value.taxNumber ?? "");
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load company settings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyName.trim()) {
      setError("Company name is required.");
      setMessage("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/company-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          website: website.trim(),
          taxNumber: taxNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to save company settings."
        );
      }

      setSettings(data.settings);
      setMessage("Company settings saved successfully.");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save company settings."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(
    slot: LogoSlot,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setUploadingSlot(slot);
      setError("");
      setMessage("");

      const formData = new FormData();

      formData.append("slot", String(slot));
      formData.append("file", file);

      const response = await fetch("/api/company-settings/logo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to upload logo."
        );
      }

      await loadSettings();
      setMessage(`Logo ${slot} uploaded successfully.`);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload logo."
      );
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleLogoRemove(slot: LogoSlot) {
    try {
      setRemovingSlot(slot);
      setError("");
      setMessage("");

      const response = await fetch("/api/company-settings/logo", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slot,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to remove logo."
        );
      }

      await loadSettings();
      setMessage(`Logo ${slot} removed successfully.`);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove logo."
      );
    } finally {
      setRemovingSlot(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[#E4E7EC]" />
          <div className="mt-3 h-4 w-96 animate-pulse rounded bg-[#E4E7EC]" />

          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-white border border-[#E4E7EC]" />
        </div>
      </main>
    );
  }

  const logos = [
    {
      slot: 1 as LogoSlot,
      path: settings?.logo1Path ?? null,
    },
    {
      slot: 2 as LogoSlot,
      path: settings?.logo2Path ?? null,
    },
    {
      slot: 3 as LogoSlot,
      path: settings?.logo3Path ?? null,
    },
  ];

  return (
    <main
      ref={pageRef}
      className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="settings-header">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
            Settings
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1F2933]">
            Company Settings
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            Manage the company details and logos displayed on
            quotations and invoices.
          </p>
        </div>

        {(message || error) && (
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

        <form onSubmit={handleSave} className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* Company Information */}
            <section className="settings-card rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-[#1F2933]">
                  Company Information
                </h2>

                <p className="mt-1 text-sm text-[#667085]">
                  These details will appear on generated documents.
                </p>
              </div>

              <div className="mt-6 grid gap-5">
                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-sm font-semibold text-[#1F2933]"
                  >
                    Company Name
                  </label>

                  <input
                    id="companyName"
                    value={companyName}
                    onChange={(event) =>
                      setCompanyName(event.target.value)
                    }
                    placeholder="Enter company name"
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-semibold text-[#1F2933]"
                  >
                    Address
                  </label>

                  <textarea
                    id="address"
                    rows={3}
                    value={address}
                    onChange={(event) =>
                      setAddress(event.target.value)
                    }
                    placeholder="Enter company address"
                    className="mt-2 w-full resize-none rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-semibold text-[#1F2933]"
                    >
                      Phone
                    </label>

                    <input
                      id="phone"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      placeholder="Enter phone number"
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-[#1F2933]"
                    >
                      Email
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="Enter email address"
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="website"
                      className="block text-sm font-semibold text-[#1F2933]"
                    >
                      Website
                    </label>

                    <input
                      id="website"
                      value={website}
                      onChange={(event) =>
                        setWebsite(event.target.value)
                      }
                      placeholder="https://example.com"
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="taxNumber"
                      className="block text-sm font-semibold text-[#1F2933]"
                    >
                      Tax / VAT Number
                    </label>

                    <input
                      id="taxNumber"
                      value={taxNumber}
                      onChange={(event) =>
                        setTaxNumber(event.target.value)
                      }
                      placeholder="Enter tax number"
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none transition focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#E4E7EC] pt-5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            </section>

            {/* Logos */}
            <section className="settings-card rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-[#1F2933]">
                  Company Logos
                </h2>

                <p className="mt-1 text-sm text-[#667085]">
                  Add up to three logos for quotations and invoices.
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {logos.map((logo) => {
                  const preview = logoUrl(logo.path);
                  const uploading = uploadingSlot === logo.slot;
                  const removing = removingSlot === logo.slot;

                  return (
                    <div
                      key={logo.slot}
                      className="rounded-2xl border border-[#E4E7EC] bg-[#FAFAF8] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#1F2933]">
                            Logo {logo.slot}
                          </h3>

                          <p className="mt-1 text-xs text-[#667085]">
                            JPG, PNG, WEBP, GIF or SVG · Max 5 MB
                          </p>
                        </div>

                        <div className="rounded-full bg-[#0F6B5B]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0F6B5B]">
                          {preview ? "Uploaded" : "Not Set"}
                        </div>
                      </div>

                      <div className="mt-4 flex min-h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#D0D5DD] bg-white">
                        {preview ? (
                          <img
                            src={preview}
                            alt={`Company logo ${logo.slot}`}
                            className="max-h-28 max-w-[85%] object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <div className="text-3xl font-light text-[#C5CBD3]">
                              +
                            </div>

                            <p className="mt-1 text-xs text-[#98A2B3]">
                              No logo uploaded
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <label className="flex-1 cursor-pointer rounded-xl border border-[#0F6B5B] bg-white px-4 py-2.5 text-center text-xs font-bold text-[#0F6B5B] transition hover:bg-[#0F6B5B]/5">
                          {uploading ? "Uploading..." : "Upload Logo"}

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                            onChange={(event) =>
                              handleLogoUpload(
                                logo.slot,
                                event
                              )
                            }
                            disabled={uploading || removing}
                            className="hidden"
                          />
                        </label>

                        {preview && (
                          <button
                            type="button"
                            onClick={() =>
                              handleLogoRemove(logo.slot)
                            }
                            disabled={uploading || removing}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {removing ? "Removing..." : "Remove"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </form>
      </div>
    </main>
  );
}