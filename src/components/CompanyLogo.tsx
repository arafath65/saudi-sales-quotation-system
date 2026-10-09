"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type CompanyLogoProps = {
  variant?: "nav" | "mobile" | "login";
};

type LogoResponse = {
  success?: boolean;
  logo1Path?: string | null;
};

const styles = {
  nav: {
    wrapper:
      "h-11 w-11 rounded-xl border border-white/20 bg-white p-1.5 shadow-sm",
    size: 44,
  },
  mobile: {
    wrapper:
      "h-10 w-10 rounded-xl border border-[#E4E7EC] bg-white p-1.5 shadow-sm",
    size: 40,
  },
  login: {
    wrapper:
      "h-20 w-20 rounded-2xl border border-[#E4E7EC] bg-white p-2 shadow-lg",
    size: 80,
  },
} as const;

export default function CompanyLogo({
  variant = "nav",
}: CompanyLogoProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLogo() {
      try {
        const response = await fetch("/api/public/company-logo", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as LogoResponse;
        const filename = data.logo1Path?.trim();

        if (!cancelled && data.success && filename) {
          setLogoSrc(
            `/api/company-settings/logo/${encodeURIComponent(filename)}`
          );
        }
      } catch (error) {
        console.error("Unable to load company logo:", error);
      }
    }

    void loadLogo();

    return () => {
      cancelled = true;
    };
  }, []);

  const style = styles[variant];

  return (
    <div
      aria-label="Company logo"
      className={`flex shrink-0 items-center justify-center overflow-hidden ${style.wrapper}`}
    >
      {logoSrc && !imageFailed ? (
        <Image
          src={logoSrc}
          alt="Company logo"
          width={style.size}
          height={style.size}
          unoptimized
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-2xl font-black text-[#0F6B5B]">
          S
        </span>
      )}
    </div>
  );
}