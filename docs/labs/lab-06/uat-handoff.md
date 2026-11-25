# SerWongSerWay — Sprint 1 UAT Preparation & Handoff Plan (EN / TH)

**Course:** CPE334 Software Engineering — Lab 6 (Part A: UAT Preparation & Handoff)

## 1. Release Identification & Team Metadata / ข้อมูลเวอร์ชันและทีมผู้รับผิดชอบ

| Item / รายการ | Details / รายละเอียด | 
| ----- | ----- | 
| **Application Name / ชื่อระบบ** | **SerWongSerWay** — Review & Survey Management System | 
| **Product Team (Authors) / ทีมผู้พัฒนา** | `Khanatip Nokkhunthot 67070501008` & `Chetsada Kiatkamonwong 67070501080` | 
| **Independent UAT Team / ทีมทดสอบอิสระ** | `Thanwarat Chantana 67070501025` & `Aphisamai Kulpaibutr 67070501077` | 
| **Deployed Application URL / ลิงก์ระบบจริง** | `https://serwongserway-vs56b635aq-as.a.run.app` | 
| **GitHub Repository / คลังซอร์สโค้ด** | `https://github.com/Khanatip112/SerWongSerWay` | 
| **Tested Branch & Commit / สาขาและเลข Commit** | `main` (`752a76a8e0a66764234c8de56df9510a6eb5ef78`) |
| **Cloud Run Revision / หมายเลข Revision** | `serwongserway-00011-xz7` |

## 2. Safe Test Accounts (No Passwords Included) / บัญชีทดสอบปลอดภัย

> **Security Notice / ข้อกำหนดความปลอดภัย:**
> Passwords and secret values are intentionally omitted from this document and shared privately via direct message. Do not commit credentials to Git or paste them into the final PDF.
> *(รหัสผ่านของบัญชีทดสอบถูกส่งให้ทางแชตส่วนตัวแยกต่างหาก ห้ามบันทึกรหัสผ่านลงในไฟล์นี้หรือในรายงาน PDF)*

| Account Label | Email Identifier | Role | Testing Purpose / วัตถุประสงค์การใช้งาน | 
| ----- | ----- | ----- | ----- | 
| **Creator Account 1** | `james.and@gmail.com` | `CREATOR` | Create/edit drafts, publish surveys, and inspect responses. *(สร้าง/แก้ไขแบบร่าง เผยแพร่ และดูผลตอบกลับ)* | 
| **Creator Account 2** | `william.tho@gmail.com` | `CREATOR` | Verify cross-creator ownership isolation. *(ทดสอบการป้องกันการเข้าถึงข้อมูลของ Creator คนอื่น)* | 
| **Respondent Account 1** | `amelia.cla@gmail.com` | `RESPONDENT` | Submit new surveys and view read-only submission history. *(ทำแบบสอบถามใหม่และดูประวัติคำตอบย้อนหลัง)* | 
| **Respondent Account 2** | `daniel.rob@gmail.com` | `RESPONDENT` | Secondary respondent for multi-submission verification. *(ผู้ตอบคนที่สองสำหรับทดสอบการส่งคำตอบและสิทธิ์เข้าถึง)* | 

## 3. Sprint 1 Scope & Data Hygiene Rules / ขอบเขตงานและข้อตกลงการใช้ข้อมูลทดสอบ

* **Accepted-for-Test Sprint 1 Scope (ขอบเขตที่ทดสอบ):**

  * Session-based authentication (`Login` / `Logout`) and role-based route protection (`CREATOR` vs `RESPONDENT`).

  * Creator survey authoring: `Save Draft`, edit existing draft (`View Details`), future `Closing Deadline *` validation, two supported question types (`1–5 Star Rating` and `Open-ended Text Feedback`), `Publish Survey`, and `View Responses` analytics.

  * Respondent participation: browsing active `PUBLISHED` surveys (excluding `DRAFT`, `CLOSED`, and expired surveys), single-submission response collection, and read-only submission history (`View Responses`).

* **Test Data Setup & Cleanup (การตั้งชื่อและดูแลข้อมูลทดสอบ):**

  * The environment is pre-seeded with 10 deterministic demo surveys (`3 DRAFT`, `4 PUBLISHED`, `3 CLOSED`).

  * When creating new surveys or submitting responses during UAT, prefix titles/answers with `[UAT]` and avoid modifying or deleting pre-seeded baseline surveys so test cases remain independent and reproducible.

## 4. Executable Sprint 1 UAT Test Cases / กรณีทดสอบสำหรับทีม UAT

### UAT-01: Normal Domain Journey (Create, Publish, Submit & View Responses)

* **Requirement / AC Reference:** `AC-01`, `AC-04`, `AC-07`

* **Roles:** `Creator Account 1` & `Respondent Account 1`

