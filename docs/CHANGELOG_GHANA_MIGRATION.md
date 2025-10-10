# Changelog: Code updates for Ghana migration

This document summarizes the code changes applied to make the repository more country-agnostic and to enable Ghana ID (Ghana Card / Passport) handling without heavy refactors. All changes were implemented as conservative, non-breaking updates and are listed below.

Files changed
- `verification-backend/app/services/ocr_service.py`
  - Made text extraction use a generic English language default (removed Tamil-specific default).
  - Generalized function docstrings from Aadhaar-specific to ID/generic.
  - Left Aadhaar-specific helpers present to keep backward compatibility.

- `verification-backend/app/routers/kyc.py`
  - `start-verification` endpoint now accepts `country` (default 'IN') and `doc_type` form fields.
  - Added a generic processing path for Ghana (`country='GH'`) that uses the OCRService text extraction and attempts to extract name, DOB, phone, and photo. ID number extraction for Ghana needs a custom regex/profile (see recommendations).
  - Kept India/Aadhaar flow as default when `country != 'GH'` to avoid breaking existing clients.
  - Changed stored temp data key from `aadhaar_data` to `id_data` for generality.

- `verification-backend/main.py`
  - Updated app title/description to be generic (ID OCR + Face Match ...)

New files added
- `scripts/index_all_gemini.ps1` — repo-wide indexer (prints commands and runs them sequentially).
- `README_IMPLEMENTATION.md` — high-level implementation README.
- `docs/GHANA_MIGRATION.md` — instructions on non-code migration steps (previously added).
- `docs/CHANGELOG_GHANA_MIGRATION.md` — this changelog.

What I didn't change
- I intentionally did not remove Aadhaar-specific helpers (e.g., `extract_aadhaar_data`) to keep backward compatibility.
- I did not implement advanced Ghana ID number regex extraction; this requires sample Ghana Card images to craft robust patterns.

Recommendations and next steps
1. Create `configs/country_profiles/ghana.json` with Ghana-specific regexes and OCR parameters. Example fields:
   - id_number_regex: pattern for Ghana Card and Passport numbers
   - phone_regex: Ghana phone patterns (e.g., local 9-digit or with +233)
   - ocr_langs: languages to pass to tesseract (likely 'eng')
2. Implement `OCRService.extract_id_number(text, profile)` to apply profile-specific regexes.
3. Update frontend to allow selecting country and document type; send `country` and `doc_type` in KYC start requests.
4. Add unit tests for Ghana extraction using sample images and expected outputs.
5. Improve photo extraction for different ID layouts (Ghana Card photo location differs from Aadhaar); consider template matching or ML-based detection for face cropping.
6. Securely handle PII: consider storing only hashed evidence in logs and encrypting any stored images.

How I validated changes
- Performed static edits and limited textual validation. I did not run the backend or indexing commands because that requires environment-specific dependencies and secrets (Tesseract install, GEMINI_API_KEY, MongoDB/Redis).

If you want, I can:
- create a sample `configs/country_profiles/ghana.json` and implement `extract_id_number` using that profile;
- update the frontend to send `country` and `doc_type` and to show Ghana-specific UI hints (this will require code changes in `frontend/src/components`);
- add unit tests and a small set of sample Ghana ID images for local testing.
