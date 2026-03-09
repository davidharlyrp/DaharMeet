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
  const callbacksRef = useRef<UseSocketProps>({});

  // Update callbacks ref when props change
  useEffect(() => {
    callbacksRef.current = {
      onUserJoined,
      onUserLeft,
      onOffer,
      onAnswer,
      onIceCandidate,
      onMediaStateChanged,
      onScreenShareStarted,
      onScreenShareStopped,
      onNewMessage
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

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('user-joined', ({ userId, name, participant }) => {
      callbacksRef.current?.onUserJoined?.(userId, name, participant);
    });

    socket.on('user-left', ({ userId, name }) => {
      callbacksRef.current?.onUserLeft?.(userId, name);
    });

    socket.on('offer', ({ senderId, senderName, offer }) => {
      callbacksRef.current?.onOffer?.(senderId, senderName, offer);
    });

    socket.on('answer', ({ senderId, answer }) => {
      callbacksRef.current?.onAnswer?.(senderId, answer);
    });

    socket.on('ice-candidate', ({ senderId, candidate }) => {
      callbacksRef.current?.onIceCandidate?.(senderId, candidate);
    });

    socket.on('media-state-changed', ({ userId, isMicOn, isCamOn }) => {
      callbacksRef.current?.onMediaStateChanged?.(userId, isMicOn, isCamOn);
    });

    socket.on('screen-share-started', ({ userId, userName }) => {
      callbacksRef.current?.onScreenShareStarted?.(userId, userName);
    });

    socket.on('screen-share-stopped', ({ userId }) => {
      callbacksRef.current?.onScreenShareStopped?.(userId);
    });

    socket.on('new-message', (message) => {
      callbacksRef.current?.onNewMessage?.(message);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Only connect once on mount

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
