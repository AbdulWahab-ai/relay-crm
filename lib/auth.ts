import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { db } from './db';
import { rateLimit } from './security';
import { createWorkspace } from './plans';
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email || '').trim().toLowerCase();
        if (
          !email ||
          !credentials?.password ||
          credentials.password.length > 128
        )
          return null;
        await rateLimit('login:' + email, 10, 900);
        const user = await db.user.findUnique({ where: { email } });
        const valid = await compare(
          credentials.password,
          user?.passwordHash ||
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxfqNzJjZDQi4VIiZnQjzM41ZEm',
        );
        if (!valid || !user?.passwordHash) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!(profile as any)?.email_verified || !user.email) return false;
      const existing = await db.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
      });
      if (existing) {
        user.id = existing.userId;
        return true;
      }
      if (
        await db.user.findUnique({ where: { email: user.email.toLowerCase() } })
      )
        return '/login?error=AccountNotLinked';
      const created = await db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email: user.email!.toLowerCase(),
            name: user.name || 'New user',
            image: user.image,
            emailVerified: new Date(),
            accounts: {
              create: {
                type: 'oauth',
                provider: 'google',
                providerAccountId: account.providerAccountId,
              },
            },
          },
        });
        await createWorkspace(tx, u.id, `${u.name.split(' ')[0]}'s workspace`);
        return u;
      });
      user.id = created.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.sub;
      return session;
    },
  },
};
