import { Router } from 'express';
import { MeetingController } from './meeting.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createMeetingSchema } from './meeting.schema';
import { publicVerifyLimiter } from '../../middleware/rate-limit.middleware';

const router = Router();
const meetingController = new MeetingController();

router.get('/:id/verify', publicVerifyLimiter, (req, res, next) => meetingController.verifyMeeting(req, res, next));

router.use(requireAuth);

router.post('/', validate(createMeetingSchema), (req, res, next) => meetingController.createMeeting(req, res, next));
router.get('/', (req, res, next) => meetingController.getMeetings(req, res, next));
router.get('/:id/transcript', (req, res, next) => meetingController.getMeetingTranscript(req, res, next));
router.post('/:id/end', (req, res, next) => meetingController.endMeeting(req, res, next));

export default router;
