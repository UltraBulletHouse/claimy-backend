import { GraphQLContext } from '../context';
import { connectDB } from '../../lib/db';
import type { CaseDocument } from '../../models/Case';
import { serializeNotification, SerializedNotification } from '../../lib/notificationService';
import { notificationPubSub } from '../pubsub';

function ensureAuthenticated(ctx: GraphQLContext) {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
}

function assertUser(targetUserId: string, ctx: GraphQLContext) {
  if (targetUserId !== ctx.user!.userId) {
    throw new Error('You are not allowed to view these notifications.');
  }
}

export const notificationResolvers = {
  Query: {
    getUserNotifications: async (
      _parent: unknown,
      args: { userId?: string | null },
      ctx: GraphQLContext
    ) => {
      ensureAuthenticated(ctx);
      await connectDB();
      const targetUserId = args.userId ?? ctx.user!.userId;
      assertUser(targetUserId, ctx);

      const notifications = await ctx.models.UserNotification.find({
        userId: targetUserId,
        seen: false
      })
        .sort({ createdAt: -1 })
        .limit(25)
        .populate('caseId');

      return notifications.map((notificationDoc) => {
        const populated = notificationDoc.populated('caseId')
          ? (notificationDoc.caseId as unknown as CaseDocument)
          : null;
        return serializeNotification(notificationDoc, populated);
      });
    }
  },
  Mutation: {
    markNotificationAsSeen: async (
      _parent: unknown,
      args: { notificationId: string },
      ctx: GraphQLContext
    ) => {
      ensureAuthenticated(ctx);
      await connectDB();

      const updated = await ctx.models.UserNotification.findOneAndUpdate(
        { _id: args.notificationId, userId: ctx.user!.userId },
        { seen: true },
        { new: true }
      );

      if (!updated) {
        throw new Error('Notification not found or access denied.');
      }

      return true;
    }
  },
  Subscription: {
    notificationAdded: {
      subscribe: async (
        _parent: unknown,
        args: { userId?: string | null },
        ctx: GraphQLContext
      ) => {
        ensureAuthenticated(ctx);
        const targetUserId = args.userId ?? ctx.user!.userId;
        assertUser(targetUserId, ctx);
        return notificationPubSub.subscribe('notificationAdded', targetUserId);
      },
      resolve: (payload: SerializedNotification) => payload
    }
  }
};
