import { Schema, model, models, Document, Model } from 'mongoose';

export type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'NEED_INFO' | 'APPROVED' | 'REJECTED';

export interface CaseDocument extends Document {
  userId: string; // Firebase UID
  userEmail?: string | null;
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
      type: String,
      required: true,
      index: true
    },
    userEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      default: null
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
      enum: ['PENDING', 'IN_REVIEW', 'NEED_INFO', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    threadId: {
      type: String,
      index: true,
      default: null
    },
    lastEmailReplyAt: {
      type: Date,
      default: null
    },
    lastEmailMessageId: {
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
        return ret;
      }
    }
  }
);

export type CaseModelType = Model<CaseDocument>;

const CaseModel = (models.Case as CaseModelType) || model<CaseDocument>('Case', CaseSchema);

export default CaseModel;
