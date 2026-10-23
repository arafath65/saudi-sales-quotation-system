const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const targets = [
  "desktop-runtime",
  "release",
  path.join(".next", "standalone"),
];

for (const relativePath of targets) {
  const targetPath = path.join(projectRoot, relativePath);

  console.log(`Cleaning ${relativePath}...`);

  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 250,
  });
}

console.log("Desktop build directories cleaned successfully.");