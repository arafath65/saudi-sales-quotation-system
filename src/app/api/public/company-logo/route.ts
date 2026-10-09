import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.companySettings.findUnique({
      where: {
        id: 1,
      },
      select: {
        logo1Path: true,
      },
    });

    const filename = settings?.logo1Path
      ? settings.logo1Path.split(/[\\/]/).pop() ?? null
      : null;

    return NextResponse.json(
      {
        success: true,
        logo1Path: filename,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Public company logo error:", error);

    return NextResponse.json(
      {
        success: false,
        logo1Path: null,
      },
      { status: 500 }
    );
  }
}