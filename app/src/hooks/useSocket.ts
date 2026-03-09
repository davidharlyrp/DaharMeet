import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Participant, Message, JoinMeetingResponse } from '@/types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseSocketProps {
  onUserJoined?: (userId: string, name: string, participant: Participant) => void;
  onUserLeft?: (userId: string, name: string) => void;
  onOffer?: (senderId: string, senderName: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (senderId: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (senderId: string, candidate: RTCIceCandidateInit) => void;
  onMediaStateChanged?: (userId: string, isMicOn: boolean, isCamOn: boolean) => void;
  onScreenShareStarted?: (userId: string, userName: string) => void;
  onScreenShareStopped?: (userId: string) => void;
  onNewMessage?: (message: Message) => void;
}

export function useSocket({
  onUserJoined,
  onUserLeft,
  onOffer,
  onAnswer,
  onIceCandidate,
  onMediaStateChanged,
  onScreenShareStarted,
  onScreenShareStopped,
  onNewMessage
}: UseSocketProps = {}) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('user-joined', ({ userId, name, participant }) => {
      onUserJoined?.(userId, name, participant);
    });

    socket.on('user-left', ({ userId, name }) => {
      onUserLeft?.(userId, name);
    });

    socket.on('offer', ({ senderId, senderName, offer }) => {
      onOffer?.(senderId, senderName, offer);
    });

    socket.on('answer', ({ senderId, answer }) => {
      onAnswer?.(senderId, answer);
    });

    socket.on('ice-candidate', ({ senderId, candidate }) => {
      onIceCandidate?.(senderId, candidate);
    });

    socket.on('media-state-changed', ({ userId, isMicOn, isCamOn }) => {
      onMediaStateChanged?.(userId, isMicOn, isCamOn);
    });

    socket.on('screen-share-started', ({ userId, userName }) => {
      onScreenShareStarted?.(userId, userName);
    });

    socket.on('screen-share-stopped', ({ userId }) => {
      onScreenShareStopped?.(userId);
    });

    socket.on('new-message', (message) => {
      onNewMessage?.(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [
    onUserJoined,
    onUserLeft,
    onOffer,
    onAnswer,
    onIceCandidate,
    onMediaStateChanged,
    onScreenShareStarted,
    onScreenShareStopped,
    onNewMessage
  ]);

  const joinMeeting = useCallback((meetingId: string, passcode: string, name: string): Promise<JoinMeetingResponse> => {
    return new Promise((resolve) => {
      socketRef.current?.emit('join-meeting', { meetingId, passcode, name }, (response: JoinMeetingResponse) => {
        resolve(response);
      });
    });
  }, []);

  const sendOffer = useCallback((targetId: string, offer: RTCSessionDescriptionInit) => {
    socketRef.current?.emit('offer', { targetId, offer });
  }, []);

  const sendAnswer = useCallback((targetId: string, answer: RTCSessionDescriptionInit) => {
    socketRef.current?.emit('answer', { targetId, answer });
  }, []);

  const sendIceCandidate = useCallback((targetId: string, candidate: RTCIceCandidateInit) => {
    socketRef.current?.emit('ice-candidate', { targetId, candidate });
  }, []);

  const updateMediaState = useCallback((isMicOn: boolean, isCamOn: boolean) => {
    socketRef.current?.emit('media-state-change', { isMicOn, isCamOn });
  }, []);

  const requestScreenShare = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socketRef.current?.emit('request-screen-share', (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    socketRef.current?.emit('stop-screen-share');
  }, []);

  const sendMessage = useCallback((text: string) => {
    socketRef.current?.emit('send-message', { text });
  }, []);

  return {
    socket: socketRef.current,
    joinMeeting,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    updateMediaState,
    requestScreenShare,
    stopScreenShare,
    sendMessage
  };
}
