# Lotus Operations UI Redesign Plan

## Goal and guardrails

Refresh the ITOMS interface into a calm, readable operations workspace using the Lotus Operations palette. Keep the design clearly structured, minimal, and elegant: prioritize essential information, use restrained color and decoration, and remove visual noise that does not help users complete or understand their work. Improve information hierarchy, responsive behavior, and accessibility while preserving existing workflows and data. Treat UI redesign and authorization/backend changes as separate workstreams.

- Keep Thai and English behavior aligned; do not translate LINE, Message Box, Personal Call, or Other.
- Preserve Firestore collection names, document shapes, queries, and write behavior during UI-only steps.
- Do not deploy or connect to production Firebase during local design work.
- Use Firebase Emulator Suite for authorized behavior and Rules checks.
- Keep status colors meaningful. Use purple for Message Box; retain distinct warning/error colors.
- After each page step, inspect the diff, run the production build, and review desktop, tablet, and mobile layouts in both languages before moving on.

## Foundation

Palette tokens:

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F4F7F4` | Page background |
| Surface | `#FFFFFF` | Cards and controls |
| Ink | `#26312C` | Primary text |
| Muted | `#69776F` | Supporting text |
| Border | `#DCE5DE` | Dividers and control outlines |
| Brand | `#47765C` | Primary actions and active state |
| Brand soft | `#E8F1EB` | Subtle selected surfaces |
| Message Box | `#7552A2` | Message Box channel indicators |

## Step 0 — Recovery and baseline (complete)

- Create a restorable project snapshot before redesign work.
- Extract it to a clean location and compare the restored file manifest.
- Run the production build from the restored copy.
- Record current role model, collections, feature routes, and known UX/security issues.

**Acceptance:** restore contains the same files as the snapshot; restored build passes; no production Firebase operation is needed.

## Step 1 — Design tokens and application shell (implemented; desktop browser review complete)

Scope: global colors, typography inheritance, focus states, shared controls, top header, navigation, and responsive shell.

**Prompt:** “Refine the Lotus ITOMS application shell with the Lotus Operations tokens. Keep all routes, menu visibility rules, authentication, property scoping, and data behavior unchanged. Make the header compact and clear, keep navigation easy to scan, show the active page clearly, and make the menu usable on narrow screens and keyboard-only input. Preserve Thai and English labels.”

**Acceptance:** production build passes; current route and navigation actions still work; no horizontal overflow at 390px, 768px, and desktop widths; sticky header does not obscure content; active and focus states are visible.

## Step 2 — Dashboard (implemented; desktop browser review complete)

Scope: `ExecutiveDashboard`, its summaries, charts, trend range, service health, CCTV/PM/Asset/Licence cards, and To-do preview.

**Prompt:** “Reorganize the ITOMS dashboard so urgent work and service health are easy to understand first, followed by trends and breakdowns. Keep existing calculations, date range behavior, property scope, and click-through actions. Make chart labels and empty states readable in Thai and English; use the established channel colors, including purple for Message Box. Avoid adding metrics without a data source.”

**Acceptance:** metric totals reconcile with their source lists; range changes update all dependent charts; empty and loading states are clear; links open the corresponding page; disabled CCTV/property-specific modules stay hidden; charts remain legible on mobile.

## Step 3 — Operations Calendar and To-do (implemented; Emulator workflow QA complete)

Scope: `TodoCalendar`, event form, calendar, list/columns, CRUD, and dashboard preview.

**Prompt:** “Improve the operations calendar and To-do experience while preserving current event fields and Firestore behavior. Separate completed, upcoming, and overdue work clearly; keep past calendar events available when they exist; allow edits only before the event time as currently specified. Use concise forms, readable calendar cells, and clear saving/error states. Do not change role access until the role policy is confirmed.”

**Acceptance:** create/read/update/delete flows work in the emulator; edits are blocked after the event time; past events render in calendar and dashboard when present; property scope is maintained; role-specific access is unchanged until approved.

**Current implementation and QA:** dashboard preview shows Completed before Not completed, with overdue and upcoming items grouped separately. Calendar days use distinct markers for overdue, upcoming, and completed events. Selected-day details use two columns for completed and unfinished work, with overdue items marked and listed first. Calendar eyebrow labels follow the selected language. Manual Emulator review confirmed create, update before due time, completion, archive, past-event visibility in Calendar and Dashboard, and edit lock after the event time. Temporary QA To-dos were soft-archived in the local Emulator. Role/property checks, recurrence, and persisted shapes were not changed. Production build and `git diff --check` pass. Browser review covered Thai narrow layout and a wide application layout; tablet-specific review remains part of the system-wide QA step.

