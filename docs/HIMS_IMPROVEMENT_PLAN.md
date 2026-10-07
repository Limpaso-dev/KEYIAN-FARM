# HIMS Improvement Plan

## Strategic objective
Refine the current HMIS into a clinically safe, auditable, and revenue-safe patient flow while preserving what already works in the ERP and HMIS screens. The plan is structured around the required HIMS lifecycle and prioritizes patient safety and financial integrity first.

## Prioritized work list

### P1 — Patient safety and revenue leakage

1. Identity, merge, and patient integrity
   - Files affected: [server/src/models/Patient.js](../server/src/models/Patient.js), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js), [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx)
   - Schema changes: add national ID, MRN generation policy, payer metadata, consent records, soft-delete metadata, duplicate-check fields.
   - API changes: patient search with fuzzy duplicate detection; merge endpoints; patient status history; void/cancel operations.
   - UI changes: search results with duplicate warnings, patient card print, payer details, consent acknowledgement.
   - Risk: duplicate records, wrong patient billing, unsafe clinical errors.
   - Effort: M

2. Audit logging and void/cancel discipline
   - Files affected: [server/src/middleware/auth.middleware.js](../server/src/middleware/auth.middleware.js), [server/src/models](../server/src/models), [server/src/controllers](../server/src/controllers)
   - Schema changes: add `AuditLog` collection with user, timestamp, device/IP, action, before/after JSON, actor role, object type, object id, approval chain.
   - API changes: all mutation routes emit audit events; all void/cancel operations capture reason and approver.
   - UI changes: action history panels and status markers for voided/edited records.
   - Risk: regulatory and operational noncompliance.
   - Effort: M

3. Billing integrity and claim controls
   - Files affected: [server/src/models/MedicalBill.js](../server/src/models/MedicalBill.js), [server/src/controllers/medicalBilling.controller.js](../server/src/controllers/medicalBilling.controller.js), [server/src/controllers/invoice.controller.js](../server/src/controllers/invoice.controller.js), [client/src/modules/hmis/MedicalBillingPage.jsx](../client/src/modules/hmis/MedicalBillingPage.jsx)
   - Schema changes: payer tariff, insurer policy, co-pay rules, service-order-to-charge links, payment methods, reversal events.
   - API changes: auto-charge generation, claim holds, refund/reversal approval, receipt numbering, reconciliation endpoint.
   - UI changes: bill detail with payer cover, co-pay, charge source, approvals and payment splits.
   - Risk: revenue leakage, denied claims, unbilled services.
   - Effort: M

4. Triage and consultation safety
   - Files affected: [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js), [client/src/modules/hmis/MedicalVisitsPage.jsx](../client/src/modules/hmis/MedicalVisitsPage.jsx)
   - Schema changes: `triage` subdocument, `vitals`, `queue`, `allergy`, `chronic condition`, `disposition`, state machine fields.
   - API changes: state transitions, nurse/doctor queue management, alerts for abnormal vitals, locking of consultation notes.
   - UI changes: single-page triage and consultation workflow, queue priority, alerts.
   - Risk: patient deterioration goes unnoticed; unsafe clinical handoff.
   - Effort: M

### P2 — Workflow completeness

5. Registration-to-visit lifecycle
   - Files affected: [server/src/models/Patient.js](../server/src/models/Patient.js), [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js), [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx), [client/src/modules/hmis/MedicalVisitsPage.jsx](../client/src/modules/hmis/MedicalVisitsPage.jsx)
   - Schema changes: add visit number, visit types, queue number, department allocation, state machine enum, open-visit validation.
   - API changes: create visit from patient, prevent duplicate active visits, assign queue and departments, auto-charge recognition.
   - UI changes: registration step, visit creation, department queue board.
   - Risk: duplicate open visits, wrong clinic assignment.
   - Effort: M

