import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from '@/api/graphql/schema';
import { resolvers } from '@/api/graphql/resolvers';
import { createContext } from '@/api/graphql/context';

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['*'];

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers
  }),
  context: async ({ request }) => createContext(request),
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['POST', 'GET', 'OPTIONS']
  },
  graphqlEndpoint: '/api/graphql',
  // Ensure the handler signature matches Next.js App Router (Request -> Response)
  fetchAPI: { Request, Response, Headers }
});

export async function GET(request: Request) {
  return yoga.fetch(request);
}
export async function POST(request: Request) {
  return yoga.fetch(request);
}
export async function OPTIONS(request: Request) {
  return yoga.fetch(request);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
