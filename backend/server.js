const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

const app = express();
const server = http.createServer(app);

// Production CORS: restrict to FRONTEND_URL if provided
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : "*";
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

app.use(cors({
    origin: allowedOrigins
}));
app.use(express.json());

// PocketBase setup
const POCKETBASE_URL = process.env.POCKETBASE_URL;
let pb;

async function initPocketBase() {
    if (!POCKETBASE_URL) {
        throw new Error('POCKETBASE_URL is not defined in environment variables');
    }
    const PocketBase = (await import('pocketbase')).default;
    pb = new PocketBase(POCKETBASE_URL);
    pb.autoCancellation(false);
    console.log(`PocketBase connected to ${POCKETBASE_URL}`);
}

// In-memory storage for real-time data (transient, not persisted)
const activeMeetings = {};

// Helper: sanitize input for PocketBase filters
const sanitizeFilter = (val) => val.replace(/['"\\\b\f\n\r\t]/g, '');

const getActiveMeeting = (meetingId) => {
    if (!activeMeetings[meetingId]) {
        activeMeetings[meetingId] = {
            participants: {},
            screenSharer: null,
            messages: []
        };
    }
    return activeMeetings[meetingId];
};

// POST /api/recordings - Upload a recording
app.post('/api/recordings', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const { meetingId, userName, duration } = req.body;
        if (!meetingId || !userName) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: 'meetingId and userName are required' });
        }

        // Read file and create a File-like object for PocketBase SDK
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname || `recording-${meetingId}-${Date.now()}.webm`;

        const record = await pb.collection('recordings').create({
            meeting_id: meetingId,
            user_name: userName,
            duration: parseInt(duration) || 0,
            status: 'completed',
            recorded_at: new Date().toISOString(),
            raw_file: new File([fileBuffer], fileName, { type: 'video/webm' }),
        });

        // Cleanup temp file
        fs.unlinkSync(req.file.path);

        console.log(`Recording saved for meeting ${meetingId} by ${userName}`);
        res.json({ success: true, recordId: record.id });
    } catch (e) {
        console.error('Error uploading recording:', e);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: 'Failed to upload recording' });
    }
});

const generateMeetingId = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
};

const generatePasscode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

app.post('/api/meetings', async (req, res) => {
    try {
        const { hostName, meetingName, scheduledAt } = req.body;
        const meetingId = generateMeetingId();
        const passcode = generatePasscode();

        const record = await pb.collection('meetings').create({
            meeting_id: meetingId,
            passcode,
            host_name: hostName || 'Host',
            meeting_name: meetingName || 'Dahar Meet',
            status: scheduledAt ? 'scheduled' : 'active',
            scheduled_at: scheduledAt || null,
            started_at: scheduledAt ? null : new Date().toISOString(),
        });

        console.log(`New meeting created: ${meetingId} (PB record: ${record.id})`);

        res.json({
            success: true,
            meeting: {
                id: meetingId,
                passcode,
                hostName: hostName || 'Host',
                meetingName: record.meeting_name
            }
        });
    } catch (e) {
        console.error('Error creating meeting:', e);
        res.status(500).json({ success: false, error: 'Failed to create meeting' });
    }
});

app.get('/api/meetings/:id', async (req, res) => {
    try {
        const id = sanitizeFilter(req.params.id);
        const records = await pb.collection('meetings').getList(1, 1, {
            filter: `meeting_id = "${id}"`,
        });

        if (records.items.length === 0) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }

        const meeting = records.items[0];
        const active = activeMeetings[id];
        const participantCount = active ? Object.keys(active.participants).length : 0;

        res.json({
            success: true,
            meeting: {
                id: meeting.meeting_id,
                hostName: meeting.host_name,
                meetingName: meeting.meeting_name,
                status: meeting.status,
                scheduledAt: meeting.scheduled_at,
                participantCount
            }
        });
    } catch (e) {
        console.error('Error getting meeting:', e);
        res.status(500).json({ success: false, error: 'Failed to get meeting' });
    }
});

app.post('/api/meetings/:id/validate', async (req, res) => {
    try {
        const id = sanitizeFilter(req.params.id);
        const { passcode } = req.body;

        const records = await pb.collection('meetings').getList(1, 1, {
            filter: `meeting_id = "${id}"`,
        });

        if (records.items.length === 0) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }

        const meeting = records.items[0];
        if (meeting.passcode !== passcode) {
            return res.status(403).json({ success: false, error: 'Invalid passcode' });
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Error validating passcode:', e);
        res.status(500).json({ success: false, error: 'Failed to validate passcode' });
    }
});

