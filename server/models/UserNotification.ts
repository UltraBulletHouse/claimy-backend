import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface UserNotificationDocument extends Document {
  userId: string;
  caseId: Types.ObjectId;
  oldStatus?: string | null;
  newStatus: string;
  seen: boolean;
  createdAt: Date;
}

const UserNotificationSchema = new Schema<UserNotificationDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true
    },
    oldStatus: {
      type: String,
      default: null
    },
    newStatus: {
      type: String,
      required: true
    },
    seen: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        ret.caseId = ret.caseId?.toString();
        delete ret._id;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

UserNotificationSchema.index({ userId: 1, seen: 1, createdAt: -1 });

export type UserNotificationModelType = Model<UserNotificationDocument>;

const UserNotificationModel =
  (models.UserNotification as UserNotificationModelType) ||
  model<UserNotificationDocument>('UserNotification', UserNotificationSchema);

export default UserNotificationModel;
