import { Request, Response, NextFunction } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import config from '../../config';
import { successResponse } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';

export class LiveKitController {
  
  // GET /api/livekit/token
  async getToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { room } = req.query;
      const username = req.user!.name;

      if (!room || typeof room !== 'string') {
        next(new BadRequestError('Room name is required', 'ROOM_NAME_REQUIRED'));
        return;
      }

      if (!config.hasLiveKit) {
        next(new BadRequestError('LiveKit is not configured on this server', 'LIVEKIT_NOT_CONFIGURED'));
        return;
      }

      // Create access token using server SDK
      const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity: username,
        ttl: '2h', // Token is valid for 2 hours
      });

      // Assign room permissions
      at.addGrant({
        roomJoin: true,
        room: room,
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