## Step 4 — Tasks (implemented; Emulator workflow reviewed)

Scope: `TicketBoard`, create/update/view flows, completion resolution notes, category/subcategory, channel, request user, and catalog settings.

**Prompt:** “Redesign Task creation and management as a clear, guided workflow. Keep the two dependent problem dropdowns, existing channel values, request user semantics, and current validation. Highlight missing required fields before submission and show actionable save errors. For Completed Tasks, preserve the resolution-method field and history. Do not rename persisted fields or alter IDs.”

**Acceptance:** required-field behavior is correct; category/subcategory dependency works; legacy channels still display; successful writes appear in View/Update; completion resolution is visible in history; emulator Rules remain enforced.

**Current implementation and QA:** Task creation and list views use the Lotus Operations surfaces, clearer priority/status badges, and a more scannable metadata layout. Required location and description fields display inline errors after attempted submission; errors clear on successful save. English and Thai labels are aligned, including localized Task history notes, while LINE, Message Box, Personal Call, and Other remain unchanged. Manual local Emulator review confirmed required-field blocking, category/subcategory dependency, all four channel choices, Task creation, status update, completion resolution, View Task visibility, and history display. Role/property checks, Firestore collections, document fields, and ID generation remain unchanged. Production build and `git diff --check` pass. The emulator Rules unit suite and tablet/mobile review remain in the system-wide Step 9 checklist; no production deployment was performed.

## Step 5 — Asset, damaged equipment, and Licence (implemented; desktop browser review complete)

Scope: `AssetAndLicensePage`, `AssetRegistry`, `DamagedAssetsPage`, `LicenseOverviewSummary`, and `LicenseRenewalPanel`.

**Prompt:** “Present assets and software licences as separate but related operational views. Make asset identity, property, department/location, lease status, repair state, and warranty easy to scan. Keep the damaged-assets page read-only for its authorized viewer roles. For licences, focus summary information on expired or near-expiry records rather than aggregating seats in a way that obscures renewal action. Preserve existing data and filters.”

**Acceptance:** asset records remain property-scoped; damaged assets remain read-only for viewer roles; lease-specific fields are understandable; licence expiry windows and renewal status are accurate; no license key is exposed in summary cards.

**Current implementation and QA:** Asset cards now foreground property/tag, ownership and repair status, then group department, location, vendor/model, user, serial, and warranty details. Lease contract details have a dedicated amber panel; the leased-asset form was opened in the local Preview and the lessor, contract, dates, and rent fields were confirmed visible, then cancelled without writing data. Damaged Assets now uses clearer status counts, repair/overdue emphasis, and readable repair metadata. Its manager action remains gated to Super Admin/Support Engineer; viewer roles continue to get the list without management controls (verified against the existing role conditions). Licence cards show expiry and renewal status distinctly, while the dashboard summary remains limited to expired/30-day-risk records rather than aggregating seats. No license keys are displayed. Thai and English labels and desktop browser views were reviewed using local Preview data; property scopes, Firestore reads/writes, schemas, rules, and role checks were not changed. Production build and `git diff --check` pass. Tablet/mobile and Rules test-suite coverage remain in Step 9; no production deployment was performed.

## Step 6 — CCTV and Incident Log

Scope: `CctvDailyCheckPanel`, NVR inventory, daily history/calendar, `InfrastructureIncidents`, and incident details.

**Prompt:** “Make CCTV checks and infrastructure incidents fast to scan and record. Keep CCTV visibility controlled by Property Setup, with the module hidden from both menu and dashboard when disabled. Preserve per-property check status, camera/NVR inventory, retention-day counts, and history. Keep Incident Log separate from CCTV checks, with clear impact, status, dates, and resolution history.”

**Acceptance:** disabled CCTV disappears from navigation and dashboard; daily check saves are property-scoped; online/offline totals match device records; incident visibility and management roles do not change; date navigation and empty/error states work.

**Current implementation and QA:** Incident Log now uses a quieter Lotus Operations surface, with neutral summary metrics and a clear calendar/date-detail hierarchy. CCTV and Incident calendar weekday labels follow the selected language (previously they stayed Thai in English mode). CCTV now places the daily calendar first, the selected-date Log directly below it, and the NVR register after both; the daily check form follows the register. Local Preview browser review covered Thai and English, empty calendar days, an example CCTV log marker, filters, and read-only/manage controls visible for the Preview Admin; no records were written. The reordered calendar, Log, and NVR register were visually checked at a narrow browser width. Existing property setup gating, Firestore operations, indexes, and role conditions were preserved. Production build and `git diff --check` pass. Dedicated viewer-role checks remain in Step 9; no production deployment was performed for this layout change.

