# TruthLens Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Default Deny**: All unspecified Firestore paths are denied for read and write.
2. **PII Isolation**: `/users/{userId}` holds private email and investigator metadata; only the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) may read, create, update, or delete their own profile. Blanket `list` on `/users` is strictly denied.
3. **Master Gate & Owner Scoping**: `/users/{userId}/cases/{caseId}` requires the parent `/users/{userId}` document to exist on create/update (verified via `exists()`) and strictly enforces `userId == request.auth.uid` and `ownerId == request.auth.uid`.
4. **Temporal & Field Immutability**: `createdAt` must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on create and update; `uid`, `id`, and `ownerId` are immutable.
5. **Terminal State Lock**: Once a case's `status` becomes `'Archived'`, no further updates are permitted.
6. **Strict Schema & Bounds**: Every string has `.size()` bounds, IDs match `^[a-zA-Z0-9_\-]+$`, and `keys().hasAll(...) && keys().hasOnly(...)` / `affectedKeys().hasOnly(...)` block shadow fields.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Profile Read**: `get(/users/uid_1)` with `auth == null`.
2. **Cross-User PII Read**: `get(/users/uid_victim)` authenticated as `uid_attacker`.
3. **Unverified Email Write**: `create(/users/uid_1)` when `request.auth.token.email_verified == false`.
4. **Privilege Escalation Shadow Field**: `create(/users/uid_1)` injecting `{ ..., isAdmin: true, role: 'admin' }`.
5. **ID Poisoning**: `create(/users/uid_1/cases/a*200_bad!chars)` exceeding 128 chars or invalid regex.
6. **Identity Spoofing on Case**: `create(/users/uid_1/cases/case_1)` with `ownerId: 'uid_victim'`.
7. **Orphaned Subcollection Write**: `create(/users/uid_1/cases/case_1)` when parent `/users/uid_1` does not exist.
8. **Client Timestamp Forgery**: `create(/users/uid_1/cases/case_1)` with past `createdAt != request.time`.
9. **Immutable Field Mutation**: `update(/users/uid_1/cases/case_1)` attempting to change `ownerId` or `createdAt`.
10. **Terminal State Bypass**: `update(/users/uid_1/cases/case_archived)` where `existing().status == 'Archived'`.
11. **Value Poisoning / Resource Exhaustion**: `update(/users/uid_1/cases/case_1)` with `summary` length > 1500 chars or invalid enum `status: 'Hacked'`.
12. **Blanket Collection Scrape**: `list(/users)` or `list(/users/uid_victim/cases)` by non-owner.
