import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import {
  createLogoFilename,
  deleteLogoFile,
  ensureCompanyStorage,
  getLogoFilePath,
  getLogoUrl,
} from "@/lib/company-storage";

type LogoSlot = 1 | 2 | 3;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function parseSlot(value: FormDataEntryValue | null): LogoSlot | null {
  if (typeof value !== "string") {
    return null;
  }

  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as LogoSlot;
  }

  return null;
}

async function requireAdmin() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive || user.role !== "ADMIN") {
    return null;
  }

  return user;
}

function getLogoField(slot: LogoSlot) {
  if (slot === 1) return "logo1Path";
  if (slot === 2) return "logo2Path";
  return "logo3Path";
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const slot = parseSlot(formData.get("slot"));
    const file = formData.get("file");

    if (!slot) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid logo slot.",
        },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select an image.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG, WEBP, GIF or SVG images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Logo file size must not exceed 5 MB.",
        },
        { status: 400 }
      );
    }

    const directory = await ensureCompanyStorage();

    const filename = createLogoFilename(file.name, file.type);
    const filePath = path.join(directory, filename);

    const buffer = Buffer.from(await file.arrayBuffer());

    await fs.writeFile(filePath, buffer);

    const field = getLogoField(slot);

    const existingSettings = await prisma.companySettings.findUnique({
      where: {
        id: 1,
      },
    });

    const oldPath = existingSettings?.[field] ?? null;

    const settings = await prisma.companySettings.upsert({
      where: {
        id: 1,
      },
      create: {
        id: 1,
        companyName: "Company Name",
        [field]: filename,
      },
      update: {
        [field]: filename,
      },
    });

    if (oldPath) {
      await deleteLogoFile(path.basename(oldPath));
    }

    return NextResponse.json({
      success: true,
      message: `Logo ${slot} uploaded successfully.`,
      logo: {
        slot,
        filename,
        url: getLogoUrl(filename),
      },
      settings,
    });
  } catch (error) {
    console.error("Company logo upload error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to upload logo.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const slot = parseSlot(body.slot);

    if (!slot) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid logo slot.",
        },
        { status: 400 }
      );
    }

    const field = getLogoField(slot);

    const settings = await prisma.companySettings.findUnique({
      where: {
        id: 1,
      },
    });

    if (!settings) {
      return NextResponse.json({
        success: true,
        message: "No company settings found.",
      });
    }

    const existingPath = settings[field];

    await prisma.companySettings.update({
      where: {
        id: 1,
      },
      data: {
        [field]: null,
      },
    });

    if (existingPath) {
      await deleteLogoFile(path.basename(existingPath));
    }

    return NextResponse.json({
      success: true,
      message: `Logo ${slot} removed successfully.`,
    });
  } catch (error) {
    console.error("Company logo delete error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to remove logo.",
      },
      { status: 500 }
    );
  }
}