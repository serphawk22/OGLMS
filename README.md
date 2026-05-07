# LMS Platform

A full-stack Learning Management System (LMS) built with **Next.js 16**, **Prisma**, **PostgreSQL (Neon)**, **ZEGOCLOUD** live classroom, and **OpenAI** AI chatbot.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | PostgreSQL via Neon (serverless), Prisma ORM |
| Auth | JWT (`jose`) + HTTP-only cookies |
| Live Class | ZEGOCLOUD UIKit |
| AI Chatbot | OpenAI GPT-4o / GPT-4o-mini |
| Email | Nodemailer (SMTP / Ethereal for dev) |
| Real-time | 30-second polling + `router.refresh()` |

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # All API routes (Node.js runtime)
│   │   ├── auth/               # login, register
│   │   ├── assignments/        # submit, grade
│   │   ├── chat/               # AI chatbot + history
│   │   ├── instructor/         # expertise, meets
│   │   ├── live-session/       # status updates
│   │   ├── reviews/            # course reviews CRUD
│   │   ├── student/            # profile, enroll, activity, notifications, events, meets
│   │   ├── summarize/          # AI text summarizer
│   │   ├── webhooks/           # ZEGOCLOUD webhooks
│   │   └── zego-token/         # ZEGOCLOUD token endpoint
│   ├── instructor/             # Instructor dashboard + course builder
│   ├── student/                # Student dashboard + course view + profile
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   └── meet/[roomId]/          # Live classroom room
├── components/                 # Reusable UI components
└── lib/
    ├── prisma.ts               # Prisma singleton
    ├── notifications.ts        # Notification + Calendar event helpers
    └── mail.ts                 # Email helper (Nodemailer)
```

---

## Quick Setup (After Extracting ZIP)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

The `.env` file is included. For a fresh deployment, update:

```env
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET="your_strong_secret_key"
OPENAI_API_KEY="your_openai_key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ZEGOCLOUD credentials
NEXT_PUBLIC_ZEGO_APP_ID=your_app_id
NEXT_PUBLIC_ZEGO_APP_SIGN="your_app_sign"
ZEGO_SERVER_SECRET="your_server_secret"
```

### 3. Sync Database Schema

```bash
npx prisma db push
npx prisma generate
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## User Roles

| Role | Access |
|------|--------|
| **INSTRUCTOR / ADMIN** | Create courses, modules, lessons, assignments, quizzes, live sessions. View student submissions and grade them. |
| **STUDENT** | Browse and enroll in published courses. Watch videos, submit assignments, take quizzes, join live classes, leave reviews. |

### Registration Flow
- **Instructor**: Register with `role = INSTRUCTOR` + organization name → creates a new org, assigned `ADMIN` role
- **Student**: Register with `role = STUDENT` + existing `organizationId` → joins that org as `STUDENT`

---

## Key Features

### Instructor Dashboard
- Create & publish courses (modules, lessons, reading materials, assignments, quizzes)
- Schedule and start ZEGOCLOUD live classes with automatic email + in-app notifications to enrolled students
- View and grade student assignment submissions
- Real-time enrolled student count (from `Enrollment` table)
- Editable expertise/skills list

### Student Dashboard
- Browse all published courses in the organization
- One-click enrollment with instant UI feedback
- Track progress: learning hours, daily streak, achievement badges
- AI course chatbot (GPT-4o-mini) with file upload support
- Calendar of upcoming events, notification bell
- Leave and edit course reviews

### Real-Time Sync
- Dashboards refresh every 30 seconds via `router.refresh()`
- Activity tracking: video views, material opens, assignment submissions → feeds streak and recent activity
- Notifications created on enrollment, new modules, assignments, and live session scheduling

---

## Database Schema

Key models: `User`, `Organization`, `OrganizationMember`, `Course`, `Module`, `Lesson`, `ReadingMaterial`, `Assignment`, `AssignmentSubmission`, `Quiz`, `Question`, `Enrollment`, `Review`, `LiveSession`, `Notification`, `Event`, `Chat`, `ChatMessage`

After any schema changes:
```bash
npx prisma db push
npx prisma generate
```

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Configure real SMTP credentials in `.env` for email delivery
- [ ] Set `NODE_ENV=production` in your deployment environment
- [ ] Run `npm run build` to validate there are no TypeScript/build errors
