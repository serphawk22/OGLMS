# 🎓 Enterprise Multi-Tenant LMS

A high-performance, multi-tenant Learning Management System built with Next.js App Router, Prisma, PostgreSQL, and a custom Edge-compatible JWT authentication engine.

## 🚀 Tech Stack
- **Framework:** Next.js 16.2 (App Router)
- **Database:** PostgreSQL (Hosted via Neon)
- **ORM:** Prisma 7 (with `@prisma/adapter-pg` for Edge compatibility)
- **Authentication:** Custom JWT (using `jose` for Edge Middleware and `bcryptjs`)
- **Styling:** Tailwind CSS & shadcn/ui components

## 🏗️ Architecture Overview
This platform uses **Row-Level Multi-Tenancy**. This means:
1. **Organizations:** Instructors can create isolated "Workspaces" (e.g., "Masai School").
2. **Roles:** Users exist as `ADMIN` (Workspace Creator), `INSTRUCTOR` (Co-teachers), or `STUDENT`.
3. **Data Isolation:** All Courses, Daily Bites, and Enrollments are strictly tied to a specific `organizationId`. 

---

## 💻 Local Setup Instructions

Follow these steps exactly to get the project running on your local machine.

### Step 1: Clone the Repository
Open your terminal and run:
```bash
git clone https://github.com/serphawk22/lms-project.git
cd lms-project
```

### Step 2: Install Dependencies
Install all required NPM packages:
```bash
npm install
```

### Step 3: Configure Environment Variables
You must connect the app to a database and set a secure secret for the authentication tokens.

Create a new file in the root folder named exactly `.env`

Paste the following template into the file:
```env
# Connect to your PostgreSQL database (Neon recommended)
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]:5432/[DATABASE_NAME]?sslmode=require"

# Secret used to sign JWT tokens (can be any long random string locally)
JWT_SECRET="super_secret_local_dev_key_12345"
```
*(Ask the repository owner for the development database string if you are sharing a Neon database).*

### Step 4: Sync the Database (Prisma)
Before starting the server, you must push the Prisma schema to your database and generate the local Prisma Client. Run this command:
```bash
npx prisma db push
npx prisma generate
```

### Step 5: Start the Development Server
Run the local Next.js server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 How to Test the Authentication Flow
Because this is a multi-tenant system, you cannot just "sign up" into a void. Follow this exact flow to test the system locally:

1. **Create an Admin:** Go to `/register`. Select "I'm an Instructor" -> "Create Workspace". Name your workspace and register.
2. **Get the Invite Code:** Once logged in, you will be redirected to `/instructor`. You will see a blue box with a Workspace Invite Code. Copy this code.
3. **Create a Student/Co-Teacher:** Open an Incognito window. Go to `/register`. Select "I'm a Student" (or Join as Instructor) and paste the Invite Code.
4. **Verify:** Check the Admin dashboard in your main window—you will see the "Total Students" or "Active Instructors" metric update live!

---

## 📂 Key Directory Structure
- **src/app/api/auth/*** - Custom registration, login, and logout routes.
- **src/proxy.ts** - Edge middleware protecting the `/student` and `/instructor` routes.
- **src/lib/prisma.ts** - Global Prisma client setup with the pg-adapter.
- **prisma/schema.prisma** - The master database schema defining the multi-tenant architecture.