* **Preconditions:** Both accounts exist; neither has interacted with the newly created survey yet.

* **User Actions & Synthetic Inputs (ขั้นตอนการทดสอบ):**

  1. **\[EN\]** Log in as **Creator 1** (`james.and@gmail.com`) and open **+ Create Survey**.
     **\[TH\]** ล็อกอินด้วย **Creator 1** และกดแท็บ **+ Create Survey**

  2. **\[EN\]** Enter Title: `[UAT] Lab 6 Service Check`, Description: `End-to-end UAT verification`, and select a future **Closing Deadline**.
     **\[TH\]** กรอกชื่อ `[UAT] Lab 6 Service Check` คำอธิบาย และเลือกวันเวลาปิดรับในอนาคต

  3. **\[EN\]** Add 2 questions: Q1 (`1–5 Star Rating`, Required: `Overall usability`) and Q2 (`Open-ended Text Feedback`: `Additional comments`), then click **Publish Survey**.
     **\[TH\]** เพิ่มคำถาม 2 ข้อ (แบบดาว 1–5 และแบบข้อความปลายเปิด) แล้วกด **Publish Survey**

  4. **\[EN\]** Log out, log in as **Respondent 1** (`amelia.cla@gmail.com`), click **Take Survey** on `[UAT] Lab 6 Service Check`, select **4 stars**, enter `Smooth flow`, and click **Submit**.
     **\[TH\]** ออกจากระบบ แล้วล็อกอินด้วย **Respondent 1** กด **Take Survey** เลือก 4 ดาว พิมพ์ข้อความ แล้วกด **Submit**

  5. **\[EN\]** Log back in as **Creator 1** and click **View Responses** on `[UAT] Lab 6 Service Check`.
     **\[TH\]** กลับมาล็อกอินด้วย **Creator 1** และกดปุ่ม **View Responses**

* **Expected Result (ผลลัพธ์ที่คาดหวัง):**

  * **\[EN\]** Survey is created with `PUBLISHED` status; Respondent locks 4 yellow stars on click, submits cleanly, and sees `✓ Submitted` / `View Responses`; Creator sees **Total Submissions: 1**, **Average Star Rating: 4 / 5**, and Respondent 1's itemized answers.

  * **\[TH\]** สร้างแบบสอบถามสำเร็จและขึ้นสถานะ `PUBLISHED` ผู้ตอบเลือกดาวและส่งคำตอบได้ ปุ่มเปลี่ยนเป็น `View Responses` และผู้สร้างเห็นยอดส่ง 1 รายการ ค่าเฉลี่ย 4 / 5 ดาว พร้อมคำตอบครบทุกข้อ

### UAT-02: Business-Rule & Boundary Validation

* **Requirement / AC Reference:** `BR-02`, `BR-03`, `AC-05`

* **Roles:** `Creator Account 1` & `Respondent Account 1`

* **Preconditions:** Seeded `CLOSED` survey `Archived Orientation Feedback 2026` exists.

* **User Actions & Synthetic Inputs (ขั้นตอนการทดสอบ):**

  1. **\[EN\]** Logged in as **Creator 1**, open **+ Create Survey**, fill in Title & Description, leave a question prompt blank (or omit Closing Deadline), and click **Publish Survey**.
     **\[TH\]** ล็อกอิน **Creator 1** เปิดหน้า **+ Create Survey** แล้วกด **Publish Survey** โดยเว้นว่างคำถามหรือไม่เลือกวันปิดรับ

  2. **\[EN\]** Log in as **Respondent 1** and check the survey list for `Archived Orientation Feedback 2026` (`CLOSED`).
     **\[TH\]** ล็อกอิน **Respondent 1** ตรวจสอบรายการแบบสอบถามที่สถานะ `CLOSED`

  3. **\[EN\]** Open an active survey (`Developer Tooling & Cloud Lab Readiness`) and click **Submit** without answering required (`*`) questions.
     **\[TH\]** กดเข้าทำแบบสอบถามที่เปิดอยู่ แล้วกด **Submit** โดยไม่กรอกข้อที่บังคับ (`*`)

* **Expected Result (ผลลัพธ์ที่คาดหวัง):**

  * **\[EN\]** Publishing without valid questions or a future deadline is blocked with a red error alert; `CLOSED` or expired surveys are excluded from Respondent's open surveys; incomplete required answers cannot be submitted.

  * **\[TH\]** ระบบปฏิเสธการ Publish และแสดงแจ้งเตือนสีแดง แบบสอบถามที่ปิดรับแล้วไม่แสดงให้ผู้ตอบกดทำ และระบบบล็อกการส่งหากกรอกข้อบังคับไม่ครบ

### UAT-03: Forbidden Role & Ownership Access Control

