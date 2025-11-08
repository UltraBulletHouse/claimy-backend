import { GraphQLContext } from '../context';
import { connectDB } from '../../lib/db';
import { CaseStatus } from '../../models/Case';
import { createCaseStatusNotification } from '../../lib/notificationService';

const VALID_STATUSES: CaseStatus[] = ['PENDING', 'IN_REVIEW', 'NEED_INFO', 'APPROVED', 'REJECTED'];

function ensureAuthenticated(ctx: GraphQLContext) {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
}

export const caseResolvers = {
  Query: {
    getCases: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);
      await connectDB();
      const cases = await ctx.models.Case.find({ userId: ctx.user!.userId }).sort({ createdAt: -1 });
      return cases.map((caseDoc) => caseDoc.toJSON());
    }
  },
  Mutation: {
    createCase: async (
      _parent: unknown,
      args: { store: string; product: string; description: string; images?: string[] },
      ctx: GraphQLContext
    ) => {
      ensureAuthenticated(ctx);
      await connectDB();
      const caseDoc = await ctx.models.Case.create({
        userId: ctx.user!.userId,
        userEmail: ctx.user!.email,
        store: args.store,
        product: args.product,
        description: args.description,
        images: args.images ?? []
      });
      return caseDoc.toJSON();
    },
    updateCaseStatus: async (_parent: unknown, args: { id: string; status: CaseStatus }, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);
      await connectDB();

      if (!VALID_STATUSES.includes(args.status)) {
        throw new Error('Invalid status provided.');
      }

      const caseDoc = await ctx.models.Case.findOne({ _id: args.id, userId: ctx.user!.userId });

      if (!caseDoc) {
        throw new Error('Case not found or access denied.');
      }

      const previousStatus = caseDoc.status;

      if (previousStatus === args.status) {
        return caseDoc.toJSON();
      }

      caseDoc.status = args.status;
      await caseDoc.save();

      await createCaseStatusNotification({
        caseDoc,
        oldStatus: previousStatus,
        newStatus: args.status
      });

      return caseDoc.toJSON();
    }
  }
};
