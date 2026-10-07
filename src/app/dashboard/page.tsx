import { redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/auth";

export default async function DashboardPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-[#1F2933]">
          Dashboard
        </h1>

        <p className="mt-2 text-[#667085]">
          Saudi Sales & Quotation Management System
        </p>
      </div>
    </main>
  );
}