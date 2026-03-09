import { useState, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

interface UseWebRTCProps {
  onOffer: (targetId: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer: (targetId: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (targetId: string, candidate: RTCIceCandidateInit) => void;
}

export function useWebRTC({ onOffer, onAnswer, onIceCandidate }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Initialize local media
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMicOn(audio);
      setIsCamOn(video);
      
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
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(prev => !prev);
      return !isMicOn;
    }
    return false;
  }, [isMicOn]);

  // Toggle camera
  const toggleCam = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCamOn(prev => !prev);
      return !isCamOn;
    }
    return false;
  }, [isCamOn]);

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
      
      // Handle screen share stop
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
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
    
    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peer.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(peerId, event.candidate);
      }
    };
    
    // Handle remote stream
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
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
