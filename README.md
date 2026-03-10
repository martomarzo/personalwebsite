# Martín Marzorati - Personal Portfolio & Dynamic CV

A modern, fully dynamic, and bilingual personal portfolio website. This project has evolved from a static HTML site into a robust full-stack application, featuring a custom Admin Panel for content management, multi-version support, and a professional documentation page.

## 🚀 Core Features

### 1. Dynamic Content Management
- **Full-Stack Architecture:** Powered by a Node.js/Express backend and a PostgreSQL database.
- **Admin Panel:** A dedicated dashboard (`/admin`) to manage all professional data without touching code.
- **Content Pools:** Unified database for Experience, Education, Projects, and Skills that can be reused across different CV versions.

### 2. Professional Versioning & Privacy
- **Unique URL Slugs:** Generate custom links for specific job applications (e.g., `?v=pm-lead` or `?v=devops-specialist`).
- **One-Click Duplication:** Easily clone an existing resume version to create a tailored variation in seconds.
- **Automatic Slug Generation:** Slugs are automatically synchronized with version names for clean, professional URLs.

### 3. Truly Bilingual (English & Spanish)
- **Seamless Toggling:** Visitors can switch between English and Spanish with a single click.
- **Bilingual Section Titles:** Customize section headers (e.g., "Experience" vs "Experiencia") independently for each language.
- **Side-by-Side Editing:** The Admin Panel features a bilingual modal layout for simultaneous EN/ES content management.

### 4. Modern UI/UX
- **Glassmorphism Design:** A sleek, semi-transparent navigation bar and card system.
- **Dark Mode:** A persistent, high-contrast dark theme with a floating toggle.
- **Scroll Animations:** Smooth "fade-in and slide-up" effects as sections enter the viewport.
- **Dynamic Navigation:** The nav bar automatically updates based on section visibility and custom titles.
- **Custom Notifications:** Sleek "Toast" notifications for a modern feedback experience in the Admin Panel.

### 5. Server Documentation
- **Integrated Specs:** A dedicated `server-info.html` page styled to match the main portfolio.
- **Smart Navigation:** A "Back to Portfolio" button that remembers exactly which resume version the user came from.

---

## 🛠 Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), CSS3 (Custom Variables, Flexbox/Grid), HTML5.
- **Backend:** Node.js, Express.js.
- **Database:** PostgreSQL.
- **Libraries:** 
  - `pg` (PostgreSQL client)
  - `multer` (File uploads for profile pictures)
  - `dotenv` (Environment variable management)
  - `cors` (Cross-origin resource sharing)
  - `puppeteer` (Ready for PDF generation)

---

## 📂 Project Structure

```text
├── backend/
│   ├── index.js          # Express server & API routes
│   └── database.sql      # Database schema & migrations
├── public/uploads/       # Uploaded profile pictures
├── photos/               # Static assets & icons
├── files/                # Downloadable documents
├── index.html            # Main portfolio entry point
├── server-info.html      # Server documentation page
├── portfolio-main.js     # Main frontend logic
├── admin.html            # Admin Panel UI
├── admin-dashboard.js    # Admin Panel logic
├── styles.css            # Global & Portfolio styles
└── admin.css             # Admin-specific styles
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v16+)
- PostgreSQL Database

### Installation
1. Clone the repository.
2. Navigate to the `backend` directory:
   ```bash
   cd backend
   npm install
   ```
3. Create a `.env` file in the `backend` folder with your credentials:
   ```text
   PORT=3000
   DB_USER=your_user
   DB_HOST=your_host
   DB_DATABASE=resume
   DB_PASSWORD=your_password
   DB_PORT=5432
   ```

### Database Setup
Run the `backend/database.sql` script in your PostgreSQL instance to initialize the schema.

### Running the Application
Start the server:
```bash
node backend/index.js
```
The website will be available at `http://localhost:3000`.

---

## 📄 License
© 2025 Martín Marzorati. All rights reserved.
