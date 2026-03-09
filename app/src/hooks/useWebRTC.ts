import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ]
};

interface UseWebRTCProps {
  onOffer: (targetId: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer: (targetId: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (targetId: string, candidate: RTCIceCandidateInit) => void;
  onScreenShareEnded?: () => void;
}

export function useWebRTC({ onOffer, onAnswer, onIceCandidate, onScreenShareEnded }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const onScreenShareEndedRef = useRef(onScreenShareEnded);

  // Keep callback ref in sync
  useEffect(() => {
    onScreenShareEndedRef.current = onScreenShareEnded;
  }, [onScreenShareEnded]);

  // Initialize local media
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio
      });

      // Start with all tracks DISABLED - user must manually enable
      stream.getAudioTracks().forEach(t => t.enabled = false);
      stream.getVideoTracks().forEach(t => t.enabled = false);

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMicOn(false);
      setIsCamOn(false);

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      let nextState = false;
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        nextState = track.enabled;
      });
      setIsMicOn(nextState);
      return nextState;
    }
    return false;
  }, []);

  // Toggle camera
  const toggleCam = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      let nextState = false;
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
        nextState = track.enabled;
      });
      setIsCamOn(nextState);
      return nextState;
    }
    return false;
  }, []);

  // Start screen sharing
  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Replace track in all peer connections
      peersRef.current.forEach((peer) => {
        const sender = peer.getSenders().find(s =>
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          const screenTrack = stream.getVideoTracks()[0];
          if (screenTrack) {
            sender.replaceTrack(screenTrack);
          }
        }
      });

      // Handle browser's native "Stop sharing" button
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
        onScreenShareEndedRef.current?.();
      };

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);

      // Restore camera track in all peer connections
      if (localStreamRef.current) {
        peersRef.current.forEach((peer) => {
          const sender = peer.getSenders().find(s =>
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            const camTrack = localStreamRef.current?.getVideoTracks()[0];
            if (camTrack) {
              sender.replaceTrack(camTrack);
            }
          }
        });
      }
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream tracks - DO NOT modify track.enabled here!
    // Track enabled state is managed by toggleMic/toggleCam only.
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        peer.addTrack(track, localStreamRef.current!);
      });

      // Use screen share track if currently sharing, otherwise use camera
      const videoTrack = screenStreamRef.current
        ? screenStreamRef.current.getVideoTracks()[0]
        : localStreamRef.current.getVideoTracks()[0];

      if (videoTrack) {
        peer.addTrack(videoTrack, localStreamRef.current!);
      }
    }

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(peerId, event.candidate);
      }
    };

    // Handle remote stream
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);

      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, remoteStream);
        return newMap;
      });
    };

    peersRef.current.set(peerId, peer);
    return peer;
  }, [onIceCandidate]);

  // Create offer
  const createOffer = useCallback(async (peerId: string) => {
    const peer = createPeerConnection(peerId);

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      onOffer(peerId, offer);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [createPeerConnection, onOffer]);

  // Handle offer
  const handleOffer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    let peer = peersRef.current.get(peerId);

    if (!peer) {
      peer = createPeerConnection(peerId);
    }

    try {
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      onAnswer(peerId, answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [createPeerConnection, onAnswer]);

  // Handle answer
  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const peer = peersRef.current.get(peerId);

    if (peer) {
      try {
        await peer.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const peer = peersRef.current.get(peerId);

    if (peer) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }, []);

  // Remove peer
  const removePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);

    if (peer) {
      peer.close();
      peersRef.current.delete(peerId);
    }

    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(peerId);
      return newMap;
    });
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setIsMicOn(false);
    setIsCamOn(false);
    setIsScreenSharing(false);
  }, []);

  return {
    localStream,
    screenStream,
    remoteStreams,
    isMicOn,
    isCamOn,
    isScreenSharing,
    initializeMedia,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    cleanup
  };
}