6. Lab, radiology, and pharmacy modules
   - Files affected: [server/src/models/MedicalLabResult.js](../server/src/models/MedicalLabResult.js), [server/src/models/Prescription.js](../server/src/models/Prescription.js), [client/src/modules/hmis/MedicalLabPage.jsx](../client/src/modules/hmis/MedicalLabPage.jsx), [client/src/modules/hmis/PrescriptionsPage.jsx](../client/src/modules/hmis/PrescriptionsPage.jsx)
   - Schema changes: order records, specimen tracking, reference-range validation, radiology exam records, dispensing inventory linkage, batch/expiry tracking.
   - API changes: lab worklist, result validation, critical-alert release, pharmacy dispense queue, stock deduction, controlled-drug register.
   - UI changes: worklists, result validation screens, pharmacist review panel, dispensing label history.
   - Risk: delayed diagnosis, stock errors, dispensing without verification.
   - Effort: L

7. Admission, transfer, and discharge
   - Files affected: new admission/discharge models and route layer; [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js)
   - Schema changes: ward/bed allocation, admission reasons, discharge summary, final bill closure, bed cleaning state.
   - API changes: admit/transfer/discharge endpoints, transfer audit trail, final bill clearance, closure rule checks.
   - UI changes: ward board, admission workflow, discharge approval screens.
   - Risk: patient safety and financial closure errors.
   - Effort: L

8. Exceptions and downtime handling
   - Files affected: [server/src/controllers](../server/src/controllers), [server/src/routes](../server/src/routes)
   - Schema changes: add `voidReason`, `manualEntry`, `downtimeRecord`, `mergeRequest`, `deathNotification`, `referral` state.
   - API changes: duplicate merge workflow, cancellation reversals, offline-mode entries, back-entry reconciliation.
   - UI changes: exception queue and approval panels.
   - Risk: operational disruption and non-compliance.
   - Effort: M

### P3 — Reporting and UX polish

9. Cross-module reporting
   - Files affected: [server/src/controllers/reports.controller.js](../server/src/controllers/reports.controller.js), [client/src/modules/reports](../client/src/modules/reports)
   - Schema changes: reporting views or aggregated query helpers; export metadata.
   - API changes: operational/clinical/financial dashboards; export endpoints (PDF/Excel).
   - UI changes: drill-down dashboard, charts, department summaries, claims aging, occupancy, waiting times.
   - Risk: poor usage adoption and weak management visibility.
   - Effort: M

10. Role and UX hardening
   - Files affected: [client/src/utils/permissions.js](../client/src/utils/permissions.js), [server/src/middleware/role.middleware.js](../server/src/middleware/role.middleware.js), [client/src/components/common](../client/src/components/common)
   - Schema changes: extend role enum and permission mapping to hospital roles.
   - API changes: server-side checks for every endpoint and action; route-specific authorization.
   - UI changes: role-based menu, dynamic forms, shorter actions, mobile/tablet responsiveness.
   - Risk: unauthorized access and low usability.
   - Effort: S/M

## Proposed migration order

1. Foundation and safety
   - Add audit logs, soft-delete/void conventions, and role-role alignment for HMIS roles.
   - Introduce patient identity integrity rules and missing validation.

2. Visit and triage lifecycle
   - Add visit state machine, queueing, triage vitals, and change-tracking.
   - Add alerts and doctor handoff rules.

3. Billing and claims
   - Add payer configuration, claim locks, payment splits, and reversal workflows.
   - Improve invoice/receipt integrity and reconciliation.

4. Lab, pharmacy, and imaging
   - Add module-specific order, validation, release, and stock-deduction logic.

5. Admission/discharge and exceptions
   - Implement wards, beds, discharge, and final clearance.
   - Cover exception handling and downtime protocols.

6. Reporting and UX
   - Add operational dashboards, exports, and role-based UI polish.

## Risk assessment
- P1 items are highest risk due to patient safety, financial leakage, and compliance.
- P2 items deliver the hospital operating flow and are required before meaningful clinical use.
- P3 items improve adoption, management visibility, and departmental insight but should not take precedence over safety and billing integrity.

## Effort estimate
- Small (S): 2-4 days
- Medium (M): 4-8 days
- Large (L): 1-2 weeks

Overall recommended effort: 3-5 sprints, with the first sprint focused on P1 safety controls and patient identity.

## Recommendation
Implement the foundation in the following order: audit logging → soft-delete/void policy → patient identity checks → visit state machine → billing controls → triage/consultation → lab/pharmacy → admission/discharge → reporting.

This sequencing reduces patient risk and revenue leakage before deeper workflow completion.
