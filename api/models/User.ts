import { Schema, model, models, Document, Model } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  password: string;
  fcmToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    fcmToken: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      }
    }
  }
);

export type UserModelType = Model<UserDocument>;

const UserModel = (models.User as UserModelType) || model<UserDocument>('User', UserSchema);

export default UserModel;
