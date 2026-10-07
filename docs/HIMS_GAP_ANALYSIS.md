# HIMS Gap Analysis

## Scope
This review compares the current repo against the HIMS specification provided. The assessment is based on the server API, Mongoose models, middleware, and frontend HMIS screens visible in the codebase.

## Current status summary
- The repo already contains a lightweight HMIS feature set for patients, visits, lab results, prescriptions, and bills.
- The implementation is operational but not close to the full hospital workflow described in the specification.
- Major gaps exist in patient identity integrity, auditability, role model fidelity, triage, admission/discharge, billing integrity, and reporting.

## Gap table

| Spec ID | Status | Evidence | Notes |
|---|---|---|---|
| G1 | PARTIAL | [server/src/models/Patient.js](../server/src/models/Patient.js), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | A unique `patientNumber` exists, but there is no duplicate-check workflow, MRN de-duplication logic, or patient merge control. |
| G2 | MISSING | No audit model or audit middleware found in [server/src](../server/src) | There is no `AuditLog`, no before/after capture, and no user/device/IP logging. |
| G3 | PARTIAL | [server/src/middleware/role.middleware.js](../server/src/middleware/role.middleware.js), [client/src/utils/permissions.js](../client/src/utils/permissions.js) | Core roles exist, but the hospital role set is incomplete for receptionist, cashier, radiology, pharmacy, admin, etc. |
| G4 | BROKEN | [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js), [server/src/controllers/medicalBilling.controller.js](../server/src/controllers/medicalBilling.controller.js) | Deletes are hard deletes (`findByIdAndDelete`), contrary to the no-hard-delete rule. |
| G5 | PARTIAL | [server/src/models/MedicalBill.js](../server/src/models/MedicalBill.js), [server/src/controllers/medicalBilling.controller.js](../server/src/controllers/medicalBilling.controller.js) | Bills exist, but not a complete auto-charge model for every order type or every visit event. |
| G6 | PARTIAL | [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | Records are updated through standard CRUD, but there is no real-time update mechanism or lock/version strategy for clinician notes and results. |
| R1 | PARTIAL | [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx) | Search fields exist in the UI, but no fuzzy match + duplicate warning flow is implemented on the server. |
| R2 | PARTIAL | [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | Existing-patient load is possible, but there is no explicit confirm/update-demographics workflow and no duplicate merge workflow. |
| R3 | EXISTS | [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | New patient form is represented and createPatient is available. |
| R4 | PARTIAL | [server/src/models/Patient.js](../server/src/models/Patient.js), [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx) | Demographics are present but do not include national ID, occupation, photo/fingerprint, and stronger payer/insurance details. |
| R5 | PARTIAL | [server/src/models/Patient.js](../server/src/models/Patient.js) | Some validation exists, but it is not a full patient-registry validation layer: phone/ID formats, duplicate warnings, and mandatory checks are absent. |
| R6 | PARTIAL | [server/src/models/Patient.js](../server/src/models/Patient.js), [client/src/modules/hmis/PatientsPage.jsx](../client/src/modules/hmis/PatientsPage.jsx) | `patientNumber` is unique, but there is no MRN generation policy, barcode/print workflow, or non-reusable MRN strategy beyond the field itself. |
| R7 | MISSING | No payer or insurance schema found in the HMIS models | There are no payer types, scheme fields, membership number, validity windows, or claim limits. |
| R8 | MISSING | No eligibility or insurer model found | No coverage check, expiry alert, or exhausted-cover logic exists. |
| R9 | MISSING | No consent model or consent fields in patient forms or models | No privacy e-signature or consent upload flow is implemented. |
| R10 | PARTIAL | [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | Patient creation works, but status workflow (`Registered`) is not enforced as a stateful patient record. |
| V1 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | A visit is linked to a patient, but there is no unique visit number generator or explicit visit-number field. |
| V2 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | Visit types are limited to `outpatient`, `follow_up`, and `emergency`; no inpatient, antenatal, dental, or specialty clinic types. |
| V3 | MISSING | No queueing, department, clinic, or doctor assignment logic found | No scheduling/availability logic exists. |
| V4 | MISSING | No open-visit check logic found in models or controllers | No prevention of multiple open visits per patient. |
| V5 | MISSING | No queue number or emergency priority logic found | This is absent. |
| V6 | PARTIAL | [server/src/models/MedicalBill.js](../server/src/models/MedicalBill.js), [server/src/controllers/medicalBilling.controller.js](../server/src/controllers/medicalBilling.controller.js) | Billing can exist, but auto-charge generation by visit and payer tariff is not implemented as a general rule. |
| V7 | MISSING | No payer tariff, insurance rule, or co-pay logic found | Cash/insurance rules are not implemented. |
| V8 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | Visit lifecycle status exists but is not the required workflow state machine. |
| T1 | MISSING | No triage workflow or queue model found | No nurse triage queue exists. |
| T2 | MISSING | No vitals schema found | Weight, height, BMI, BP, pulse, temp, resp rate, SpO2, blood sugar are absent. |
| T3 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | `chiefComplaint` exists, but no comprehensive triage complaint/duration fields exist. |
| T4 | MISSING | No vital-sign rules or abnormal flag logic found | No configurable alert engine exists. |
| T5 | MISSING | No triage category or queue re-ordering logic found | Absent. |
| T6 | MISSING | No allergy/chronic medication record model found | Absent. |
| T7 | MISSING | No triage-to-doctor status workflow found | Absent. |
| C1 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | A clinician can be assigned, but no dedicated consultation state management or call process exists. |
| C2 | MISSING | No history, diagnoses, allergies, prior results views in models or controllers | Absent. |
| C3 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | Notes sections exist in a limited form, but they are not structured with HPI/exam/assessment and no addenda flow. |
| C4 | MISSING | No ICD-10 diagnosis lookup or coding model found | Absent. |
| C5 | PARTIAL | [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js), [server/src/models/MedicalLabResult.js](../server/src/models/MedicalLabResult.js), [server/src/models/Prescription.js](../server/src/models/Prescription.js) | Orders exist in separate forms, but not as a unified order model or service-order workflow. |
| C6 | MISSING | No allergy or drug-interaction safety checks found | Absent. |
| C7 | MISSING | No authorization or coverage validation flow found | Absent. |
| C8 | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | Status states are minimal and not the required dispositions. |
| C9 | MISSING | No locked-notes, sign-off, or addenda structure found | Absent. |
| B1 | PARTIAL | [server/src/models/MedicalBill.js](../server/src/models/MedicalBill.js) | Bill lines exist, but auto-charges from orders and payer tariffs are not uniformly implemented. |
| B2 | MISSING | No payment-before-service gate found | Absent. |
| B3 | PARTIAL | [server/src/models/MedicalBill.js](../server/src/models/MedicalBill.js) | Payment methods are present as strings in bill payments, but not a real multi-method, split-payment, or credit rule engine. |
| B4 | MISSING | No insurer claim workflow or pre-auth model found | Absent. |
| B5 | PARTIAL | [server/src/models/MedicalBill.js](../server/src/models/MedicalBill.js) | There are bill numbers and payment records, but no full numbered receipt/invoice policy or reprint control. |
| B6 | MISSING | No discount/waiver approver workflow found | Absent. |
| B7 | MISSING | No refund/reversal audit model found | Absent. |
| B8 | MISSING | No shift reconciliations or cashier shift model found | Absent. |
| L1 | PARTIAL | [server/src/models/MedicalLabResult.js](../server/src/models/MedicalLabResult.js) | Worklist concept is not implemented; lab results exist but there is no full ordered sample workflow. |
| L2 | MISSING | No authorization/payment gate for lab orders found | Absent. |
| L3 | PARTIAL | [server/src/models/MedicalLabResult.js](../server/src/models/MedicalLabResult.js) | Sample collection time/collector fields are not present. |
| L4 | MISSING | No reject/invalid-sample workflow found | Absent. |
| L5 | PARTIAL | [server/src/models/MedicalLabResult.js](../server/src/models/MedicalLabResult.js) | Result entry (`result`, `referenceRange`) exists, but no analyzer interface or validation rules. |
| L6 | MISSING | No abnormal/critical validation or reference-range engine found | Absent. |
| L7 | MISSING | No clinician notification or critical alert flow found | Absent. |
| L8 | PARTIAL | [client/src/modules/hmis/MedicalLabPage.jsx](../client/src/modules/hmis/MedicalLabPage.jsx) | UI displays lab results, but no EMR release and print pipeline is formalized. |
| L9 | MISSING | No stock deduction model found | Absent. |
| X1 | MISSING | No radiology route/model found | Absent. |
| X2 | MISSING | No scheduling or machine assignment model found | Absent. |
| X3 | MISSING | No PACS/image linkage support found | Absent. |
| X4 | MISSING | No radiology report model or radiologist workflow found | Absent. |
| X5 | MISSING | No radiology release/notify flow found | Absent. |
| P1 | PARTIAL | [server/src/models/Prescription.js](../server/src/models/Prescription.js) | Prescriptions exist, but no dispensing queue, pharmacist check, or e-prescription flow. |
| P2 | MISSING | No pharmacist review or contact-prescriber workflow found | Absent. |
| P3 | PARTIAL | No stock/batch/expiry model for pharmacy found | The inventory system exists elsewhere, but not bonded to patient meds. |
| P4 | MISSING | No payment/authorization gate for dispenses found | Absent. |
| P5 | PARTIAL | [server/src/models/Prescription.js](../server/src/models/Prescription.js) | Dispense status exists, but FEFO, batch expiry logic, stock deduct, and labelling are not implemented. |
| P6 | PARTIAL | [server/src/models/Prescription.js](../server/src/models/Prescription.js) | Status field exists but no tenure of partial dispensing or medication history capture. |
| P7 | MISSING | No reorder/expiry or controlled-drug register model found | Absent. |
| PR1 | MISSING | No procedure model or order flow found | Absent. |
| A1 | MISSING | No admission order or ward model found | Absent. |
| A2 | MISSING | No bed allocation or ward class model found | Absent. |
| A3 | MISSING | No deposit or insurer approval model found | Absent. |
| A4 | MISSING | No inpatient conversion flow found | Absent. |
| A5 | MISSING | No nursing documentation model found | Absent. |
| A6 | MISSING | No rounds/progress-note workflow found | Absent. |
| A7 | MISSING | No ward pharmacy requisition flow found | Absent. |
| A8 | MISSING | No transfer audit model found | Absent. |
| A9 | MISSING | No recurring daily-charge posting logic found | Absent. |
| A10 | MISSING | No low-deposit bill alert logic found | Absent. |
| D1 | MISSING | No discharge order or final disposition model found | Absent. |
| D2 | MISSING | No discharge summary model found | Absent. |
| D3 | MISSING | No discharge prescription workflow found | Absent. |
| D4 | MISSING | No nursing clearance workflow found | Absent. |
| D5 | MISSING | No final-bill clearance or balance display found | Absent. |
| D6 | MISSING | No block-exit logic or financial clearance check found | Absent. |
| D7 | MISSING | No gate-pass/security verification found | Absent. |
| D8 | MISSING | No follow-up appointment/SMS reminder model found | Absent. |
| D9 | MISSING | No close-visit locking or reopen-with-approval logic found | Absent. |
| D10 | MISSING | No bed cleaning/available status workflow found | Absent. |
| Exception 1 | MISSING | No merge workflow or patient master-control model found | Absent. |
| Exception 2 | PARTIAL | [server/src/models/Patient.js](../server/src/models/Patient.js) | Emergency/unknown patient flow is not modelled; only a generic patient exists. |
| Exception 3 | MISSING | No left-without-being-seen or absconding workflow found | Absent. |
| Exception 4 | MISSING | No cancel/order-reversal model found | Absent. |
| Exception 5 | BROKEN | [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | Hard delete paths violate the void-never-delete rule. |
| Exception 6 | MISSING | No insurer-expiry and payer-switch audit model found | Absent. |
| Exception 7 | MISSING | No offline/downtime workflow or back-entry reconciliation model found | Absent. |
| Exception 8 | MISSING | No referral transfer/outflow workflow found | Absent. |
| Exception 9 | MISSING | No death, certificate, and mortuary handoff pipeline found | Absent. |
| Exception 10 | MISSING | No after-hours/holiday tariff model found | Absent. |
| Visit status lifecycle | PARTIAL | [server/src/models/MedicalVisit.js](../server/src/models/MedicalVisit.js) | Status is minimal (`open`, `completed`, `cancelled`) and does not implement the full state machine. |
| Back office | PARTIAL | [server/src/routes/medical.routes.js](../server/src/routes/medical.routes.js), [server/src/controllers/medicalBilling.controller.js](../server/src/controllers/medicalBilling.controller.js) | Some billing and workflow support exists, but no real insurance-claims, coding review, archiving, or finance reconciliation system is in place. |
| Reports and dashboards | PARTIAL | [client/src/modules/hmis/HMISPage.jsx](../client/src/modules/hmis/HMISPage.jsx), [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js) | Dashboard summary exists, but operational, clinical, financial, and statutory reporting are not implemented at the required depth. |
| NFR / security / privacy | PARTIAL | [server/src/middleware/auth.middleware.js](../server/src/middleware/auth.middleware.js), [server/src/config/db.js](../server/src/config/db.js), [server/src/app.js](../server/src/app.js) | JWT auth and Helmet/CORS are present, but 2FA, session timeout, encryption, backups, offline fallback, and audit-proofing are not implemented. |

## Key findings

### Bugs and design flaws
- Delete routes are destructive and violate the no-hard-delete requirement. See [server/src/controllers/medical.controller.js](../server/src/controllers/medical.controller.js).
- The current bill and visit data model is not tied to a full patient-care state machine, so the hospital can generate clinically meaningless records.
- There is no patient master data enforcement beyond uniqueness on `patientNumber`.
- Role-based access is not aligned with the requested hospital roles and is incomplete for operational areas like cashier, radiology, and pharmacy.

### Security flaws
- No audit log system exists for clinical/financial mutation events.
- No explicit consent/privacy capture exists for patient records.
- No encryption-at-rest or sensitive-field handling is evident.
- No session expiry / 2FA / least-privilege enforcement beyond JWT token checking.

### Performance and data integrity risks
- There are no indexes specified for search-heavy fields like patient phone, MRN, national ID, or visit status.
- The HMIS list endpoints use broad `find()` with no pagination; this will not scale once volumes increase.
- Duplicate patients are a risk because there is no deterministic fuzzy search + merge control.
- Billing is vulnerable to leakage because service order capture is not centralised and there is no payment gate across departments.

### Missing validations and workflow controls
- No validation for national ID and phone formats, duplicate MRN creation, or required consent.
- No state transitions guard for visit lifecycle.
- No voiding/refund/reversal path for wrong charges.
- No role restrictions for clinical actions beyond a basic module permission map.

## Questions
None at this point; the spec is detailed enough to proceed with a sensible, phased remediation plan.
