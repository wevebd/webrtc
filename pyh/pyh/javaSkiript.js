// Elementlarni tanlab olamiz
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');

let localStream;
let remoteStream;
let peerConnection;

// Signalling server uchun soxta ma'lumotlar
const signalingServer = {
    send: (message) => console.log('Yuborilgan xabar:', message),
    onmessage: null
};

// ICE serverlar konfiguratsiyasi
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Google STUN serveri
    ]
};

// WebRTC konfiguratsiyasi
const pcConfig = iceServers;

// Local videoni olish
async function startLocalVideo() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Kamera va mikrofonni olishda xatolik:', error);
        throw error;
    }
}

// PeerConnection yaratish
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(pcConfig);

    // Remote streamni qo'shish
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // ICE nomzodlarni yuborish
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingServer.send({ type: 'candidate', candidate: event.candidate });
        }
    };

    // Xatoliklar
    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('ICE connection failed');
        }
    };

    // Local streamni qo'shish
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

// Signalling serverdan kelgan xabarlarni qayta ishlash
signalingServer.onmessage = async (message) => {
    try {
        if (!peerConnection) {
            createPeerConnection();
        }

        if (message.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingServer.send({ type: 'answer', answer });
        } else if (message.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.type === 'candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        } else if (message.type === 'chat') {
            chatMessages.innerHTML += `<div><strong>Sherigingiz:</strong> ${message.message}</div>`;
        }
    } catch (error) {
        console.error('Xabar qayta ishlashda xatolik:', error);
    }
};

// Qo'ng'iroqni boshlash
startButton.addEventListener('click', async () => {
    try {
        await startLocalVideo();
        createPeerConnection();

        // Offer yaratish
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send({ type: 'offer', offer });
    } catch (error) {
        console.error('Qo\'ng\'iroqni boshlashda xatolik:', error);
    }
});

// Qo'ng'iroqni tugatish
hangupButton.addEventListener('click', () => {
    try {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localVideo.srcObject = null;
        }
        
        remoteVideo.srcObject = null;
        console.log('Qo\'ng\'iroq tugatildi');
    } catch (error) {
        console.error('Qo\'ng\'iroqni tugatishda xatolik:', error);
    }
});

// Chat funksiyasi
sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        chatMessages.innerHTML += `<div><strong>Siz:</strong> ${message}</div>`;
        chatInput.value = '';
        // Xabarni remote foydalanuvchiga yuborish
        signalingServer.send({ type: 'chat', message });
    }
});