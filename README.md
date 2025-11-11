# HR & Compliance Management System

A comprehensive web-based platform designed for healthcare and care organizations to manage employees, clients, compliance tracking, document management, and more.

## Overview

This system streamlines HR operations and compliance management for care organizations by providing an integrated solution for employee management, client tracking, leave requests, document signing, compliance monitoring, and job applications.

## Key Features

### 👥 Employee Management
- Complete employee lifecycle management
- Role-based access control
- Document tracking and expiry alerts
- Employee portal for self-service

### 🏥 Client Management
- Client profiles and information tracking
- Compliance period management
- Spot checks and care worker statements
- Client-specific documentation

### 📅 Leave Management
- Leave request submission and approval workflow
- Multiple leave types (annual, sick, unpaid, etc.)
- Leave balance tracking
- Calendar integration

### 📄 Document Management & Digital Signing
- Secure document storage and organization
- Digital signature requests and tracking
- PDF template management
- Field designer for custom forms
- Automated completion notifications

### ✅ Compliance Tracking
- Automated compliance period generation
- Compliance record management by type
- Annual appraisals and supervision forms
- Medication competency assessments
- Questionnaire builder
- Spot check forms
- Real-time compliance status monitoring

### 💼 Job Applications Portal
- Public-facing application form
- Multi-step application process
- Reference request automation
- Application status tracking
- Interview scheduling
- Customizable form fields and settings

### 📊 Reports & Analytics
- Dashboard with real-time metrics
- Document expiry tracking
- Compliance rate monitoring
- Branch health scores
- Activity timeline
- Geographic distribution maps

### 🔐 User Management
- Multi-level user roles (Admin, Manager, Employee)
- Granular permission system
- Branch-based access control
- Secure authentication

## Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **Backend**: Supabase (PostgreSQL database, Authentication, Storage, Edge Functions)
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **PDF Generation**: jsPDF, pdf-lib
- **Charts**: Recharts
- **Maps**: react-simple-maps
- **Routing**: React Router v6

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## Project Structure

```
├── src/
│   ├── components/         # React components organized by feature
│   │   ├── clients/       # Client management components
│   │   ├── compliance/    # Compliance tracking components
│   │   ├── dashboard/     # Dashboard and analytics
│   │   ├── documents/     # Document management
│   │   ├── employees/     # Employee management
│   │   ├── job-application/ # Job application portal
│   │   ├── leaves/        # Leave management
│   │   ├── settings/      # System settings
│   │   └── ui/           # Reusable UI components
│   ├── contexts/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # Supabase client and types
│   ├── lib/              # Utility functions and PDF generators
│   ├── pages/            # Page components (routes)
│   └── utils/            # Helper utilities
├── supabase/
│   └── functions/        # Supabase Edge Functions
└── public/               # Static assets
```

## Key Modules

### Dashboard
Provides real-time overview of:
- Employee and client counts
- Compliance rates and pending items
- Document expiry alerts
- Leave requests
- Recent activity feed
- Branch health scores
- Geographic distribution

### Compliance System
Automated compliance management including:
- Periodic compliance record generation
- Multiple compliance types (supervision, appraisal, spot checks, etc.)
- Care worker statement collection
- Automated notifications and reminders
- Data archival policies

### Document Signing
Digital signature workflow featuring:
- Template creation and management
- Custom field placement
- Multi-party signing requests
- Email notifications
- Signed document storage
- Audit trail

### Job Application Portal
Complete recruitment solution with:
- Multi-step application form
- Personal information collection
- Employment history
- References with automated email requests
- Skills and experience assessment
- Availability scheduling
- Application review and status tracking

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Deployment

This application can be deployed to any static hosting service that supports single-page applications (SPA):

- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages
- Any other static hosting provider

Ensure environment variables are properly configured in your hosting platform.

## Environment Variables

Required environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anonymous/public key |

## Database Setup

The application requires a Supabase PostgreSQL database with the appropriate schema. Database migrations are located in `supabase/migrations/`.

## Edge Functions

Several Supabase Edge Functions provide backend functionality:
- `send-reference-email` - Sends reference request emails
- `send-signing-request` - Sends document signing requests
- `compliance-automation` - Automates compliance period generation
- `compliance-notifications` - Sends compliance reminders
- `admin-reset-password` - Admin password reset functionality
- And more in `supabase/functions/`

## License

Proprietary - All rights reserved

## Support

For support and questions, please contact your system administrator.
