import { Router } from 'express';
import {
  getMe,
  getMyCommitments,
  getMyHours,
  getMyReliability,
  getMyMemberships,
  getMyMosques,
  getMyNotifications,
  getNotificationPrefs,
  patchMe,
  postNotificationsRead,
  putNotificationPrefs,
  putPushToken,
} from '../controllers/me.controller.js';
import { notificationPrefsSchema, patchMeSchema, pushTokenSchema } from '../schemas/me.schema.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const meRouter = Router();

meRouter.get('/', asyncHandler(getMe));
meRouter.patch('/', validate(patchMeSchema), asyncHandler(patchMe));

meRouter.get('/mosques', asyncHandler(getMyMosques));
meRouter.get('/memberships', asyncHandler(getMyMemberships));
meRouter.get('/commitments', asyncHandler(getMyCommitments));
meRouter.get('/hours', asyncHandler(getMyHours));
meRouter.get('/reliability', asyncHandler(getMyReliability));

meRouter.get('/notification-prefs', asyncHandler(getNotificationPrefs));
meRouter.put(
  '/notification-prefs',
  validate(notificationPrefsSchema),
  asyncHandler(putNotificationPrefs),
);

meRouter.get('/notifications', asyncHandler(getMyNotifications));
meRouter.post('/notifications/read', asyncHandler(postNotificationsRead));

meRouter.post('/push-token', validate(pushTokenSchema), asyncHandler(putPushToken));
