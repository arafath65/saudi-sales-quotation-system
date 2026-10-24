const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const componentRelative = "src/components/documents/CompanyDocumentHeader.tsx";
const componentSource = path.resolve(__dirname, "", "CompanyDocumentHeader.tsx");

const files = {
  settings: "src/app/settings/company/page.tsx",
  quotation: "src/app/quotations/[id]/page.tsx",
  invoice: "src/app/invoices/[id]/page.tsx",
  hotel: "src/app/hotel-confirmations/[id]/page.tsx",
  settingsApi: "src/app/api/company-settings/route.ts",
};

function readRequired(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required project file not found: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function findElement(source, startIndex, tagName) {
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "g");
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let firstOpenEnd = -1;
  let match;

  while ((match = tagPattern.exec(source))) {
    const tag = match[0];
    const isClose = tag.startsWith(`</${tagName}`);
    const isSelfClosing = !isClose && /\/>$/.test(tag);

    if (isClose) {
      depth -= 1;
      if (depth === 0) {
        return {
          start: startIndex,
          openEnd: firstOpenEnd,
          closeStart: match.index,
          end: tagPattern.lastIndex,
          inner: source.slice(firstOpenEnd, match.index),
        };
      }
    } else if (!isSelfClosing) {
      if (depth === 0) firstOpenEnd = tagPattern.lastIndex;
      depth += 1;
    }
  }

  throw new Error(`Could not find matching </${tagName}> for element at offset ${startIndex}.`);
}

function findTagStart(source, searchFrom, tagName, marker) {
  const openPattern = new RegExp(`<${tagName}\\b[^>]*>`, "g");
  openPattern.lastIndex = searchFrom;
  let match;
  while ((match = openPattern.exec(source))) {
    if (match[0].includes(marker)) return match.index;
  }
  throw new Error(`Could not find <${tagName}> with marker: ${marker}`);
}

function directChildElements(source, parentElement, tagName) {
  const tokenPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "g");
  tokenPattern.lastIndex = parentElement.openEnd;
  const children = [];
  let depth = 0;
  let currentStart = -1;
  let match;

  while ((match = tokenPattern.exec(source)) && match.index < parentElement.closeStart) {
    const tag = match[0];
    const isClose = tag.startsWith(`</${tagName}`);
    const isSelfClosing = !isClose && /\/>$/.test(tag);

    if (isClose) {
      depth -= 1;
      if (depth === 0 && currentStart >= 0) {
        const block = findElement(source, currentStart, tagName);
        children.push(block);
        currentStart = -1;
        tokenPattern.lastIndex = block.end;
      }
    } else if (!isSelfClosing) {
      if (depth === 0) currentStart = match.index;
      depth += 1;
    }
  }

  return children;
}

