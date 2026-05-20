# Security Specification

## 1. Data Invariants

1. **Posts (매물 목록)**
   - **Read Access**: Open to the general public (signed-in or anonymous).
   - **Write Access (Create/Update/Delete)**: Restrained exclusively to the verified administrator matching the pre-authorized email: `yunjia2miju@gmail.com`.
   - **Timestamp rule**: Custom creation dates must match server timestamp constraints where possible, and text properties must be tightly bounded in size (e.g., titles under 200 characters, body description under 5000 characters).

2. **Inquiries (상담/접수 의뢰)**
   - **Create Access**: Open to the general public (non-signed-in client visitors) so they can submit counseling forms.
   - **Read/Delete/Update Access**: Rigidly locked down exclusively to the verified administrator: `yunjia2miju@gmail.com`.

---

## 2. The "Dirty Dozen" Malicious Payloads (Permission Denied Verification)

1. **Anonymous Post Insertion**: An anonymous client attempts to create an arbitrary property listing under `/posts/{postId}`.
2. **Unauthorized Email Post Insertion**: A signed-in user with an unverified or non-admin email (e.g., `attacker@gmail.com`) attempts to create a property listing.
3. **Admin Email-Spoofing Attempt**: A signed-in user with email `yunjia2miju@gmail.com` but with `email_verified: false` attempts to write a post.
4. **Post Deletion by Attacker**: An unauthorized user attempts to delete a vital property listing.
5. **Post Title Over-injection (DoS)**: An attacker attempts to write a post with a 10MB title to exhaust storage.
6. **Inquiry Sniffing (Scraping)**: An attacker attempts to request a `list` query for all `/inquiries` to extract customer names and phone numbers.
7. **Direct Inquiry Modification**: An unauthorized user tries to change the state or mark inquiries as processed.
8. **Malicious ID Injection**: An attacker attempts to inject custom-crafted characters as a document ID (e.g. `../` etc).
9. **Fake Timestamp Injection**: Inserting a post with a mock `createdAt` value far in the future or past.
10. **Inquiry Deletion by Third-party**: An anonymous attacker attempts to clear logged incoming inquiries.
11. **Altering Admin Record on Client**: A client attempting to assign custom roles in rules locally.
12. **Blanket Inquiry Retrieval**: Attempting to bypass where queries to scrape personal customer records.

---

## 3. Test Cases Draft

```javascript
// Test cases to verify the Dirty Dozen:
// 1. anonymous cannot write to /posts
assertFails(db.collection('posts').add(postPayload));
// 2. non-admin user cannot write to /posts
assertFails(dbAsUser('user@example.com').collection('posts').add(postPayload));
// 3. non-verified admin user cannot write to /posts
assertFails(dbAsUserUnverified('yunjia2miju@gmail.com').collection('posts').add(postPayload));
// 4. anonymous cannot read inquiries
assertFails(db.collection('inquiries').get());
```
