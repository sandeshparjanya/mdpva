# MDPVA Admin Portal

Mysore District Photographer and Videographers Association - Admin Portal for member management.

## Features

- **Admin Login**: Secure authentication for 3-4 administrators
- **Member Management**: View, search, and manage 1300+ members
- **Join Requests**: Review and approve/reject new member applications
- **Email Notifications**: Automated emails for requests and decisions
- **Audit Logging**: Track all admin actions

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Email**: Resend
- **Hosting**: Vercel

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   # Add your Supabase and Resend credentials
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   ```
   http://localhost:3000
   ```

## Project Structure

```
mdpva/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Login page
├── lib/
│   └── supabase.ts          # Database client
├── components/              # Reusable components
└── public/                  # Static assets
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `RESEND_API_KEY`: Resend email API key
- `FROM_EMAIL`: Email address for notifications
- `ADMIN_EMAILS`: Comma-separated list of admin emails

## Deployment

Deploy to Vercel with one click or push to GitHub and connect to Vercel.

## Support

For technical support, contact: support@mdpva.in
