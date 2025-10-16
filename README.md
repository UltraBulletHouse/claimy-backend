# Claimy Backend

Backend GraphQL API for the Claimy mobile application. Built with Next.js (App Router) and GraphQL Yoga, backed by MongoDB Atlas and Firebase Cloud Messaging.

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in the required secrets.
2. Install dependencies with `npm install`.
3. Start the development server:

```bash
npm run dev
```

The GraphQL endpoint is available at `http://localhost:3000/api/graphql`.

## Tech Stack

- Next.js App Router (API Routes)
- GraphQL Yoga
- MongoDB (Mongoose)
- JWT authentication (bcrypt + jsonwebtoken)
- Firebase Admin SDK for FCM

## Deployment

The project is configured for Vercel deployment using the provided `vercel.json`. Push to the `main` branch to trigger deployment.
# claimy-backend
