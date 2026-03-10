import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { saveChunk, getChunksByMeeting, deleteMeetingData, getAllMeetingsWithData } from '../utils/indexedDB';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseRecordingProps {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    meetingId: string;
    userName: string;
}

export function useRecording({
    localStream,
    remoteStreams,
    meetingId,
    userName
}: UseRecordingProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [mimeType, setMimeType] = useState<string>('video/webm');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    // Reference for user captured screen stream
    const captureStreamRef = useRef<MediaStream | null>(null);

    // Clean up audio context
    const cleanupAudioContext = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        audioContextRef.current = null;
        destinationRef.current = null;
    }, []);

    // Clean up captured stream
    const cleanupCaptureStream = useCallback(() => {
        if (captureStreamRef.current) {
            captureStreamRef.current.getTracks().forEach(t => t.stop());
            captureStreamRef.current = null;
        }
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

    // Cleanup on unmount or tab close
    useEffect(() => {
        const handleUnload = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                // Force stop and capture last chunks
                mediaRecorderRef.current.stop();
                // Note: recorder.onstop will trigger uploadRecording automatically
            }
        };

        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            cleanupAudioContext();
            cleanupCaptureStream();
        };
    }, [cleanupAudioContext, cleanupCaptureStream]);

    // Recovery mechanism: check for leftover recordings on mount
    useEffect(() => {
        const recoverRecordings = async () => {
            try {
                const meetingIds = await getAllMeetingsWithData();
                if (meetingIds.length > 0) {
                    console.log('[Recording] Found leftover recordings to recover:', meetingIds);
                    for (const mId of meetingIds) {
                        // We only recover if it's NOT the current meeting or if the hook just started
                        // To avoid conflict with active recording
                        if (!isRecording) {
                            await performRecoveryUpload(mId);
                        }
                    }
                }
            } catch (err) {
                console.error('[Recording] Recovery check failed:', err);
            }
        };

        // Delay recovery slightly to not interfere with join process
        const timer = setTimeout(recoverRecordings, 5000);
        return () => clearTimeout(timer);
    }, [isRecording]);

    const performRecoveryUpload = async (mId: string) => {
        const records = await getChunksByMeeting(mId);
        if (records.length === 0) return;

        const firstRec = records[0];
        const meetingUserName = firstRec.userName;
        const meetingMimeType = firstRec.mimeType;
        const meetingStartTime = firstRec.startTime;

        const chunks = records.map(r => r.chunk);
        const blob = new Blob(chunks, { type: meetingMimeType });
        const duration = Math.floor((Date.now() - meetingStartTime) / 1000);

        console.log(`[Recording] Recovering ${blob.size} bytes for meeting ${mId}...`);

        const formData = new FormData();
        formData.append('meetingId', mId);
        formData.append('userName', meetingUserName);
        formData.append('file', blob, `recovered-${mId}-${Date.now()}.webm`);
        formData.append('duration', String(duration > 0 ? duration : 0));

        try {
            const response = await fetch(`${API_URL}/api/recordings`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                console.log(`[Recording] Recovery success for ${mId}`);
                await deleteMeetingData(mId);
            }
        } catch (err) {
            console.error(`[Recording] Recovery upload failed for ${mId}:`, err);
        }
    };

    // Upload recording to server
    const uploadRecording = useCallback(async () => {
        const records = await getChunksByMeeting(meetingId);
        if (records.length === 0) {
            console.warn('No recording chunks found in DB, skipping upload.');
            return;
        }

        setIsUploading(true);
        console.log(`[Recording] Preparing upload from DB (${records.length} chunks)...`);
        const toastId = toast.loading('Uploading recording...');

        try {
            const chunks = records.map(r => r.chunk);
            const blob = new Blob(chunks, { type: mimeType });
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

            console.log(`Final blob size: ${blob.size} bytes, Duration: ${duration}s`);

            const formData = new FormData();
            formData.append('meetingId', meetingId);
            formData.append('userName', userName);
            formData.append('file', blob, `recording-${meetingId}-${Date.now()}.webm`);
            formData.append('duration', String(duration));

            console.log(`Sending POST request to ${API_URL}/api/recordings...`);

            const response = await fetch(`${API_URL}/api/recordings`, {
                method: 'POST',
                body: formData,
                // keepalive: true is only for payloads < 64KB, causes failure for videos
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
            }

            console.log('Recording uploaded successfully');
            toast.success('Recording saved successfully', { id: toastId });
            await deleteMeetingData(meetingId);
            chunksRef.current = [];
        } catch (error: any) {
            console.error('Error uploading recording:', error);
            toast.error(`Upload failed: ${error.message}`, { id: toastId });
        } finally {
            setIsUploading(false);
        }
    }, [meetingId, userName]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log('[Recording] Stopping recorder...');
            mediaRecorderRef.current.stop();
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsRecording(false);
        cleanupAudioContext();
        cleanupCaptureStream();
    }, [cleanupAudioContext, cleanupCaptureStream]);

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            // Request the user to select the meeting tab to capture UI
            // Using preferCurrentTab to ensure the active DaharMeet tab is the first & default choice
            const captureStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'browser'
                },
                audio: false,
                preferCurrentTab: true
            } as any);

            console.log('Capture stream obtained:', captureStream.id);
            captureStreamRef.current = captureStream;
            const videoTrack = captureStream.getVideoTracks()[0];

            // Stop recording if user clicks "Stop Sharing" on the browser's capture bar
            videoTrack.onended = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    stopRecording();
                }
            };

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
            const recordedMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                    ? 'video/webm;codecs=vp8,opus'
                    : 'video/webm';

            setMimeType(recordedMimeType);
            console.log('Using mimeType:', recordedMimeType);

            const recorder = new MediaRecorder(combinedStream, {
                mimeType: recordedMimeType,
                videoBitsPerSecond: 2500000,
            });

            console.log('MediaRecorder created with state:', recorder.state);

            chunksRef.current = [];

            recorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                    // Persist to IndexedDB immediately
                    await saveChunk(meetingId, userName, event.data, startTimeRef.current, recordedMimeType);
                    console.log(`Chunk saved to DB: ${event.data.size} bytes. Total chunks: ${chunksRef.current.length}`);
                }
            };

            recorder.onstop = () => {
                console.log('MediaRecorder stopped. Total chunks collected:', chunksRef.current.length);
                // Upload when recording stops
                uploadRecording();
            };

            // Record in 1-second chunks for safety
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingDuration(0);
            console.log('[Recording] recorder.start() called');
            toast.success('Recording started');

            // Start duration timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            cleanupCaptureStream();
            return false;
        }
    }, [meetingId, userName, uploadRecording, createMixedAudioStream, stopRecording]);

    return {
        isRecording,
        isUploading,
        recordingDuration,
        startRecording,
        stopRecording,
    };
}
