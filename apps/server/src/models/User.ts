import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    // The PHASE 0 contract names the identifier `_id`, so we leave it alone.
    // Mongoose serialises the ObjectId to a hex string on the way out.
    toJSON: { versionKey: false },
  },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
