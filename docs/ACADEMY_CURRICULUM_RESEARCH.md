# IMI Academy curriculum research and content rights gate

Research date: 2026-11-19

## Official evidence located

1. Ministry overview of the Moroccan school system:
   https://pw.men.gov.ma/%D8%A7%D9%84%D8%AA%D8%B1%D8%A8%D9%8A%D8%A9-%D8%A7%D9%84%D9%88%D8%B7%D9%86%D9%8A%D8%A9
   The page describes primary, lower-secondary and qualifying upper-secondary stages. It describes upper-secondary streams broadly as scientific, literary, economic and technical, but does not provide the exhaustive branch-by-branch subject matrix, ordering or semester allocation requested for IMI.

2. Ministry publication concerning the permanent curriculum renewal commission (27 July 2026):
   https://www.men.gov.ma/fr/actualites/m-le-ministre-participe-%C3%A0-la-r%C3%A9union-de-la-commission-permanente-charg%C3%A9e-du-renouvellement-et-de-l%E2%80%99adaptation-des-curricula-et-des-programmes
   The ministry states that the meeting reviewed a preliminary curriculum reference framework. This is not a final subject-by-subject curriculum specification.

3. Official text of Law 59.21 on school education:
   https://pw.men.gov.ma/sites/default/files/loi59.21Enseignement-Scolaire.pdf
   Article 76 assigns preparation of curricula and educational programmes for each school level to the competent government authority and provides for ongoing evaluation and improvement. It does not itself enumerate the requested branch/subject/semester matrix.

## Data decision

The sources above are authoritative for the broad school structure and the Ministry's responsibility for curricula. They do **not** substantiate a complete list of every requested branch, subject, subject order, or semester allocation. Therefore IMI must not label a guessed catalogue as officially verified.

Until the applicable official curriculum documents and their current versions are collected and checked, the detailed branch/subject/order/semester records must carry:

- `verificationStatus: "needs-review"`
- `verificationNote: "لم يُعثر بعد على وثيقة وزارية رسمية تفصيلية تثبت هذا الترتيب؛ يلزم التحقق البشري."`
- `sourceType: "official"` only when an exact official document URL has actually been attached to that record.

The requested second-year baccalaureate Physical Sciences path may be used as a **non-published test fixture**, but no subject ordering, semester mapping, lesson text or exam content should be represented as Ministry-confirmed without the underlying document.

## Content-rights publication gate

Every lesson draft must include:
- `sourceType`: `official`, `open-license`, `embed`, `original`, or `teacher-agreement`
- `sourceName`
- `sourceUrl` when the source type requires a URL
- `license`
- `permissionNote`
- `addedBy` (set by the trusted backend, never accepted from the browser)
- `reviewedBy` and `reviewedAt` (set by the trusted backend at approval)

Publication must be blocked when source/permission metadata is incomplete. Original drafts must explicitly state that human review is required. Teacher content must document the agreement/permission. No scraping, copying, or lightly paraphrasing third-party lesson content is permitted.

## Remaining research work

- Retrieve the current official pedagogical orientations and subject programmes for each requested level/branch.
- Verify the language of instruction separately for each (branch × subject) pair; do not infer language from broad stream names.
- Verify subject order, semester allocation, coefficients and curriculum changes against dated official documents.
- Record the exact source URL, document title/version/date and page/section for each verified record.
- Obtain teacher review before publishing original lesson drafts or teacher-contributed material.
