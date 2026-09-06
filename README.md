# Medico Student Support

Role-based Student Support & History Management for Medico’s internal team.

## What it does

- Permanent student profiles with lifetime support history
- Super Admin, Manager, and Moderator roles (enforced in API + UI)
- Manual support creation and Excel/CSV import with column mapping + preview
- Individual and bulk assignment by branch / group / batch / support type
- Moderator workflow: Pending → In Progress → Completed (outcome note required)
- Global search, dashboards, activity log

## Setup

1. Copy `.env.example` to `.env.local`
2. Set `MONGODB_URI` (MongoDB Atlas) and a long `JWT_SECRET`
3. Install and seed:

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo accounts

Password for all: `Medico@123`

- Super Admin: `admin@medico.local`
- Manager: `manager@medico.local`
- Moderator: `moderator.a@medico.local`
"# MedicoBook-Moderators-Support" 
