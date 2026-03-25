You are a senior full-stack developer.

Your task is to design and build a **complete, working web-based QR Attendance Management System** with clean architecture, minimal tech stack, and production-level code quality.

---

# 🎯 PROJECT OVERVIEW

Build a system where:
- Professors generate a **dynamic QR code (URL-based)** during class
- Students scan the QR using ANY QR scanner (or built-in scanner)
- The QR opens a web link that automatically marks attendance if the student is logged in
- Attendance is stored and visualized in dashboards

The system must be simple, efficient, and easy to deploy.

---

# ⚙️ TECH STACK (KEEP MINIMAL)

Frontend:
- HTML
- CSS
- Vanilla JavaScript

Backend:
- Node.js
- Express.js

Database:
- SQLite (chosen for simplicity, zero setup, and local development ease)

Other:
- QR generation library: qrcode
- Authentication method: Session-based authentication using cookies

---

# 🔐 AUTHENTICATION DESIGN

- Users login using ID + password
- Server creates session
- Session ID stored in **secure HttpOnly cookie**
- Cookie settings:
  - HttpOnly = true
  - Secure = true (if HTTPS)
  - SameSite = Strict

- No password stored in frontend

---

# 🧠 CORE FEATURES

## 👨‍🏫 Professor Side
- Login
- Create Subject
- Select subject
- Start session
- Display QR (auto-refresh every 5 seconds)
- View live attendance list
- End session
- Edit attendance
- Download attendance (CSV)

## 👨‍🎓 Student Side
- Login
- Scan QR (internal scanner OR external scanner)
- Automatic attendance marking via URL
- View:
  - Subject-wise attendance %
  - Date-wise attendance history

---

# 🌐 QR URL DESIGN (IMPORTANT UPDATE)

QR should encode a URL in this format:

https://____/mark?session_id=____&token=____

---

## QR Behavior

- Generated when professor starts session
- Refresh every 5 seconds
- Token changes every refresh
- Old tokens become invalid

---

## Token Design

Use secure token generation:

token = HMAC(session_id + timestamp, secret_key)

---

# 🔄 ATTENDANCE FLOW (UPDATED)

## Case 1: Student Already Logged In
1. Student scans QR using any scanner
2. Browser opens URL (/mark)
3. Cookie is automatically sent
4. Backend identifies student
5. Backend validates:
   - session is active
   - token is valid
   - not already marked
6. Attendance stored
7. Show success page

---

## Case 2: Student NOT Logged In
1. Scan QR
2. Redirect to login page
3. After login → redirect back to /mark URL
4. Attendance marked

---

# 📄 FRONTEND DESIGN

## Pages

### 1. Login Page
- ID, Password

---

### 2. Student Pages

#### a) Dashboard
- Subjects list
- Attendance %
- Button: Scan QR

#### b) Scanner Page
- Camera scan

#### c) Attendance Page
- Date | Present/Absent

#### d) Mark Result Page
- "Attendance Marked" or Error

---

### 3. Professor Pages

#### a) Dashboard
- Subject selection
- Start session

#### b) QR Page
- Large QR
- Auto-refresh every 5 sec
- End session

#### c) Live Attendance Page
- Student list
- Count

#### d) Reports Page
- CSV download

---

# 🔗 ROUTING DESIGN

Use multi-page architecture (simpler than SPA):

- /login
- /student/dashboard
- /student/attendance
- /scan
- /prof/dashboard
- /prof/session
- /mark (QR entry point)

---

# ⚙️ BACKEND IMPLEMENTATION

## /mark Route (CRITICAL)

- Extract session_id and token from URL
- Read user from cookie

If NOT logged in:
- Redirect to /login
- Save original URL

If logged in:
- Validate session
- Validate token (time-based)
- Check duplicate attendance

If valid:
- Insert attendance
- Return success page

Else:
- Return error page

---

## QR Generation

- On session start:
  - Create session
  - Generate token every 5 sec
  - Send URL to frontend

---

# 🗄️ DATABASE DESIGN

Tables:

Students(id, name, password, branch, semester)
Professors(id, name, password)
Subjects(id, name, professor_id)
Enrollments(student_id, subject_id)
Sessions(session_id, subject_id, start_time, end_time, status)
Attendance(student_id, session_id, timestamp)

---

# 📊 ADDITIONAL FEATURES

- Attendance % calculation
- Date-wise tracking
- Prevent duplicates
- Expired QR handling

---

# 🎨 UI REQUIREMENTS

- Clean, minimal
- Mobile-friendly
- Large QR display

---

# 📦 OUTPUT REQUIRED

- Folder structure
- Frontend code
- Backend code
- DB setup
- Run instructions

---

# ❓ ASSUMPTIONS

- College size: 600 students
- Class size: 100 students

---

Build step-by-step with clean code and explanations.