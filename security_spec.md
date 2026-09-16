# Security Spec

## Data Invariants

1. A workspace can only be created, read, or updated by its owner (ownerId == request.auth.uid).
2. Operators and HistoryRecords can only be accessed or modified if the user owns the parent workspace.
3. String fields have strict size limits.
4. Enums are enforced.

## Dirty Dozen Payloads

1. Create workspace with someone else's ownerId.
2. Read workspace owned by someone else.
3. Update workspace ownerId.
4. Create operator in someone else's workspace.
5. Create operator with missing required fields.
6. Create operator with name > 100 chars.
7. Create operator with invalid machineType.
8. Create history record without valid timestamp.
9. List operators in another user's workspace.
10. Update operator in another user's workspace.
11. Update system field in workspace.
12. Denial of wallet attack (injecting massive strings).
