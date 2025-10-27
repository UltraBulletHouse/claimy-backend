import { GraphQLContext } from '../context';
import { connectDB } from '../../lib/db';

function ensureAuthenticated(ctx: GraphQLContext) {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
}

export const rewardResolvers = {
  Query: {
    getRewards: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);
      await connectDB();
      const rewards = await ctx.models.Reward.find({ userId: ctx.user!.userId }).sort({ createdAt: -1 });
      return rewards.map((rewardDoc) => rewardDoc.toJSON());
    }
  },
  Mutation: {
    addReward: async (
      _parent: unknown,
      args: { store: string; code: string; amount: number },
      ctx: GraphQLContext
    ) => {
      ensureAuthenticated(ctx);
      await connectDB();
      const rewardDoc = await ctx.models.Reward.create({
        userId: ctx.user!.userId,
        store: args.store,
        code: args.code,
        amount: args.amount
      });
      return rewardDoc.toJSON();
    },
    markRewardUsed: async (_parent: unknown, args: { id: string; used: boolean }, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);
      await connectDB();
      const rewardDoc = await ctx.models.Reward.findOneAndUpdate(
        { _id: args.id, userId: ctx.user!.userId },
        { used: args.used },
        { new: true }
      );

      if (!rewardDoc) {
        throw new Error('Reward not found or access denied.');
      }

      return rewardDoc.toJSON();
    }
  }
};
