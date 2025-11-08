import { userResolvers } from './userResolvers';
import { caseResolvers } from './caseResolvers';
import { rewardResolvers } from './rewardResolvers';
import { notificationResolvers } from './notificationResolvers';

type ResolverMap = Record<string, Record<string, unknown>>;

function mergeResolvers(resolverMaps: ResolverMap[]): ResolverMap {
  return resolverMaps.reduce<ResolverMap>((acc, resolvers) => {
    Object.entries(resolvers).forEach(([typeName, typeResolvers]) => {
      acc[typeName] = {
        ...(acc[typeName] || {}),
        ...typeResolvers
      };
    });
    return acc;
  }, {});
}

export const resolvers = mergeResolvers([userResolvers, caseResolvers, rewardResolvers, notificationResolvers]);
