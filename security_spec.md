# Security Specification - Multi-User Billing App

## Data Invariants
1. A user MUST have a profile in the `users` collection with a valid role (`admin`, `billing`, `view-only`).
2. Only `admin` can promote/demote users or change business settings.
3. `billing` users can create and edit transactional data (invoices, clients, items, expenses).
4. `view-only` users can only perform read operations.
5. Critical fields like `invoiceNumber` must be strings with controlled size.

## The Dirty Dozen Payloads (Targeting Invoices/Users)

1. **Identity Spoofing**: Attempt to create an invoice as another user. (Should fail if we enforced ownerId, but here it's team-wide).
2. **Privilege Escalation**: Attempt to update own role to 'admin' from a non-admin account.
3. **Ghost Fields**: Attempt to add `verified: true` to an invoice or user profile.
4. **ID Poisoning**: Attempt to create a document with a 1MB string as ID.
5. **Type Confusion**: Sending `totalAmount: "1000"` (String instead of Number).
6. **Resource Exhaustion**: Sending `invoiceNumber` with 1MB of text.
7. **Orphaned Record**: Creating an invoice for a non-existent client (Relational Guard).
8. **Temporal Flux**: Setting `createdAt` to a future date instead of server timestamp.
9. **Status Shortcut**: A `view-only` user attempting to set an invoice to `Paid`.
10. **Admin Lockout**: Attempting to delete the last admin (Logic check, though hard in rules).
11. **PII Leak**: A signed-in user without a role attempting to list all `users`.
12. **Query Scraping**: Attempting to list all invoices without a filter that matches user's project/permission (General List query safety).

## Rules Logic

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }

    function isSignedIn() { return request.auth != null && request.auth.token.email_verified == true; }
    function getUser(uid) { return get(/databases/$(database)/documents/users/$(uid)).data; }
    function isAdmin() { return isSignedIn() && getUser(request.auth.uid).role == 'admin'; }
    function isBilling() { return isSignedIn() && getUser(request.auth.uid).role in ['admin', 'billing']; }
    function isAnyUser() { return isSignedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)); }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isSignedIn() && request.auth.uid == userId; // Initial self-reg
      allow update: if isAdmin();
    }
    
    // ... other collections follow isBilling() and isAnyUser()
  }
}
```
