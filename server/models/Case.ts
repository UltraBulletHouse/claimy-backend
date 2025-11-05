import { Schema, model, models, Document, Model } from 'mongoose';

export type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'NEED_INFO' | 'APPROVED' | 'REJECTED';

export type InfoRequestStatus = 'PENDING' | 'ANSWERED' | 'SUPERSEDED';

export interface CaseEmailEntry {
  subject: string;
  body: string;
  to: string;
  from: string;
  sentAt: Date;
  threadId?: string | null;
}

export interface CaseResolution {
  code?: string;
  addedAt?: Date;
  expiryDate?: Date;
}

export interface CaseStatusHistoryEntry {
  status: string;
  by: string;
  at: Date;
  note?: string;
}

export interface CaseManualAnalysis {
  text: string;
  updatedAt: Date;
}

// NEW: History tracking interfaces
export interface CaseInfoRequestHistoryEntry {
  id: string;
  message: string;
  requiresFile: boolean;
  requiresYesNo: boolean;
  requestedAt: Date;
  requestedBy: string;
  status: InfoRequestStatus;
}

export interface CaseInfoResponseHistoryEntry {
  id: string;
  requestId: string;
  answer?: string;
  fileUrl?: string | null;
  fileName?: string;
  fileType?: string;
  submittedAt: Date;
  submittedBy: string;
}

// Legacy interfaces - kept for backward compatibility
export interface CaseInfoRequest { message: string; requiresFile?: boolean; requestedAt: Date; }
export interface CaseInfoResponse { answer?: string; fileUrl?: string | null; submittedAt: Date; }

export interface CaseDocument extends Document {
  userId: string; // Firebase UID
  userEmail?: string | null;
  store: string;
  product: string;
  description: string;
  images: string[];
  productImageUrl?: string | null;
  receiptImageUrl?: string | null;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
  manualAnalysis?: CaseManualAnalysis | null;
  emails?: CaseEmailEntry[];
  resolution?: CaseResolution | null;
  statusHistory?: CaseStatusHistoryEntry[];
  // NEW: History arrays
  infoRequestHistory?: CaseInfoRequestHistoryEntry[];
  infoResponseHistory?: CaseInfoResponseHistoryEntry[];
  // Legacy fields - kept for backward compatibility
  infoRequest?: CaseInfoRequest | null;
  infoResponse?: CaseInfoResponse | null;
  threadId?: string | null;
  lastEmailReplyAt?: Date | null;
  lastEmailMessageId?: string | null;
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
    productImageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    receiptImageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_REVIEW', 'NEED_INFO', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    manualAnalysis: {
      type: {
        text: { type: String, required: true, trim: true },
        updatedAt: { type: Date, required: true },
      },
      default: null,
    },
    emails: {
      type: [
        new Schema<CaseEmailEntry>(
          {
            subject: { type: String, required: true },
            body: { type: String, required: true },
            to: { type: String, required: true },
            from: { type: String, required: true },
            sentAt: { type: Date, required: true },
            threadId: { type: String, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    resolution: {
      type: {
        code: { type: String, default: undefined },
        addedAt: { type: Date, default: undefined },
        expiryDate: { type: Date, default: undefined },
      },
      default: null,
    },
    infoRequestHistory: {
      type: [
        new Schema<CaseInfoRequestHistoryEntry>(
          {
            id: { type: String, required: true },
            message: { type: String, required: true },
            requiresFile: { type: Boolean, default: false },
            requiresYesNo: { type: Boolean, default: false },
            requestedAt: { type: Date, required: true },
            requestedBy: { type: String, required: true },
            status: { type: String, enum: ['PENDING', 'ANSWERED', 'SUPERSEDED'], default: 'PENDING' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    infoResponseHistory: {
      type: [
        new Schema<CaseInfoResponseHistoryEntry>(
          {
            id: { type: String, required: true },
            requestId: { type: String, required: true },
            answer: { type: String, default: undefined },
            fileUrl: { type: String, default: null },
            fileName: { type: String, default: undefined },
            fileType: { type: String, default: undefined },
            submittedAt: { type: Date, required: true },
            submittedBy: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    infoRequest: {
      type: new Schema<CaseInfoRequest>({
        message: { type: String, required: true },
        requiresFile: { type: Boolean, default: false },
        requestedAt: { type: Date, required: true },
      }, { _id: false }),
      default: null,
    },
    infoResponse: {
      type: new Schema<CaseInfoResponse>({
        answer: { type: String, default: undefined },
        fileUrl: { type: String, default: null },
        submittedAt: { type: Date, required: true },
      }, { _id: false }),
      default: null,
    },
    statusHistory: {
      type: [
        new Schema<CaseStatusHistoryEntry>(
          {
            status: { type: String, required: true },
            by: { type: String, required: true },
            at: { type: Date, required: true },
            note: { type: String, default: undefined },
          },
          { _id: false }
        ),
      ],
      default: [],
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
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

export type CaseModelType = Model<CaseDocument>;

const CaseModel = (models.Case as CaseModelType) || model<CaseDocument>('Case', CaseSchema);

export default CaseModel;
