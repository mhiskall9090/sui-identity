# Migrating SuiVerify from India Aadhaar to Ghana Identity Verification

This document explains the non-code changes and configuration steps required to adapt SuiVerify (originally targeting India Aadhaar verification) to verify Ghanaian identity documents and individuals. It intentionally avoids code modifications and focuses on configuration, data handling, privacy, and integration points.

High-level considerations
- Legal & compliance: Verify Ghana's laws for identity data processing and storage. Ensure compliance with Ghana's Data Protection Act and any local regulations.
- Data formats: Ghana identity documents (e.g., Ghana Card, Passport) have different fields and formats vs Aadhaar. Update OCR templates and extraction mapping accordingly.
- OTP/SMS: Ensure OTP providers support Ghana phone numbers and international SMS routing.
- Language and localization: Ghana primarily uses English; account for any local scripts or formats when extracting names and addresses.

Steps to adapt (no code change)

1) Update configuration & training data
- OCR templates: Replace or add OCR templates/training for Ghana Card and Passport images in the OCR provider or local OCR service configuration. If you use an external OCR provider, upload sample Ghana ID images and fine-tune any template matching / field extraction rules.
- Field mapping: Create a mapping document that maps OCR output fields into your application data model (for Aadhaar fields such as 'aadhar_number' -> 'ghana_card_number' or passport fields). Keep this mapping outside of code (e.g., as a JSON config) and point the OCR service at it.

2) Update validation rules (configuration)
- National ID formats: Add the regex/validation rules for Ghana Card numbers and passport numbers into configuration files (for example, `verification-backend/config/validation.json` or environment-provided rules). Ensure checksum rules (if any) are included.
- Phone format: Update phone number parsing/validation to accept Ghana country code +233.

3) OTP provider / SMS settings
- Ensure the OTP/SMS provider account used in `verification-backend` supports sending OTPs to Ghana (+233). Update API credentials or SMS sender IDs in `.env` or your secrets manager.

4) Localization and UI text
- Frontend copy: Update labels and instructions referring specifically to Aadhaar to include Ghana options. Provide a switch in your UX for selecting document type (Ghana Card, Passport).
- Language: Verify phrasing and date formats match local expectations.

5) ID Proofing & Face Match
- Acceptable photos: Document the acceptable Ghana ID photo requirements in the UI (size, orientation, visibility of MRZ or national emblem).
- Face reference: If you rely on a government API for face/identity checks, obtain access for Ghana's system (if available). Otherwise, rely on your existing face-match workflow but update thresholds if needed based on data quality.

6) Privacy & Data retention
- Minimize PII retention: Only keep derived verification decisions and necessary metadata. Avoid storing full ID images unless required and encrypted.
- Encryption: Ensure `encryption_service` is properly configured with keys and `encryption_metadata` indexes are set. Use secure key management.

7) Testing and QA
- Collect representative Ghana ID samples and run them through your OCR and face-match flow in a staging environment.
- Test OTP delivery to Ghana numbers.
- Validate end-to-end flows and logging to ensure no PII leaks.

8) Optional: Country Profiles (best practice)
- Create a config file per-country, e.g., `configs/country_profiles/ghana.json` containing:
  - Document types supported (GhanaCard, Passport)
  - OCR template name / OCR provider profile
  - Validation regexes
  - Phone country code
  - UI labels

  Having per-country profiles means you can adapt behavior without code changes — the app reads the selected country profile on startup.

Summary checklist
- [ ] Legal review for Ghana data protection
- [ ] OCR templates for Ghana Card and Passport
- [ ] Validation rules for Ghana IDs and phone numbers
- [ ] OTP/SMS provider check and config updates
- [ ] Frontend copy and localization updates
- [ ] Staging tests with Ghana sample data
- [ ] Update docs and operations runbooks

If you want, I can:
- produce a sample `configs/country_profiles/ghana.json` you can drop into the repo and wire by configuration (no code changes required)
- update frontend copy and add a country selector UI (this will require code changes)
