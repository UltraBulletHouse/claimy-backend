import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface RewardDocument extends Document {
  userId: Types.ObjectId;
  store: string;
  code: string;
  amount: number;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema = new Schema<RewardDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    store: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    used: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        ret.userId = ret.userId?.toString();
        delete ret._id;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

export type RewardModelType = Model<RewardDocument>;

const RewardModel = (models.Reward as RewardModelType) || model<RewardDocument>('Reward', RewardSchema);

export default RewardModel;