const findMeetingRecord = async (meetingId) => {
    try {
        const id = sanitizeFilter(meetingId);
        const records = await pb.collection('meetings').getList(1, 1, {
            filter: `meeting_id = "${id}"`,
        });
        return records.items.length > 0 ? records.items[0] : null;
    } catch (e) {
        console.error('Error finding meeting record:', e);
        return null;
    }
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    let currentMeeting = null;
    let userId = socket.id;
    let userName = null;

    socket.on('join-meeting', async ({ meetingId, passcode, name, isMicOn, isCamOn }, callback) => {
        const record = await findMeetingRecord(meetingId);
        if (!record) return callback({ success: false, error: 'Meeting not found' });
        if (record.passcode !== passcode) return callback({ success: false, error: 'Invalid passcode' });

        if (record.status === 'scheduled') {
            try {
                await pb.collection('meetings').update(record.id, {
                    status: 'active',
                    started_at: new Date().toISOString()
                });
            } catch (e) {
                console.error('Error updating meeting status:', e);
            }
        }

        currentMeeting = meetingId;
        userName = name || `User ${Math.floor(Math.random() * 1000)}`;
        const active = getActiveMeeting(meetingId);

        active.participants[userId] = {
            id: userId,
            name: userName,
            socketId: socket.id,
            isMicOn: !!isMicOn,
            isCamOn: !!isCamOn,
            isScreenSharing: false
        };

        socket.join(meetingId);
        socket.to(meetingId).emit('user-joined', {
            userId,
            name: userName,
            participant: active.participants[userId]
        });

        callback({
            success: true,
            userId,
            participants: active.participants,
            messages: active.messages,
            screenSharer: active.screenSharer
        });
        console.log(`${userName} joined meeting ${meetingId}`);
    });

    socket.on('offer', ({ targetId, offer }) => {
        io.to(targetId).emit('offer', { senderId: userId, senderName: userName, offer });
    });

    socket.on('answer', ({ targetId, answer }) => {
        io.to(targetId).emit('answer', { senderId: userId, answer });
    });

    socket.on('ice-candidate', ({ targetId, candidate }) => {
        io.to(targetId).emit('ice-candidate', { senderId: userId, candidate });
    });

    socket.on('media-state-change', ({ isMicOn, isCamOn }) => {
        if (currentMeeting && activeMeetings[currentMeeting]) {
            const participant = activeMeetings[currentMeeting].participants[userId];
            if (participant) {
                participant.isMicOn = isMicOn;
                participant.isCamOn = isCamOn;
                socket.to(currentMeeting).emit('media-state-changed', { userId, isMicOn, isCamOn });
            }
        }
    });

    socket.on('update-camera-settings', (settings) => {
        if (currentMeeting && activeMeetings[currentMeeting]) {
            const participant = activeMeetings[currentMeeting].participants[userId];
            if (participant) {
                participant.cameraSettings = settings;
                socket.to(currentMeeting).emit('participant-camera-settings-changed', { userId, settings });
            }
        }
    });

    socket.on('request-screen-share', (callback) => {
        if (currentMeeting && activeMeetings[currentMeeting]) {
            const active = activeMeetings[currentMeeting];
            if (active.screenSharer && active.screenSharer !== userId) {
                return callback({ success: false, error: 'Someone is already sharing their screen' });
            }
            active.screenSharer = userId;
            const participant = active.participants[userId];
            if (participant) participant.isScreenSharing = true;
            io.to(currentMeeting).emit('screen-share-started', { userId, userName });
            callback({ success: true });
        }
    });

    socket.on('stop-screen-share', () => {
        if (currentMeeting && activeMeetings[currentMeeting]) {
            const active = activeMeetings[currentMeeting];
            if (active.screenSharer === userId) {
                active.screenSharer = null;
                const participant = active.participants[userId];
                if (participant) participant.isScreenSharing = false;
                io.to(currentMeeting).emit('screen-share-stopped', { userId });
            }
        }
    });

    socket.on('send-message', ({ text }) => {
        if (currentMeeting && activeMeetings[currentMeeting]) {
            const active = activeMeetings[currentMeeting];
            const message = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                userName,
                text,
                timestamp: new Date().toISOString()
            };
            active.messages.push(message);
            io.to(currentMeeting).emit('new-message', message);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        if (currentMeeting && activeMeetings[currentMeeting]) {
            const active = activeMeetings[currentMeeting];
            delete active.participants[userId];
            if (active.screenSharer === userId) {
                active.screenSharer = null;
                io.to(currentMeeting).emit('screen-share-stopped', { userId });
            }
            socket.to(currentMeeting).emit('user-left', { userId, name: userName });
            if (Object.keys(active.participants).length === 0) {
                delete activeMeetings[currentMeeting];
                try {
                    const record = await findMeetingRecord(currentMeeting);
                    if (record) {
                        await pb.collection('meetings').update(record.id, {
                            status: 'ended',
                            ended_at: new Date().toISOString()
                        });
                        console.log(`Meeting ${currentMeeting} ended`);
                    }
                } catch (e) {
                    console.error('Error ending meeting:', e);
                }
            }
        }
    });
});

const PORT = parseInt(process.env.PORT, 10) || 3001;

initPocketBase().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch((err) => {
    console.error('Failed to initialize PocketBase:', err);
    process.exit(1);
});

// Graceful shutdown
const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);