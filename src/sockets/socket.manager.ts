import { Server, Socket } from 'socket.io';
import registerSignalingHandlers from './signaling.handler';
import registerTranslationHandlers from './translation.handler';
import registerChatHandlers from './chat.handler';
import registerSTTHandlers from './stt.handler';

export default (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Register modular socket event handlers
    registerSignalingHandlers(io, socket);
    registerTranslationHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerSTTHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      // Notify all rooms the user was in
      socket.broadcast.emit('user-left', socket.id);
    });
  });
};
