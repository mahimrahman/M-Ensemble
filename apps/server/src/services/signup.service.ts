import { PostModel } from '../models/Post.js';
import { SignupModel, type SignupDocument } from '../models/Signup.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR, isDuplicateKey } from '../utils/errors.js';
import { newId } from '../utils/ids.js';

/**
 * Claim a slot.
 *
 * The count is never read and then written. Two phones tapping the last slot
 * together must produce exactly one 201 and one 409 — so the check and the
 * increment are a single `findOneAndUpdate`, and the unique
 * `{postId, userId}` index catches anything that slips past it.
 */
export async function claimSlot(postId: string, userId: string): Promise<SignupDocument> {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');
  }

  // 410, with code NOT_FOUND. Deliberate: the app branches on the code and
  // shows "this was cancelled" rather than a generic failure.
  if (post.cancelledAt) {
    throw new HttpError(410, ERROR.NOT_FOUND, 'This post was cancelled.');
  }

  const existing = await SignupModel.findOne({ postId, userId });
  if (existing?.status === 'confirmed') {
    throw new HttpError(409, ERROR.ALREADY_SIGNED_UP, "You're already signed up.");
  }

  // The one write that decides the race. `limit = slotsNeeded ?? capacity`;
  // announcements and open events have neither and so have no limit.
  const claimed = await PostModel.findOneAndUpdate(
    {
      _id: postId,
      cancelledAt: { $exists: false },
      $expr: {
        $lt: [
          '$slotsFilled',
          { $ifNull: ['$slotsNeeded', { $ifNull: ['$capacity', Number.MAX_SAFE_INTEGER] }] },
        ],
      },
    },
    { $inc: { slotsFilled: 1 } },
    { new: true },
  );

  if (!claimed) {
    throw new HttpError(409, ERROR.FULL, 'That filled up while you were looking.');
  }

  try {
    if (existing) {
      // Re-signup after a withdrawal: same row, fresh createdAt, check-in gone.
      // `$unset` rather than a mutate-and-save so the key is actually removed.
      const revived = await SignupModel.findOneAndUpdate(
        { _id: existing._id },
        { $set: { status: 'confirmed', createdAt: new Date() }, $unset: { checkedInAt: '' } },
        { new: true },
      );
      if (revived) return revived;
    }

    return await SignupModel.create({
      _id: newId(),
      postId,
      userId,
      status: 'confirmed',
      createdAt: new Date(),
    });
  } catch (err) {
    if (isDuplicateKey(err)) {
      // We lost a race with ourselves — give the slot back before failing.
      await PostModel.updateOne({ _id: postId, slotsFilled: { $gt: 0 } }, { $inc: { slotsFilled: -1 } });
      throw new HttpError(409, ERROR.ALREADY_SIGNED_UP, "You're already signed up.");
    }
    throw err;
  }
}

/**
 * Give a slot back. 404 when there is nothing confirmed to withdraw from —
 * the same code the app shows for a post that has disappeared.
 */
export async function withdrawSlot(postId: string, userId: string): Promise<void> {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');
  }

  const signup = await SignupModel.findOneAndUpdate(
    { postId, userId, status: 'confirmed' },
    { $set: { status: 'withdrawn' }, $unset: { checkedInAt: '' } },
  );

  if (!signup) {
    throw new HttpError(404, ERROR.NOT_FOUND, "You aren't signed up for this.");
  }

  // `$gt: 0` is the atomic floor — slotsFilled must never go negative.
  await PostModel.updateOne({ _id: postId, slotsFilled: { $gt: 0 } }, { $inc: { slotsFilled: -1 } });
}

/**
 * Mark someone present. Idempotent: a second scan of the same QR leaves the
 * original time alone rather than moving it.
 */
export async function checkInSignup(postId: string, userId: string): Promise<void> {
  const signup = await SignupModel.findOne({ postId, userId, status: 'confirmed' });
  if (!signup) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'No confirmed signup to check in.');
  }

  await SignupModel.updateOne(
    { _id: signup._id, checkedInAt: { $exists: false } },
    { $set: { checkedInAt: new Date() } },
  );
}
