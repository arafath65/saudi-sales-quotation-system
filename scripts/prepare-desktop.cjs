
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const staticDir = path.join(projectRoot, ".next", "static");
const publicDir = path.join(projectRoot, "public");
const runtimeDir = path.join(projectRoot, "desktop-runtime");

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(destination, { recursive: true });

  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    dereference: true,
  });
}

// Restore missing dependencies required by Next.js.
// Copy only Next.js and its dependency tree, not the entire
// development node_modules directory.
function ensurePackage(packageName, visited = new Set()) {
  if (visited.has(packageName)) {
    return;
  }

  visited.add(packageName);

  const sourcePackage = path.join(
    projectRoot,
    "node_modules",
    ...packageName.split("/")
  );

  const destinationPackage = path.join(
    runtimeDir,
    "node_modules",
    ...packageName.split("/")
  );

  const sourceManifest = path.join(sourcePackage, "package.json");

  if (!fs.existsSync(sourceManifest)) {
    return;
  }

  const destinationManifest = path.join(
    destinationPackage,
    "package.json"
  );

  if (!fs.existsSync(destinationManifest)) {
    copyDirectory(sourcePackage, destinationPackage);
  }

  const manifest = JSON.parse(
    fs.readFileSync(sourceManifest, "utf8")
  );

  const dependencies = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  };

  for (const dependencyName of Object.keys(dependencies)) {
    ensurePackage(dependencyName, visited);
  }
}

function main() {
  if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
    throw new Error(
      `Standalone server not found:\n${path.join(standaloneDir, "server.js")}\n\n` +
      "Make sure next.config.ts contains output: 'standalone' and run npm run build."
    );
  }

  console.log("Preparing desktop runtime...");

  // Remove the previous runtime to prevent stale files.
  fs.rmSync(runtimeDir, {
    recursive: true,
    force: true,
  });

  fs.mkdirSync(runtimeDir, { recursive: true });

  // Copy the complete Next.js standalone output.
  copyDirectory(standaloneDir, runtimeDir);

  // Restore any missing Next.js dependencies.
  ensurePackage("next");

  // Next.js standalone does not automatically include these folders.
  if (fs.existsSync(staticDir)) {
    copyDirectory(
      staticDir,
      path.join(runtimeDir, ".next", "static")
    );
  }

  if (fs.existsSync(publicDir)) {
    copyDirectory(publicDir, path.join(runtimeDir, "public"));
  }

  // Validate the output before allowing installer packaging.
  const serverFile = path.join(runtimeDir, "server.js");
  const nextManifest = path.join(
    runtimeDir,
    "node_modules",
    "next",
    "package.json"
  );

  if (!fs.existsSync(serverFile)) {
    throw new Error(`Runtime server.js is missing: ${serverFile}`);
  }

  if (!fs.existsSync(nextManifest)) {
    throw new Error(
      `Next.js is missing from the runtime: ${nextManifest}\n` +
      "Check that next is installed in the project node_modules folder."
    );
  }

  const nextPackage = JSON.parse(
    fs.readFileSync(nextManifest, "utf8")
  );

  console.log("Desktop runtime prepared successfully.");
  console.log(`Runtime: ${runtimeDir}`);
  console.log(`Server: ${serverFile}`);
  console.log(`Next.js version: ${nextPackage.version}`);
  console.log("Verified: runtime/node_modules/next/package.json");
}

try {
  main();
} catch (error) {
  console.error("Desktop runtime preparation failed:");
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
