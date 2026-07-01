import { Request, Response, NextFunction } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import config from '../../config';
import { successResponse } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';
import { MeetingRepository } from '../meeting/meeting.repository';

const meetingRepository = new MeetingRepository();

export class LiveKitController {
  
  // GET /api/livekit/token
  async getToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { room, username: queryUsername } = req.query;

      if (!room || typeof room !== 'string') {
        next(new BadRequestError('Room name is required', 'ROOM_NAME_REQUIRED'));
        return;
      }

      if (!config.hasLiveKit) {
        next(new BadRequestError('LiveKit is not configured on this server', 'LIVEKIT_NOT_CONFIGURED'));
        return;
      }

      // Verify the room exists and is not completed (Zero-Trust)
      const roomNormalized = room.toLowerCase();
      const meeting = await meetingRepository.findById(roomNormalized);
      if (!meeting) {
        next(new BadRequestError('Meeting room not found', 'MEETING_NOT_FOUND'));
        return;
      }
      if (meeting.status === 'completed') {
        next(new BadRequestError('Meeting room is already completed', 'MEETING_COMPLETED'));
        return;
      }

      // Determine identity (either authenticated user or guest username, fallback to 'Guest')
      let identity = 'Guest';
      if (req.user && req.user.name) {
        identity = req.user.name;
      } else if (queryUsername && typeof queryUsername === 'string' && queryUsername.trim()) {
        identity = queryUsername.trim();
      }

      // Create access token using server SDK
      const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity: identity,
        ttl: '2h', // Token is valid for 2 hours
      });

      // Assign room permissions
      at.addGrant({
        roomJoin: true,
        room: roomNormalized,
        canPublish: true,
        canSubscribe: true,
      });

      const token = await at.toJwt();

      successResponse(res, 200, 'LiveKit token generated successfully', {
        token,
        url: config.livekitUrl,
      });
    } catch (error) {
      next(error);
    }
  }
}
export default LiveKitController;
