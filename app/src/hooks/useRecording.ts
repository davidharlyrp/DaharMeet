import { useState, useRef, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseRecordingProps {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    screenStream: MediaStream | null;
    meetingId: string;
    userName: string;
}

export function useRecording({
    localStream,
    remoteStreams,
    screenStream,
    meetingId,
    userName
}: UseRecordingProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    // Clean up audio context
    const cleanupAudioContext = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        audioContextRef.current = null;
        destinationRef.current = null;
    }, []);

    // Create mixed audio stream from all sources
    const createMixedAudioStream = useCallback((): MediaStreamTrack | null => {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        audioContextRef.current = audioContext;
        destinationRef.current = destination;

        let hasAudio = false;

        // Add local audio
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const source = audioContext.createMediaStreamSource(
                    new MediaStream([audioTracks[0]])
                );
                source.connect(destination);
                hasAudio = true;
            }
        }

        // Add remote audio
        remoteStreams.forEach((stream) => {
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                const source = audioContext.createMediaStreamSource(
                    new MediaStream([audioTracks[0]])
                );
                source.connect(destination);
                hasAudio = true;
            }
        });

        if (!hasAudio) return null;
        return destination.stream.getAudioTracks()[0] || null;
    }, [localStream, remoteStreams]);

    // Start recording
    const startRecording = useCallback(() => {
        try {
            // Determine which video stream to record
            let videoTrack: MediaStreamTrack | null = null;

            if (screenStream) {
                // If screen sharing, record the screen
                videoTrack = screenStream.getVideoTracks()[0] || null;
            } else if (localStream) {
                // Otherwise record local camera
                videoTrack = localStream.getVideoTracks()[0] || null;
            }

            // Create mixed audio
            const mixedAudioTrack = createMixedAudioStream();

            // Build combined stream
            const tracks: MediaStreamTrack[] = [];
            if (videoTrack) tracks.push(videoTrack);
            if (mixedAudioTrack) tracks.push(mixedAudioTrack);

            if (tracks.length === 0) {
                console.error('No tracks available for recording');
                return false;
            }

            const combinedStream = new MediaStream(tracks);

            // Configure MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                    ? 'video/webm;codecs=vp8,opus'
                    : 'video/webm';

            const recorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: 500000, // 500kbps - good balance of quality and size
            });

            chunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                // Upload when recording stops
                uploadRecording();
            };

            // Record in 1-second chunks for safety
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingDuration(0);

            // Start duration timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }, [localStream, remoteStreams, screenStream, createMixedAudioStream]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsRecording(false);
        cleanupAudioContext();
    }, [cleanupAudioContext]);

    // Upload recording to server
    const uploadRecording = useCallback(async () => {
        if (chunksRef.current.length === 0) return;

        setIsUploading(true);

        try {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

            const formData = new FormData();
            formData.append('file', blob, `recording-${meetingId}-${Date.now()}.webm`);
            formData.append('meetingId', meetingId);
            formData.append('userName', userName);
            formData.append('duration', String(duration));

            const response = await fetch(`${API_URL}/api/recordings`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            console.log('Recording uploaded successfully');
            chunksRef.current = [];
        } catch (error) {
            console.error('Error uploading recording:', error);
        } finally {
            setIsUploading(false);
        }
    }, [meetingId, userName]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            cleanupAudioContext();
        };
    }, [cleanupAudioContext]);

    return {
        isRecording,
        isUploading,
        recordingDuration,
        startRecording,
        stopRecording,
    };
}
