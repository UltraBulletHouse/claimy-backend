import { getUserFromToken, TokenPayload } from '../lib/auth';
import UserModel, { UserModelType } from '../models/User';
import CaseModel, { CaseModelType } from '../models/Case';
import RewardModel, { RewardModelType } from '../models/Reward';
import UserNotificationModel, { UserNotificationModelType } from '../models/UserNotification';

export interface GraphQLContext {
  user: TokenPayload | null;
  models: {
    User: UserModelType;
    Case: CaseModelType;
    Reward: RewardModelType;
    UserNotification: UserNotificationModelType;
  };
  request: Request;
}

export async function createContext(request: Request): Promise<GraphQLContext> {
  const authHeader = request.headers.get('authorization');
  const user = await getUserFromToken(authHeader);

  return {
    user,
    request,
    models: {
      User: UserModel,
      Case: CaseModel,
      Reward: RewardModel,
      UserNotification: UserNotificationModel
    }
  };
}
