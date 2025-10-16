import { GraphQLContext } from '../context';
import { connectDB } from '../../lib/db';
import { hashPassword, comparePassword, generateToken } from '../../lib/auth';
import { sendFCMNotification } from '../../lib/fcm';

function ensureAuthenticated(ctx: GraphQLContext) {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
}

function buildAuthPayload(userDoc: any, token: string) {
  const user = userDoc.toJSON();
  return {
    token,
    user
  };
}

export const userResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) {
        return null;
      }

      await connectDB();

      const freshUser = await ctx.models.User.findById(ctx.user.userId).select('-password');
      return freshUser ? freshUser.toJSON() : null;
    }
  },
  Mutation: {
    signup: async (_parent: unknown, args: { email: string; password: string }, ctx: GraphQLContext) => {
      await connectDB();

      const existingUser = await ctx.models.User.findOne({ email: args.email.toLowerCase() });
      if (existingUser) {
        throw new Error('User already exists with that email.');
      }

      const hashedPassword = await hashPassword(args.password);
      const user = await ctx.models.User.create({
        email: args.email.toLowerCase(),
        password: hashedPassword
      });

      const token = generateToken({ userId: user.id, email: user.email });
      return buildAuthPayload(user, token);
    },
    login: async (_parent: unknown, args: { email: string; password: string }, ctx: GraphQLContext) => {
      await connectDB();

      const user = await ctx.models.User.findOne({ email: args.email.toLowerCase() });
      if (!user) {
        throw new Error('Invalid credentials.');
      }

      const isValid = await comparePassword(args.password, user.password);
      if (!isValid) {
        throw new Error('Invalid credentials.');
      }

      const token = generateToken({ userId: user.id, email: user.email });
      return buildAuthPayload(user, token);
    },
    updateFcmToken: async (_parent: unknown, args: { token: string }, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);
      await connectDB();

      const updatedUser = await ctx.models.User.findByIdAndUpdate(
        ctx.user!.userId,
        { fcmToken: args.token },
        { new: true }
      ).select('-password');

      if (!updatedUser) {
        throw new Error('Failed to update token.');
      }

      return updatedUser.toJSON();
    },
    sendNotification: async (
      _parent: unknown,
      args: { title: string; body: string; userId: string },
      ctx: GraphQLContext
    ) => {
      ensureAuthenticated(ctx);
      await connectDB();
      await sendFCMNotification(args.userId, args.title, args.body);
      return true;
    }
  }
};
