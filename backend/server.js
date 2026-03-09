const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Data storage
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MEETINGS_FILE = path.join(DATA_DIR, 'meetings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Helper functions
const loadData = (file) => {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    return {};
};

const saveData = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving data:', e);
    }
};

// In-memory storage
let meetings = loadData(MEETINGS_FILE);
let users = loadData(USERS_FILE);

// Generate 8-digit meeting ID
const generateMeetingId = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
};

// Generate 6-digit passcode
const generatePasscode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// API Routes

// Create meeting
app.post('/api/meetings', (req, res) => {
    const { hostName } = req.body;
    const meetingId = generateMeetingId();
    const passcode = generatePasscode();

    const meeting = {
        id: meetingId,
        passcode,
        hostName: hostName || 'Host',
        createdAt: new Date().toISOString(),
        participants: {},
        screenSharer: null,
        messages: []
    };

    meetings[meetingId] = meeting;
    saveData(MEETINGS_FILE, meetings);

    res.json({
        success: true,
        meeting: {
            id: meetingId,
            passcode,
            hostName: meeting.hostName
        }
    });
});

// Get meeting info
app.get('/api/meetings/:id', (req, res) => {
    const { id } = req.params;
    const meeting = meetings[id];

    if (!meeting) {
        return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    res.json({
        success: true,
        meeting: {
            id: meeting.id,
            hostName: meeting.hostName,
            participantCount: Object.keys(meeting.participants).length
        }
    });
});

// Validate meeting passcode
app.post('/api/meetings/:id/validate', (req, res) => {
    const { id } = req.params;
    const { passcode } = req.body;
    const meeting = meetings[id];

    if (!meeting) {
        return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    if (meeting.passcode !== passcode) {
        return res.status(403).json({ success: false, error: 'Invalid passcode' });
    }

    res.json({ success: true });
});

// Socket.IO handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    let currentMeeting = null;
    let userId = null;
    let userName = null;

    // Join meeting
    socket.on('join-meeting', ({ meetingId, passcode, name }, callback) => {
        const meeting = meetings[meetingId];

        if (!meeting) {
            return callback({ success: false, error: 'Meeting not found' });
        }

        if (meeting.passcode !== passcode) {
            return callback({ success: false, error: 'Invalid passcode' });
        }

        currentMeeting = meetingId;
        userId = socket.id;
        userName = name || `User ${Math.floor(Math.random() * 1000)}`;

        // Add participant
        meeting.participants[userId] = {
            id: userId,
            name: userName,
            socketId: socket.id,
            isMicOn: false,
            isCamOn: false,
            isScreenSharing: false
        };

        saveData(MEETINGS_FILE, meetings);

        // Join socket room
        socket.join(meetingId);

        // Notify others
        socket.to(meetingId).emit('user-joined', {
            userId,
            name: userName,
            participant: meeting.participants[userId]
        });

        // Send current state to new user
        callback({
            success: true,
            userId,
            participants: meeting.participants,
            messages: meeting.messages,
            screenSharer: meeting.screenSharer
        });

        console.log(`${userName} joined meeting ${meetingId}`);
    });

    // WebRTC Signaling - Offer
    socket.on('offer', ({ targetId, offer }) => {
        io.to(targetId).emit('offer', {
            senderId: userId,
            senderName: userName,
            offer
        });
    });

    // WebRTC Signaling - Answer
    socket.on('answer', ({ targetId, answer }) => {
        io.to(targetId).emit('answer', {
            senderId: userId,
            answer
        });
    });

    // WebRTC Signaling - ICE Candidate
    socket.on('ice-candidate', ({ targetId, candidate }) => {
        io.to(targetId).emit('ice-candidate', {
            senderId: userId,
            candidate
        });
    });

    // Update media state (mic/cam)
    socket.on('media-state-change', ({ isMicOn, isCamOn }) => {
        if (currentMeeting && meetings[currentMeeting]) {
            const participant = meetings[currentMeeting].participants[userId];
            if (participant) {
                participant.isMicOn = isMicOn;
                participant.isCamOn = isCamOn;
                saveData(MEETINGS_FILE, meetings);

                socket.to(currentMeeting).emit('media-state-changed', {
                    userId,
                    isMicOn,
                    isCamOn
                });
            }
        }
    });

    // Request screen share
    socket.on('request-screen-share', (callback) => {
        if (currentMeeting && meetings[currentMeeting]) {
            const meeting = meetings[currentMeeting];
            if (meeting.screenSharer && meeting.screenSharer !== userId) {
                return callback({
                    success: false,
                    error: 'Someone is already sharing their screen'
                });
            }
            meeting.screenSharer = userId;
            const participant = meeting.participants[userId];
            if (participant) {
                participant.isScreenSharing = true;
            }
            saveData(MEETINGS_FILE, meetings);

            // Notify all participants
            io.to(currentMeeting).emit('screen-share-started', {
                userId,
                userName
            });
            callback({ success: true });
        }
    });

    // Stop screen share
    socket.on('stop-screen-share', () => {
        if (currentMeeting && meetings[currentMeeting]) {
            const meeting = meetings[currentMeeting];
            if (meeting.screenSharer === userId) {
                meeting.screenSharer = null;
                const participant = meeting.participants[userId];
                if (participant) {
                    participant.isScreenSharing = false;
                }
                saveData(MEETINGS_FILE, meetings);
                io.to(currentMeeting).emit('screen-share-stopped', {
                    userId
                });
            }
        }
    });

    // Send chat message
    socket.on('send-message', ({ text }) => {
        if (currentMeeting && meetings[currentMeeting]) {
            const meeting = meetings[currentMeeting];
            const message = {
                id: uuidv4(),
                userId,
                userName,
                text,
                timestamp: new Date().toISOString()
            };
            meeting.messages.push(message);
            saveData(MEETINGS_FILE, meetings);
            io.to(currentMeeting).emit('new-message', message);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (currentMeeting && meetings[currentMeeting]) {
            const meeting = meetings[currentMeeting];
            // Remove participant
            delete meeting.participants[userId];
            // If screen sharer left, clear screen share
            if (meeting.screenSharer === userId) {
                meeting.screenSharer = null;
                io.to(currentMeeting).emit('screen-share-stopped', { userId });
            }
            saveData(MEETINGS_FILE, meetings);
            // Notify others
            socket.to(currentMeeting).emit('user-left', {
                userId,
                name: userName
            });
            // Clean up empty meetings
            if (Object.keys(meeting.participants).length === 0) {
                delete meetings[currentMeeting];
                saveData(MEETINGS_FILE, meetings);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});