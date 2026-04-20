import fs from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getUploadRootPath(): string {
  return UPLOAD_ROOT;
}

export function buildPublicFileUrl(...segments: string[]): string {
  return `/files/${segments.map((segment) => sanitizeFileName(segment)).join("/")}`;
}

export async function ensureDirectory(relativeDirectory: string): Promise<string> {
  const absoluteDirectory = path.join(UPLOAD_ROOT, relativeDirectory);
  await fs.mkdir(absoluteDirectory, { recursive: true });
  return absoluteDirectory;
}

export async function saveBufferToUpload(
  relativeDirectory: string,
  fileName: string,
  buffer: Buffer
): Promise<{ absolutePath: string; publicUrl: string }> {
  const directory = await ensureDirectory(relativeDirectory);
  const safeFileName = sanitizeFileName(fileName);
  const absolutePath = path.join(directory, safeFileName);

  await fs.writeFile(absolutePath, buffer);

  return {
    absolutePath,
    publicUrl: buildPublicFileUrl(...relativeDirectory.split(path.sep), safeFileName),
  };
}

export async function deleteUploadedFile(publicUrl?: string | null): Promise<void> {
  if (!publicUrl || !publicUrl.startsWith("/files/")) {
    return;
  }

  const relativePath = publicUrl.replace("/files/", "");
  const absolutePath = path.join(UPLOAD_ROOT, relativePath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code !== "ENOENT") {
      throw error;
    }
  }
}

export function createTimestampedFileName(originalName: string): string {
  const extension = path.extname(originalName || "");
  const baseName = path.basename(originalName || "file", extension);
  const safeBaseName = sanitizeFileName(baseName || "file");

  return `${Date.now()}-${safeBaseName}${extension}`;
}
