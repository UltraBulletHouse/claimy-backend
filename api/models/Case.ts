import { Schema, model, models, Document, Model, Types } from 'mongoose';

export type CaseStatus = 'PENDING' | 'NEED_INFO' | 'APPROVED' | 'REJECTED';

export interface CaseDocument extends Document {
  userId: Types.ObjectId;
  store: string;
  product: string;
  description: string;
  images: string[];
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema = new Schema<CaseDocument>(
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
    product: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    images: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['PENDING', 'NEED_INFO', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        ret.userId = ret.userId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export type CaseModelType = Model<CaseDocument>;

const CaseModel = (models.Case as CaseModelType) || model<CaseDocument>('Case', CaseSchema);

export default CaseModel;
