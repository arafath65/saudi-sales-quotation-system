import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import { getLogoFilePath } from "@/lib/company-storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ filename: string }>;
  }
) {
  try {
    const { filename } = await params;

    const safeFilename = path.basename(filename);

    if (!safeFilename || safeFilename !== filename) {
      return new NextResponse("Not Found", {
        status: 404,
      });
    }

    const filePath = getLogoFilePath(safeFilename);

    const file = await fs.readFile(filePath);

    const extension = path.extname(safeFilename).toLowerCase();

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type":
          CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not Found", {
      status: 404,
    });
  }
}