function addImport(source, importLine) {
  if (source.includes(importLine)) return source;
  const useClientMatch = source.match(/^\s*["']use client["'];\s*/);
  if (useClientMatch) {
    const insertAt = useClientMatch[0].length;
    return `${source.slice(0, insertAt)}\n${importLine}\n${source.slice(insertAt)}`;
  }
  return `${importLine}\n${source}`;
}

function replaceDocumentHeader(source, options) {
  const headerStart = findTagStart(source, 0, "header", options.headerMarker);
  const header = findElement(source, headerStart, "header");
  const wrapperStart = findTagStart(source, header.openEnd, "div", options.wrapperMarker);
  const wrapper = findElement(source, wrapperStart, "div");
  const children = directChildElements(source, wrapper, "div");

  if (children.length < 2) {
    throw new Error(`Expected logo/details columns in header marked ${options.headerMarker}; found ${children.length}.`);
  }

  const metadata = source.slice(children[1].openEnd, children[1].closeStart).trim();
  const propText = [
    "company={company}",
    options.compact ? "compact" : "",
    options.showTaxNumber ? "showTaxNumber" : "",
  ].filter(Boolean).join(" ");
  const newHeader = `<CompanyDocumentHeader ${propText}>\n${metadata}\n          </CompanyDocumentHeader>`;

  return source.slice(0, header.start) + newHeader + source.slice(header.end);
}

function removeIfGuardContaining(source, phrase, conditionNeedle) {
  const phraseAt = source.indexOf(phrase);
  if (phraseAt < 0) return { source, changed: false };

  const candidateIfs = [...source.slice(0, phraseAt).matchAll(/if\s*\(/g)];
  for (let i = candidateIfs.length - 1; i >= 0; i -= 1) {
    const ifAt = candidateIfs[i].index;
    const parenStart = source.indexOf("(", ifAt);
    let parenDepth = 0;
    let parenEnd = -1;
    for (let p = parenStart; p < source.length; p += 1) {
      if (source[p] === "(") parenDepth += 1;
      if (source[p] === ")") {
        parenDepth -= 1;
        if (parenDepth === 0) {
          parenEnd = p;
          break;
        }
      }
    }
    if (parenEnd < 0) continue;
    const condition = source.slice(parenStart + 1, parenEnd);
    if (!condition.includes(conditionNeedle)) continue;
    const braceStart = source.indexOf("{", parenEnd);
    if (braceStart < 0 || braceStart > phraseAt) continue;

    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let p = braceStart; p < source.length; p += 1) {
      const ch = source[p];
      const next = source[p + 1];
      if (lineComment) {
        if (ch === "\n") lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === "*" && next === "/") { blockComment = false; p += 1; }
        continue;
      }
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "/" && next === "/") { lineComment = true; p += 1; continue; }
      if (ch === "/" && next === "*") { blockComment = true; p += 1; continue; }
      if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const end = p + 1;
          const guard = source.slice(ifAt, end);
          if (!guard.includes(phrase)) continue;
          return { source: source.slice(0, ifAt) + source.slice(end), changed: true };
        }
      }
    }
  }
  return { source, changed: false };
}

function alreadyPatched() {
  const settings = readRequired(files.settings);
  const quotation = readRequired(files.quotation);
  const invoice = readRequired(files.invoice);
  const hotel = readRequired(files.hotel);
  const componentDestination = path.join(root, componentRelative);
  const settingsApiFullPath = path.join(root, files.settingsApi);
  const apiStillRequiresName = fs.existsSync(settingsApiFullPath) &&
    fs.readFileSync(settingsApiFullPath, "utf8").includes("Company name is required.");

  return Boolean(
    settings.includes("(Optional)") &&
    quotation.includes("<CompanyDocumentHeader company={company}") &&
    invoice.includes("<CompanyDocumentHeader company={company}") &&
    hotel.includes("<CompanyDocumentHeader company={company}") &&
    !quotation.includes("Iqama Number:") &&
    !invoice.includes("Iqama Number:") &&
    !hotel.includes("Iqama Number:") &&
    fs.existsSync(componentDestination) &&
    !apiStillRequiresName
  );
}

if (alreadyPatched()) {
  console.log("Company document branding is already applied. No changes were made.");
  process.exit(0);
}

// Gather and transform all source files first; nothing gets written until every required transform succeeds.
const changes = new Map();

let settings = readRequired(files.settings);
const companyNameGuard = /if\s*\(\s*!companyName\.trim\(\)\s*\)\s*\{\s*setError\("Company name is required\."\);\s*setMessage\(""\);\s*return;\s*\}/;
if (companyNameGuard.test(settings)) {
  settings = settings.replace(companyNameGuard, "");
} else if (settings.includes("Company name is required.")) {
  throw new Error("Could not safely remove the company-name validation from settings page. Please update that guard manually or share the current file.");
}
settings = settings.replace(
  /(<label\s+htmlFor="companyName"[\s\S]*?>\s*Company Name)(\s*<\/label>)/,
  "$1 <span className=\"ml-1 text-xs font-normal text-[#98A2B3]\">(Optional)</span>$2",
);
changes.set(files.settings, settings);

