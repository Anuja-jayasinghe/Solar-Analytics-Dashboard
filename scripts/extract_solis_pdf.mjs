import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _pdf = require("pdf-parse");
const pdf = typeof _pdf === "function" ? _pdf : _pdf?.default;

const pdfPath = path.resolve(
  process.cwd(),
  "Solis_datasheet_S5-GC(25-40)K_GBR_V1,5_202507.pdf"
);

async function main() {
  try {
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF not found at ${pdfPath}`);
      process.exit(1);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    if (typeof pdf !== "function") {
      throw new Error("pdf-parse did not resolve to a callable function");
    }
    const data = await pdf(dataBuffer);

    const outDir = path.resolve(process.cwd(), "docs");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    const txtOut = path.join(outDir, "solis_pdf_text.txt");
    const metaOut = path.join(outDir, "solis_pdf_meta.json");

    fs.writeFileSync(txtOut, data.text, "utf-8");
    fs.writeFileSync(
      metaOut,
      JSON.stringify(
        {
          nPages: data.numpages ?? data.numpage ?? undefined,
          info: data.info ?? {},
          metadata: data.metadata ?? {},
          version: data.version ?? undefined,
        },
        null,
        2
      )
    );

    console.log(`Extracted text to: ${txtOut}`);
  } catch (err) {
    console.error("Failed to extract PDF:", err);
    process.exit(1);
  }
}

main();
