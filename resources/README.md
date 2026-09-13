# resources/ — local working files

**This whole directory is gitignored. Nothing in here is committed, and nothing in here
should be relied on by code.**

It exists to hold real source documents while working on them locally — primarily CEB bills,
which contain the account holder's **name, address, phone number and account number**. Those
must never end up in the repository.

> The directory was originally `resorces/` and was *not* covered by `.gitignore`. It is now
> `resources/`, and `.gitignore` covers `resources/`, `resorces/` and `*.bill.pdf`.

## Layout

```
resources/
├── README.md                        this file
└── ceb-bills/
    ├── 2026/                        source PDFs, one per bill
    │   └── 2026-09-03_ref457_acct4924089702.pdf
    └── _extracted-text/             pdf-parse output, for diffing formats
        └── 2026-09-03_ref457.txt
```

## Naming

```
<issue-date>_ref<bill-ref-seq>_acct<account>.pdf
```

Every CEB bill carries a reference of the form
`Bill Ref: 457-4924089702-20260903082730` — sequence, account, then a `YYYYMMDDHHMMSS`
timestamp. So `ref457` issued `2026-09-03` becomes
`2026-09-03_ref457_acct4924089702.pdf`. Sorting by filename sorts by date, and the sequence
number makes gaps in a series obvious.

## Extracting the text of a bill

This is what the parser actually sees, and the fastest way to tell whether a format has
changed:

```bash
node -e "
import('pdf-parse').then(async ({ PDFParse }) => {
  const fs = await import('fs');
  const p = new PDFParse({ data: fs.readFileSync(process.argv[1]) });
  process.stdout.write((await p.getText()).text);
  await p.destroy();
})" resources/ceb-bills/2026/<file>.pdf > resources/ceb-bills/_extracted-text/<name>.txt
```

Use `cat -A` to make tab characters visible — the meter-reading parser depends on real tabs
between table cells, and that is the most fragile assumption in the whole extractor.

## Adding a new bill format to the test suite

**Do not copy a real bill into `tests/fixtures/`.** Redact it first — replace the name,
address and phone number with placeholders, keep the structure and the numbers. See
`tests/fixtures/ceb-bill-2026.txt` for the pattern.
