
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { mkdtemp, rm } = require("node:fs/promises");

const projectRoot = path.resolve(__dirname, "..");
const source = path.join(projectRoot, "electron", "logo-source.png");
const destination = path.join(
  projectRoot,
  "electron",
  "saudi-sales-quotation.ico"
);

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(
      `Logo image not found: ${source}\n` +
      "Save your square logo as electron/logo-source.png first."
    );
  }

  const pngToIcoModule = await import("png-to-ico");
  const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

  const sharpModule = await import("sharp");
  const sharp = sharpModule.default ?? sharpModule;

  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "saudi-sales-icons-")
  );

  try {
    // Generate standard Windows icon sizes from the original logo.
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const iconPaths = [];

    for (const size of sizes) {
      const outputPath = path.join(tempDir, `icon-${size}.png`);

      await sharp(source)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(outputPath);

      iconPaths.push(outputPath);
    }

    const iconBuffer = await pngToIco(iconPaths);
    fs.writeFileSync(destination, iconBuffer);

    console.log("Windows icon generated successfully:");
    console.log(destination);
    console.log("Included sizes:", sizes.join(", "), "pixels");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Icon generation failed:", error);
  process.exitCode = 1;
});
