# fixtures

Sample sources for manual testing on the preview and in production. Not used by unit tests.

| File | What it is | Licence |
|---|---|---|
| `sample-text.txt` | "The Tide Mill of Varrow Creek", about 2,000 words, for the "Paste text" tab. Original text written for this project; the place, people and numbers are fictional, so answers can only come from the source. Its first line is a plain title, so it also tests the derived title. | Written for this repository, no third-party rights |
| `nist-csf-2.0.pdf` | NIST CSWP 29, "The NIST Cybersecurity Framework (CSF) 2.0" (2024), 32 pages, 1.5 MB, about 68,000 characters of text, for the "PDF" tab. Source: https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf | US federal government work, public domain in the US (17 U.S.C. § 105) |
| `scanned.pdf` | Page 1 of `nist-csf-2.0.pdf` as an image only (rendered with `qlmanage`, saved as PDF with `sips`). `unpdf` finds 0 characters of text, so it must fail with "This PDF has no selectable text." | Derived from the public-domain PDF above |

Good test questions for `sample-text.txt` (answers in the text):
- When did the mill close, and why? (1938, storm damage to the pond gates, repairs too expensive)
- Who was the last commercial miller? (Edith Marrin, 1919–1938)
- How big is the restored pond, and why not the full size? (1.5 of just over 4 hectares; the rest is salt marsh with a redshank colony)
- How long can the restored mill grind per tide? (about 90 minutes with one pair of stones)
- Why doesn't the mill generate electricity? (2022 study: only a handful of homes; education matters more)
- What does the text say about the moon landing? (nothing: a good "not in the sources" check)

Good test questions for `nist-csf-2.0.pdf` (citations should point to the page):
- What are the six Functions of the CSF 2.0? (Govern, Identify, Protect, Detect, Respond, Recover)
- What is new in Govern compared with CSF 1.1? (a new Function on cybersecurity risk management strategy, expectations and policy)
- What are CSF Tiers? (Partial, Risk Informed, Repeatable, Adaptive)
