# Security Specification: Fuel WBS Firebase Firestore

## 1. Data Invariants
- `monthly_reports`: Every document must have a valid `id`, valid `bulan` (month name), non-negative numeric metrics (`totalVolume`, `totalHours`, `recordCount`), and valid ISO `uploadedAt` string.
- ID poisoning guard: All document IDs must be alphanumeric strings up to 128 characters without traversal or injection characters.
- Default-deny safety net protects all unmapped subpaths.

## 2. Payload Validation & Dirty Dozen Attack Prevention
1. **Schema Injection Attack**: Reject documents containing invalid non-numeric types for metrics (`totalVolume`, `totalHours`).
2. **ID Traversal Attack**: Prevent path manipulation in document IDs (`../`, `%20`, special characters).
3. **Negative Quantity Attack**: Block values where `totalVolume < 0` or `totalHours < 0`.
4. **Denial-of-Wallet Payload**: String sizes are limited to 128 chars for IDs, 200 chars for file names.
