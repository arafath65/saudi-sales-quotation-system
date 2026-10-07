
import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const COMPANY_LOGO_DIRECTORY = "company-logos";

function getStorageRoot() {
  return process.env.APP_DATA_DIR
    ? path.join(process.env.APP_DATA_DIR, COMPANY_LOGO_DIRECTORY)
    : path.join(process.cwd(), "data", COMPANY_LOGO_DIRECTORY);
}

export async function ensureCompanyStorage() {
  const directory = getStorageRoot();

  await fs.mkdir(directory, {
    recursive: true,
  });

  return directory;
}

export function getLogoFilePath(filename: string) {
  return path.join(getStorageRoot(), filename);
}

export function getLogoUrl(filename: string) {
  return `/api/company-settings/logo/${encodeURIComponent(filename)}`;
}

export function createLogoFilename(
  originalName: string,
  mimeType: string
) {
  const extensionMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };

  const mappedExtension = extensionMap[mimeType];
  const originalExtension = path.extname(originalName).toLowerCase();

  const extension =
    mappedExtension ?? (originalExtension || ".bin");

  return `${randomUUID()}${extension}`;
}

export async function deleteLogoFile(filename: string | null) {
  if (!filename) {
    return;
  }

  try {
    await fs.unlink(getLogoFilePath(filename));
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : "";

    if (code !== "ENOENT") {
      throw error;
    }
  }
}