let quotation = readRequired(files.quotation);
quotation = quotation.replace(/^import Image from "next\/image";\s*\n/m, "");
quotation = addImport(quotation, 'import CompanyDocumentHeader from "@/components/documents/CompanyDocumentHeader";');
const iqamaFetchStart = quotation.indexOf("      let customerIqamaNo:");
if (iqamaFetchStart >= 0) {
  const companyLoadAt = quotation.indexOf("      setCompany(data.company);", iqamaFetchStart);
  if (companyLoadAt < 0) throw new Error("Could not locate end of Iqama lookup in quotation page.");
  quotation = quotation.slice(0, iqamaFetchStart) + "      setQuotation(data.quotation);\n\n" + quotation.slice(companyLoadAt);
} else if (quotation.includes("customerIqamaNo")) {
  throw new Error("Quotation page still references Iqama but its lookup block did not match; no files have been written.");
}
quotation = quotation.replace(/\s*customerIqamaNo\?: string \| null;\s*/g, "\n");
quotation = quotation.replace(/\s*customer\?: \{\s*id\?: number;\s*iqamaNo\?: string \| null;\s*\} \| null;\s*/g, "\n");
quotation = quotation.replace(/\n\s*const logo1 = logoUrl\(company\?\.logo1Path \?\? null\);\s*\n\s*const logo2 = logoUrl\(company\?\.logo2Path \?\? null\);\s*\n\s*const logo3 = logoUrl\(company\?\.logo3Path \?\? null\);\s*/g, "\n");
quotation = quotation.replace(/function logoUrl\(path: string \| null\) \{[\s\S]*?\n\}\s*\n\nfunction money/, "function money");
quotation = replaceDocumentHeader(quotation, {
  headerMarker: 'className="border-b-4 border-[#0F6B5B] p-6 sm:p-8"',
  wrapperMarker: 'className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between"',
});
const iqamaParagraph = /\s*<p>\s*<span className="font-semibold text-\[#344054\]">\s*Iqama Number:\s*<\/span>\s*\{" "\}\s*\{quotation\.customerIqamaNo \|\| "—"\}\s*<\/p>/;
if (iqamaParagraph.test(quotation)) {
  quotation = quotation.replace(iqamaParagraph, "");
} else if (/Iqama Number:/.test(quotation)) {
  throw new Error("Could not safely remove the Iqama field from quotation customer section.");
}
quotation = quotation.replace(/\.quotation-page img \{\s*max-height: 16mm !important;\s*max-width: 34mm !important;\s*object-fit: contain !important;\s*\}/, ".quotation-page img:not(.company-document-logo) {\n            max-height: 16mm !important;\n            max-width: 34mm !important;\n            object-fit: contain !important;\n          }\n\n          .quotation-page .company-document-logo {\n            max-height: 40mm !important;\n            max-width: 76mm !important;\n            object-fit: contain !important;\n          }");
if (quotation.includes("Iqama Number:" ) || quotation.includes("customerIqamaNo")) {
  throw new Error("Quotation page still contains an Iqama customer display/reference after patch.");
}
changes.set(files.quotation, quotation);

let hotel = readRequired(files.hotel);
hotel = hotel.replace(/^import Image from "next\/image";\s*\n/m, "");
hotel = addImport(hotel, 'import CompanyDocumentHeader from "@/components/documents/CompanyDocumentHeader";');
hotel = hotel.replace(/function logoUrl\(path: string \| null\) \{[\s\S]*?\n\}\s*\n\n/, "");
hotel = hotel.replace(/\n\s*const logo1 = logoUrl\(company\?\.logo1Path\);\s*\n/, "\n");
hotel = replaceDocumentHeader(hotel, {
  headerMarker: 'className="border-b-4 border-[#0F6B5B] p-6 sm:p-8"',
  wrapperMarker: 'className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"',
});
hotel = hotel.replace(".hotel-receipt > header img {", ".hotel-receipt > header img:not(.company-document-logo) {");
hotel = hotel.replace(/(\.hotel-receipt > header img:not\(\.company-document-logo\) \{[\s\S]*?\n\s*\})/, "$1\n\n          .hotel-receipt > header .company-document-logo {\n            max-width: 60mm !important;\n            max-height: 28mm !important;\n            object-fit: contain !important;\n          }");
changes.set(files.hotel, hotel);

