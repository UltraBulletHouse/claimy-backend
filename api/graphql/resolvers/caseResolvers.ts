import { GraphQLContext } from '../context';
import { CaseStatus } from '../../models/Case';

const VALID_STATUSES: CaseStatus[] = ['PENDING', 'NEED_INFO', 'APPROVED', 'REJECTED'];

function ensureAuthenticated(ctx: GraphQLContext) {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
}

export const caseResolvers = {
  Query: {
    getCases: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);
      const cases = await ctx.models.Case.find({ userId: ctx.user!.id ?? ctx.user!._id }).sort({ createdAt: -1 });
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
      const caseDoc = await ctx.models.Case.create({
        userId: ctx.user!.id ?? ctx.user!._id,
        store: args.store,
        product: args.product,
        description: args.description,
        images: args.images ?? []
      });
      return caseDoc.toJSON();
    },
    updateCaseStatus: async (_parent: unknown, args: { id: string; status: CaseStatus }, ctx: GraphQLContext) => {
      ensureAuthenticated(ctx);

      if (!VALID_STATUSES.includes(args.status)) {
        throw new Error('Invalid status provided.');
      }

      const caseDoc = await ctx.models.Case.findOneAndUpdate(
        { _id: args.id, userId: ctx.user!.id ?? ctx.user!._id },
        { status: args.status },
        { new: true }
      );

      if (!caseDoc) {
        throw new Error('Case not found or access denied.');
      }

      return caseDoc.toJSON();
    }
  }
};
