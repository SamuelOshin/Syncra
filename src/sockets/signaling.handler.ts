import { Server, Socket } from 'socket.io';
import { SignalingPayload } from '../types';

export default (io: Server, socket: Socket): void => {
  // Handle joining a room
  socket.on('join-room', (data: string | { roomId: string; username: string }) => {
    let roomId: string;
    let username = 'Participant';

    if (typeof data === 'string') {
      roomId = data;
    } else {
      roomId = data.roomId;
      username = data.username || 'Participant';
    }

    if (typeof roomId !== 'string' || !roomId.trim()) {
      console.warn(`Socket ${socket.id} attempted to join an invalid room.`);
      return;
    }

    // Store username in socket session data
    socket.data.username = username;
    
    // Get list of existing peers in the room before joining
    const clients = io.sockets.adapter.rooms.get(roomId);
    const peers = clients ? Array.from(clients).map(id => {
      const peerSocket = io.sockets.sockets.get(id);
      return {
        id,
        username: peerSocket?.data?.username || 'Participant'
      };
    }).filter(p => p.id !== socket.id) : [];
    
    socket.join(roomId);
    console.log(`User ${socket.id} (${username}) joined room: ${roomId}`);
    
    // 1. Send the list of existing peers to the joining client
    socket.emit('all-peers', peers);
    
    // 2. Notify others in the room that a new peer has joined
    socket.to(roomId).emit('user-joined', { id: socket.id, username });
  });

  // Forward camera toggle event
  socket.on('toggle-camera', ({ roomId, isCameraOff }: { roomId: string; isCameraOff: boolean }) => {
    if (!roomId) return;
    socket.to(roomId).emit('peer-toggle-camera', { from: socket.id, isCameraOff });
  });

  // WebRTC Signaling: Forward offer
  socket.on('offer', ({ to, offer }: SignalingPayload<RTCSessionDescriptionInit>) => {
    if (!to || !offer) return;
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  // WebRTC Signaling: Forward answer
  socket.on('answer', ({ to, answer }: SignalingPayload<RTCSessionDescriptionInit>) => {
    if (!to || !answer) return;
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  // WebRTC Signaling: Forward ICE candidates
  socket.on('ice-candidate', ({ to, candidate }: SignalingPayload<RTCIceCandidateInit>) => {
    if (!to || !candidate) return;
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });
};