* **Requirement / AC Reference:** `NFR-01`, `AC-03`, `AC-06`

* **Roles:** `Respondent Account 1` & `Creator Account 2`

* **Preconditions:** Survey `CPE 334 Course Experience Survey` (`00000000-0000-4000-8100-000000040000`) is owned by Creator 1.

* **User Actions & Synthetic Inputs (ขั้นตอนการทดสอบ):**

  1. **\[EN\]** Logged in as **Respondent 1**, manually navigate via the browser address bar to `/campaigns/new` and `/campaigns/00000000-0000-4000-8100-000000040000/results`.
     **\[TH\]** ล็อกอิน **Respondent 1** แล้วพิมพ์ URL `/campaigns/new` และ `/campaigns/00000000-0000-4000-8100-000000040000/results` โดยตรง

  2. **\[EN\]** Log out and log in as **Creator 2** (`william.tho@gmail.com`), then manually navigate to `/campaigns/00000000-0000-4000-8100-000000040000/results` and `/campaigns/00000000-0000-4000-8100-000000040000/respond`.
     **\[TH\]** สลับเป็น **Creator 2** แล้วพิมพ์ URL เข้าดูผลลัพธ์หรือหน้าทำแบบสอบถามของ **Creator 1**

* **Expected Result (ผลลัพธ์ที่คาดหวัง):**

  * **\[EN\]** Every unauthorized cross-role or cross-owner URL access is blocked and redirected to `/campaigns` with a prominent red error alert banner; no protected state is disclosed or changed.

  * **\[TH\]** ระบบปฏิเสธการเข้าถึงข้ามบทบาทและข้ามเจ้าของทุกกรณี เด้งกลับหน้าหลักพร้อมแบนเนอร์แจ้งเตือนสีแดง และไม่เปิดเผยข้อมูลผลลัพธ์ของผู้อื่น

### UAT-04: State, Persistence & Read-Only Submission History

* **Requirement / AC Reference:** `AC-08`, `AC-09`

* **Roles:** `Creator Account 1` & `Respondent Account 1`

* **Preconditions:** Seeded `DRAFT` survey `Q4 Student Club Budget Proposal` and submitted survey `CPE 334 Course Experience Survey` exist.

* **User Actions & Synthetic Inputs (ขั้นตอนการทดสอบ):**

  1. **\[EN\]** Logged in as **Creator 1**, click **View Details** on `Q4 Student Club Budget Proposal` (`DRAFT`), add 1 text question (`[UAT] Budget item`), click **Save Draft**, and reload the browser (`F5`).
     **\[TH\]** ล็อกอิน **Creator 1** กด **View Details** ที่รายการ `DRAFT` เพิ่มคำถาม 1 ข้อ กด **Save Draft** แล้วกดรีเฟรชหน้าเว็บ (`F5`)

  2. **\[EN\]** Log in as **Respondent 1**, verify the draft is NOT visible, then click **View Responses** on `CPE 334 Course Experience Survey` (`✓ Submitted`) and reload the page.
     **\[TH\]** ล็อกอิน **Respondent 1** ตรวจว่าไม่เห็นแบบร่างนั้น จากนั้นกด **View Responses** บนรายการที่ขึ้น `✓ Submitted` แล้วรีเฟรชหน้าเว็บ

* **Expected Result (ผลลัพธ์ที่คาดหวัง):**

  * **\[EN\]** Draft edits persist across reload, remain `DRAFT`, and stay hidden from Respondents; Respondent's read-only submission history displays the submission timestamp and all previously saved answers across reload without allowing resubmission.

  * **\[TH\]** ข้อมูลแบบร่างที่แก้ไขยังคงอยู่หลังรีเฟรชและไม่แสดงฝั่งผู้ตอบ ประวัติคำตอบของผู้ตอบแสดงครบทุกข้อในโหมดอ่านอย่างเดียวและไม่สามารถส่งซ้ำได้

## 5. Independent UAT Execution & Sign-Off Record / แบบบันทึกผลการทดสอบจากทีม UAT

| Case ID | Tester Name & Date/Time | Actual Result & Evidence ID / ผลลัพธ์จริงที่พบ | Status | 
| ----- | ----- | ----- | ----- | 
| **UAT-01** |  |  | `PASS / FAIL` | 
| **UAT-02** |  |  | `PASS / FAIL` | 
| **UAT-03** |  |  | `PASS / FAIL` | 
| **UAT-04** |  |  | `PASS / FAIL` | 

* **Final Sprint 1 Acceptance Decision (by Independent UAT Team):**

  * `[ ] Accepted`

  * `[ ] Accepted with documented minor limitations`

  * `[ ] Not Accepted`

* **Tested Release / Revision:** `___________________________`

* **UAT Team Sign-off & Date:** `___________________________`