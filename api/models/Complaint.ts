import { Schema, model, models, Document, Model } from 'mongoose';

export interface ComplaintDocument extends Document {
  name?: string;
  email?: string;
  store: string;
  product: string;
  description?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<ComplaintDocument>(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    store: { type: String, required: true, trim: true },
    product: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    images: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export type ComplaintModelType = Model<ComplaintDocument>;

const ComplaintModel = (models.Complaint as ComplaintModelType) || model<ComplaintDocument>('Complaint', ComplaintSchema);

export default ComplaintModel;
