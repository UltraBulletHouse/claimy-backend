import { Schema, model, models, Document, Model } from 'mongoose';

export interface StoreDocument extends Document {
  storeId: string;
  name: string;
  primaryColor: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<StoreDocument>(
  {
    storeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    primaryColor: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
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

export type StoreModelType = Model<StoreDocument>;

const StoreModel =
  (models.Store as StoreModelType) || model<StoreDocument>('Store', StoreSchema);

export default StoreModel;
