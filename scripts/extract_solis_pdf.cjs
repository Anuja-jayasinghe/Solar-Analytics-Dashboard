const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

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
          nPages: data.numpages ?? undefined,
          info: data.info ?? {},
          metadata: data.metadata ?? {},
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