let invoice = readRequired(files.invoice);
invoice = addImport(invoice, 'import CompanyDocumentHeader from "@/components/documents/CompanyDocumentHeader";');
invoice = invoice.replace(/function logoUrl\(path: string \| null \| undefined\) \{[\s\S]*?\n\}\s*\n\n/, "");
invoice = invoice.replace(/\n\s*const logos = \[company\?\.logo1Path, company\?\.logo2Path, company\?\.logo3Path\][\s\S]*?\.filter\(\(value\): value is string => Boolean\(value\)\);\s*\n/, "\n");
const receiptHeaderMarker = 'className="flex items-center gap-5 border-b-4 border-[#0F6B5B] pb-6"';
const receiptHeaderStart = findTagStart(invoice, invoice.indexOf('className="payment-receipt-print-only"'), "div", receiptHeaderMarker);
const receiptHeader = findElement(invoice, receiptHeaderStart, "div");
const receiptHeaderReplacement = `<CompanyDocumentHeader company={company} compact>\n              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C9A227]">\n                Payment Receipt\n              </p>\n            </CompanyDocumentHeader>`;
invoice = invoice.slice(0, receiptHeader.start) + receiptHeaderReplacement + invoice.slice(receiptHeader.end);
invoice = replaceDocumentHeader(invoice, {
  headerMarker: 'className="border-b border-[#E4E7EC] px-6 py-7 sm:px-8"',
  wrapperMarker: 'className="grid grid-cols-[minmax(0,1fr)_minmax(150px,220px)] items-start gap-4"',
});
if (/Iqama Number:/i.test(invoice)) {
  throw new Error("Invoice source still contains an Iqama label. Please review it before running this patch.");
}
changes.set(files.invoice, invoice);

// If the company-settings API has an explicit required-name guard, remove it too.
// The database stores companyName as a required string, so an empty string is valid and no schema migration is needed.
const settingsApiFullPath = path.join(root, files.settingsApi);
if (fs.existsSync(settingsApiFullPath)) {
  let api = fs.readFileSync(settingsApiFullPath, "utf8");
  const guard = removeIfGuardContaining(api, "Company name is required.", "companyName");
  api = guard.source;
  if (guard.changed) changes.set(files.settingsApi, api);
  else if (api.includes("Company name is required.")) {
    throw new Error("Company-settings API still says company name is required, but its validation block did not match. No files have been written; share src/app/api/company-settings/route.ts so we can patch it safely.");
  }
}

const componentDestination = path.join(root, componentRelative);
if (!fs.existsSync(componentSource)) {
  throw new Error(`Patch component file missing: ${componentSource}`);
}
if (fs.existsSync(componentDestination)) {
  const existing = fs.readFileSync(componentDestination, "utf8");
  const supplied = fs.readFileSync(componentSource, "utf8");
  if (existing !== supplied) {
    throw new Error(`${componentRelative} already exists with different content. Back it up and compare before continuing.`);
  }
}

for (const [relativePath, contents] of changes) {
  fs.writeFileSync(path.join(root, relativePath), contents, "utf8");
}
fs.mkdirSync(path.dirname(componentDestination), { recursive: true });
fs.copyFileSync(componentSource, componentDestination);

console.log("Company document branding changes applied.");
console.log(`Updated ${changes.size} existing file(s) and added ${componentRelative}.`);
console.log("Run npx tsc --noEmit, npm run lint, and npm run build before committing.");
