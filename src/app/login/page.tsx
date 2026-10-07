"use client";

import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";

export default function LoginPage() {
  const router = useRouter();

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!pageRef.current) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      gsap.set(".login-panel", {
        opacity: 0,
        scale: 0.98,
        y: 18,
      });

      gsap.set(".login-brand", {
        opacity: 0,
        scale: 0.85,
      });

      gsap.set(".login-title", {
        opacity: 0,
        y: 12,
      });

      gsap.set(".login-subtitle", {
        opacity: 0,
        y: 8,
      });

      gsap.set(".login-field", {
        opacity: 0,
        x: 15,
      });

      gsap.set(".login-button", {
        opacity: 0,
        y: 10,
      });

      gsap.set(".login-footer", {
        opacity: 0,
      });

      timeline
        .to(".login-panel", {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.65,
        })
        .to(
          ".login-brand",
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
          },
          "-=0.35"
        )
        .to(
          ".login-title",
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
          },
          "-=0.2"
        )
        .to(
          ".login-subtitle",
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
          },
          "-=0.2"
        )
        .to(
          ".login-field",
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.08,
          },
          "-=0.1"
        )
        .to(
          ".login-button",
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
          },
          "-=0.12"
        )
        .to(
          ".login-footer",
          {
            opacity: 1,
            duration: 0.3,
          },
          "-=0.1"
        );
    }, pageRef);

    return () => {
      context.revert();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (!username.trim()) {
      setError("Please enter your username.");
      usernameRef.current?.focus();
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "The login API did not return JSON. Please restart the development server."
        );
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Invalid username or password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the application."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleUsernameKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      passwordRef.current?.focus();
    }
  }

  return (
    <main
      ref={pageRef}
      className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[#F7F8F6] px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5"
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#0F6B5B]/5 blur-3xl" />
        <div className="absolute -bottom-36 -right-36 h-96 w-96 rounded-full bg-[#C9A227]/5 blur-3xl" />
      </div>

      <div className="relative flex h-full w-full items-center justify-center">
        <div className="login-panel flex h-full max-h-[760px] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_20px_60px_rgba(15,107,91,0.12)] lg:rounded-[26px]">
          {/* LEFT PANEL */}
          <section className="relative hidden w-[46%] overflow-hidden bg-[#0F6B5B] p-8 text-white sm:p-10 lg:flex lg:flex-col lg:justify-between xl:p-12">
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" />

            <div className="relative z-10">
              <div className="login-brand flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
                <span className="text-xl font-black text-[#0F6B5B]">
                  I
                </span>
              </div>

              <h1 className="login-title mt-8 text-3xl font-bold leading-[1.08] tracking-tight xl:text-4xl">
                Sales &amp;
                <br />
                Quotation
                <br />
                Management
              </h1>

              <p className="login-subtitle mt-5 max-w-sm text-sm leading-6 text-white/75">
                Manage customers, quotations, invoices and payments
                efficiently from one simple business system.
              </p>
            </div>

            <div className="login-footer relative z-10 border-t border-white/15 pt-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                Developed by
              </p>

              <p className="mt-1 text-sm font-semibold text-[#E5C45A]">
                Innovex Web Solutions
              </p>
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section className="flex min-w-0 flex-1 items-center justify-center p-5 sm:p-7 md:p-9 lg:p-10 xl:p-12">
            <div className="w-full max-w-md">
              {/* Mobile brand */}
              <div className="mb-5 lg:hidden">
                <div className="login-brand flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F6B5B] shadow-md">
                  <span className="text-lg font-black text-white">
                    I
                  </span>
                </div>
              </div>

              <div>
                <p className="login-title text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                  Welcome Back
                </p>

                <h2 className="login-title mt-2 text-2xl font-bold tracking-tight text-[#1F2933] sm:text-3xl">
                  Sign in to your account
                </h2>

                <p className="login-subtitle mt-2 text-xs leading-5 text-[#667085] sm:text-sm">
                  Enter your credentials to continue to the management
                  system.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >
                {/* Username */}
                <div className="login-field">
                  <label
                    htmlFor="username"
                    className="block text-xs font-semibold text-[#1F2933] sm:text-sm"
                  >
                    Username
                  </label>

                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    onKeyDown={handleUsernameKeyDown}
                    placeholder="Enter your username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={loading}
                    className="mt-1.5 w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-3 text-sm text-[#1F2933] outline-none transition duration-200 placeholder:text-[#98A2B3] hover:border-[#98A2B3] focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10 disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
                  />
                </div>

                {/* Password */}
                <div className="login-field">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-[#1F2933] sm:text-sm"
                  >
                    Password
                  </label>

                  <div className="relative mt-1.5">
                    <input
                      ref={passwordRef}
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={loading}
                      className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-3 pr-16 text-sm text-[#1F2933] outline-none transition duration-200 placeholder:text-[#98A2B3] hover:border-[#98A2B3] focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10 disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      tabIndex={-1}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-[#0F6B5B] transition hover:bg-[#0F6B5B]/5"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="login-field rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="login-button group w-full rounded-xl bg-[#0F6B5B] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#0F6B5B]/15 transition-all duration-200 hover:bg-[#0A4F44] hover:shadow-xl hover:shadow-[#0F6B5B]/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <span className="transition-transform duration-200 group-hover:translate-x-1">
                          →
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="login-footer mt-5 border-t border-[#E4E7EC] pt-4 text-center">
                <p className="text-[10px] text-[#98A2B3] sm:text-xs">
                  Offline Business Management System
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}