## Step 7 — Preventive Maintenance

Scope: `PmManager` and PM dashboard summary.

**Prompt:** “Improve Preventive Maintenance scheduling and completion tracking. Make due, upcoming, overdue, and completed work visually distinct; keep asset/property context and repeat schedule easy to understand. Preserve current recurrence calculations and permissions.”

**Acceptance:** due dates and recurrence are correct; completing/editing a PM updates its list and dashboard summary; property access is unchanged; overdue status is unambiguous.

**Current implementation and QA:** PM schedule and checklist surfaces now use consistent restrained Lotus Operations cards. Schedule cards distinguish overdue, due today, and scheduled work; due dates follow the selected language and locale. The PM dashboard summary keeps overdue as the only warning-colored count. Manual local Preview review in Thai and English confirmed PM schedule listing and localized date formatting; no PM record was changed. Recurrence calculations, persistence, property scopes, and permissions were untouched. Production build and `git diff --check` pass. Completion/update behavior and Firestore Rules remain for the system-wide Step 9 audit; no production deployment was performed.

## Step 8 — System administration

Scope: Property Setup, property configuration, Request Users, User Directory, Catalog Settings, and Activities Log.

**Prompt:** “Polish system administration pages for safe, deliberate changes. Group related fields, explain scope before saving, make disabled/inactive states visible, and provide confirmation for consequential changes. Preserve current access boundaries and audit behavior. Do not create, promote, or write user roles from the client unless the approved backend flow supports it.”

**Acceptance:** only authorized roles can manage each page; edits are reflected after reload; validation and save errors are actionable; activity history records the same events; narrow layouts do not clip tables or actions.

**Current implementation and QA:** Administration panels now share a restrained surface and lighter hierarchy. Property Setup explains that disabling CCTV hides its navigation/dashboard summary while keeping history, and asks for confirmation before toggling the module. User Directory, Request Users, Catalog Settings, and Activities Log were reviewed in the local Preview without submitting changes. Activity status transitions now localize with the selected language; a reversed translation mapping that showed English CCTV labels in Thai has been corrected. Role checks, membership provisioning boundaries, audit writes, schemas, and rules were preserved. Production build and `git diff --check` pass; narrow-width and rules-suite verification remain in Step 9. No production deployment was performed.

## Step 9 — Whole-system verification and release review (complete with stated QA limits)

- Run the production build and existing Firestore Rules tests against the emulator.
- Walk every route as Super Admin, Support Engineer, Client Executive, requester, and any newly approved role.
- Review Thai and English text, long property names, empty/loading/error states, keyboard focus, and narrow viewport behavior.
- Review every redesigned screen as one system for visual clarity and consistency: keep layouts minimal and elegant, make the primary task and key information immediately obvious, and remove redundant labels, competing accents, and decorative elements that weaken hierarchy.
- Check property isolation, role visibility, read-only controls, and Firestore Rules as separate layers.
- Review the final diff against the snapshot; do not deploy until the user explicitly requests it and release checks pass.

**Release gate:** all acceptance criteria pass, no permission behavior changed unintentionally, and production deployment is separately authorized.

**Final verification:** the restored snapshot build, final `npm run build` (`tsc -b` + Vite), and `git diff --check` pass. Firestore Rules tests pass: 11 tests, 0 failures, against the existing local Rules Emulator. Browser smoke review covered every visible route in the local Preview as Preview Admin; Thai and English were checked across dashboard, To-do, Task, assets, CCTV, incidents, PM, and administration. The dashboard and redesigned surfaces were visually reviewed at desktop width. English review caught and fixed untranslated Dashboard status/help copy, Catalog Settings labels, and Update Task accessibility labels. No form was submitted and no Firestore data was changed during this final review. Rules, schemas, role gates, and property scoping were not changed. Automated Playwright and narrow-width viewport checks were unavailable in this environment, and browser role impersonation beyond Preview Admin was not performed; those are explicit QA limits, not claimed as passed.

**Deployment:** after the user chose the new design in place of the old one, the static Hosting site was deployed with `firebase deploy --only hosting --project itmos-4aff7`. The production build predeploy passed, the release completed, and the live URL served the updated sign-in page. Firestore Rules and indexes were not deployed or changed.

## Open policy decision

The currently implemented roles are `superAdmin` and property memberships `supportEngineer`, `clientExecutive`, and `requester`. The proposed `Property Owner`, `Lotus Technology Staff` (read-only across all properties), and `Property Management` roles are not yet mapped. To-do access also has conflicting prior requests. Confirm the role mapping and To-do policy before changing menu visibility or Firestore Rules; in particular, cross-property read access requires an explicit authorization design.
