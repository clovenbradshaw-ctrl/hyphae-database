import * as sdk from 'matrix-js-sdk';

let client = null;
let currentRoom = null;

// Elements
const loginForm = document.getElementById('loginForm');
const clientArea = document.getElementById('clientArea');
const loginBtn = document.getElementById('loginBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginStatus = document.getElementById('loginStatus');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const userDisplay = document.getElementById('userDisplay');
const deviceDisplay = document.getElementById('deviceDisplay');
const roomsList = document.getElementById('roomsList');
const messagesContainer = document.getElementById('messagesContainer');
const messages = document.getElementById('messages');
const currentRoomName = document.getElementById('currentRoomName');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Room creation elements
const createRoomBtn = document.getElementById('createRoomBtn');
const createRoomModal = document.getElementById('createRoomModal');
const createRoomConfirm = document.getElementById('createRoomConfirm');
const createRoomCancel = document.getElementById('createRoomCancel');
const roomNameInput = document.getElementById('roomName');
const roomTopicInput = document.getElementById('roomTopic');
const roomEncryptedCheckbox = document.getElementById('roomEncrypted');

// Data storage elements
const dataKeyInput = document.getElementById('dataKey');
const dataValueInput = document.getElementById('dataValue');
const storeDataBtn = document.getElementById('storeDataBtn');
const storedData = document.getElementById('storedData');
const refreshDataBtn = document.getElementById('refreshDataBtn');

// Simple recovery key elements
const enterRecoveryKeyBtn = document.getElementById('enterRecoveryKeyBtn');
const simpleRecoveryModal = document.getElementById('simpleRecoveryModal');
const simpleRecoveryKey = document.getElementById('simpleRecoveryKey');
const submitSimpleRecovery = document.getElementById('submitSimpleRecovery');
const cancelSimpleRecovery = document.getElementById('cancelSimpleRecovery');
const recoveryStatus = document.getElementById('recoveryStatus');

// Verification elements - DISABLED
/*
const verificationModal = document.getElementById('verificationModal');
const verifyWithAnotherDevice = document.getElementById('verifyWithAnotherDevice');
const verifyWithRecovery = document.getElementById('verifyWithRecovery');
const skipVerification = document.getElementById('skipVerification');
const emojiVerification = document.getElementById('emojiVerification');
const emojiDisplay = document.getElementById('emojiDisplay');
const emojiMatch = document.getElementById('emojiMatch');
const emojiDontMatch = document.getElementById('emojiDontMatch');
const recoveryKeyInput = document.getElementById('recoveryKeyInput');
const recoveryKeyField = document.getElementById('recoveryKey');
const submitRecoveryKey = document.getElementById('submitRecoveryKey');
const backFromRecovery = document.getElementById('backFromRecovery');

let verificationRequest = null;
*/

// Show status message
function showStatus(message, type = 'info') {
    loginStatus.textContent = message;
    loginStatus.className = `status ${type}`;
    loginStatus.classList.remove('hidden');
}

// Clear stored encryption keys
clearDataBtn.addEventListener('click', async () => {
    if (!confirm('This will clear all stored encryption keys. You will need to verify this device again. Continue?')) {
        return;
    }
    
    clearDataBtn.disabled = true;
    showStatus('Clearing encryption data...', 'info');
    
    try {
        // Clear all Matrix-related IndexedDB databases
        const databases = ['matrix-js-sdk:crypto', 'matrix-js-sdk', 'matrix-sdk-crypto'];
        
        for (const dbName of databases) {
            await new Promise((resolve) => {
                const request = indexedDB.deleteDatabase(dbName);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve(); // Continue even if error
                request.onblocked = () => resolve();
            });
        }
        
        showStatus('Encryption data cleared! You can now login fresh.', 'success');
    } catch (error) {
        console.error('Error clearing data:', error);
        showStatus('Error clearing data. Try refreshing the page.', 'error');
    } finally {
        clearDataBtn.disabled = false;
    }
});

// Login handler
loginBtn.addEventListener('click', async () => {
    let username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showStatus('Please enter both username and password', 'error');
        return;
    }

    // Add domain if not provided
    if (!username.includes(':')) {
        username = `@${username.replace('@', '')}:hyphae.social`;
    }
    
    loginBtn.disabled = true;
    showStatus('Connecting to Hyphae...', 'info');
    
    try {
        // Create temporary client for login
        const tempClient = sdk.createClient({
            baseUrl: "https://hyphae.social"
        });
        
        // Login
        showStatus('Authenticating...', 'info');
        const response = await tempClient.login("m.login.password", {
            user: username,
            password: password
        });
        
        showStatus('Initializing end-to-end encryption...', 'info');
        
        // First, aggressively clear ALL Matrix-related databases
        showStatus('Clearing old encryption data...', 'info');
        const allDatabases = await indexedDB.databases();
        for (const db of allDatabases) {
            if (db.name.includes('matrix') || db.name.includes('crypto')) {
                console.log('Deleting database:', db.name);
                await new Promise((resolve) => {
                    const req = indexedDB.deleteDatabase(db.name);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                    setTimeout(resolve, 1000); // Timeout
                });
            }
        }
        
        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
        
        showStatus('Setting up fresh encryption...', 'info');
        
        // Create the actual client with credentials
        client = sdk.createClient({
            baseUrl: "https://hyphae.social",
            accessToken: response.access_token,
            userId: response.user_id,
            deviceId: response.device_id
        });
        
        // Initialize Rust crypto with unique database prefix per user+device
        // This prevents conflicts when switching between users/devices
        const userHash = response.user_id.replace(/[^a-zA-Z0-9]/g, '_');
        const deviceHash = response.device_id.substring(0, 8);
        const uniquePrefix = `matrix-crypto-${userHash}-${deviceHash}`;
        
        console.log('Using crypto database prefix:', uniquePrefix);
        
        await client.initRustCrypto({
            cryptoDatabasePrefix: uniquePrefix
        });
        
        showStatus('Setting up encryption keys...', 'info');
        
        // Get crypto API
        const crypto = client.getCrypto();
        
        // Bootstrap cross-signing if needed
        try {
            await crypto.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (makeRequest) => {
                    // Use the same password-based auth
                    return makeRequest({
                        type: "m.login.password",
                        user: username,
                        password: password,
                        identifier: {
                            type: "m.id.user",
                            user: username
                        }
                    });
                }
            });
        } catch (e) {
            console.log('Cross-signing setup info:', e.message);
            // This might fail if already set up, which is fine
        }

        showStatus('Starting sync...', 'info');
        
        // Start syncing
        await client.startClient({ initialSyncLimit: 10 });
        
        // Wait for sync to be ready
        client.once('sync', (state) => {
            if (state === 'PREPARED') {
                showUI(response.user_id, response.device_id);
            }
        });
        
        // Listen for new messages
        client.on('Room.timeline', (event, room, toStartOfTimeline) => {
            if (currentRoom && room.roomId === currentRoom.roomId && !toStartOfTimeline) {
                displayMessages(room);
                // Also reload data if it's a data record
                if (event.getType() === 'com.hyphae.data.record') {
                    loadStoredData(room);
                }
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        showStatus(`Connection failed: ${error.message || error.data?.error || 'Unknown error'}`, 'error');
        loginBtn.disabled = false;
    }
});

// Show main UI
function showUI(userId, deviceId) {
    loginForm.classList.add('hidden');
    clientArea.classList.remove('hidden');
    userDisplay.textContent = userId;
    deviceDisplay.textContent = `Device: ${deviceId} (Click to verify)`;
    loadRooms();
    
    // Don't auto-show verification modal
    // User can click their ID to verify later
}

// Create room modal handlers
createRoomBtn.addEventListener('click', () => {
    console.log('Create room clicked');
    createRoomModal.classList.remove('hidden');
    createRoomModal.style.display = 'flex';
});

createRoomCancel.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Cancel clicked');
    createRoomModal.classList.add('hidden');
    createRoomModal.style.display = 'none';
    roomNameInput.value = '';
    roomTopicInput.value = '';
});

// Click outside modal to close
createRoomModal.addEventListener('click', (e) => {
    if (e.target === createRoomModal) {
        createRoomModal.classList.add('hidden');
        createRoomModal.style.display = 'none';
        roomNameInput.value = '';
        roomTopicInput.value = '';
    }
});

createRoomConfirm.addEventListener('click', async () => {
    const name = roomNameInput.value.trim();
    const topic = roomTopicInput.value.trim();
    const encrypted = roomEncryptedCheckbox.checked;
    
    if (!name) {
        alert('Please enter a room name');
        return;
    }
    
    createRoomConfirm.disabled = true;
    
    try {
        const roomConfig = {
            name: name,
            topic: topic,
            visibility: 'private',
            preset: 'trusted_private_chat'
        };
        
        // Add encryption if requested
        if (encrypted) {
            roomConfig.initial_state = [
                {
                    type: 'm.room.encryption',
                    state_key: '',
                    content: {
                        algorithm: 'm.megolm.v1.aes-sha2'
                    }
                }
            ];
        }
        
        const { room_id } = await client.createRoom(roomConfig);
        
        console.log('Room created:', room_id);
        alert(`Room "${name}" created successfully!${encrypted ? ' 🔒 Encrypted' : ''}`);
        
        // Close modal and refresh rooms
        createRoomModal.classList.add('hidden');
        roomNameInput.value = '';
        roomTopicInput.value = '';
        
        // Wait a moment for sync then reload rooms
        setTimeout(() => loadRooms(), 1000);
        
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Failed to create room: ' + (error.message || 'Unknown error'));
    } finally {
        createRoomConfirm.disabled = false;
    }
});

// Load rooms
function loadRooms() {
    const rooms = client.getRooms();
    roomsList.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No rooms found. Create or join a room to get started!</p>';
        return;
    }
    
    rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        const isEncrypted = client.isRoomEncrypted(room.roomId);
        roomDiv.className = `room-item ${isEncrypted ? 'encrypted' : ''}`;
        
        roomDiv.innerHTML = `
            <div class="room-name">${escapeHtml(room.name || 'Unnamed Room')}</div>
            <div class="room-id">${room.roomId}</div>
        `;
        roomDiv.addEventListener('click', () => selectRoom(room, roomDiv));
        roomsList.appendChild(roomDiv);
    });
}

// Select a room
function selectRoom(room, roomElement) {
    // Remove previous selection
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('selected'));
    roomElement.classList.add('selected');
    
    currentRoom = room;
    messagesContainer.classList.remove('hidden');
    
    const isEncrypted = client.isRoomEncrypted(room.roomId);
    const encStatus = isEncrypted ? ' 🔒' : '';
    currentRoomName.textContent = (room.name || 'Unnamed Room') + encStatus;
    
    displayMessages(room);
    loadStoredData(room);
}

// Store data in room
storeDataBtn.addEventListener('click', async () => {
    const key = dataKeyInput.value.trim();
    const value = dataValueInput.value.trim();
    
    if (!key || !value || !currentRoom) return;
    
    storeDataBtn.disabled = true;
    
    try {
        // Store as custom event type
        await client.sendEvent(currentRoom.roomId, 'com.hyphae.data.record', {
            key: key,
            value: value,
            timestamp: Date.now()
        });
        
        dataKeyInput.value = '';
        dataValueInput.value = '';
        
        // Reload stored data
        setTimeout(() => loadStoredData(currentRoom), 500);
        
    } catch (error) {
        console.error('Error storing data:', error);
        alert('Failed to store data: ' + (error.message || 'Unknown error'));
    } finally {
        storeDataBtn.disabled = false;
    }
});

// Refresh data button
refreshDataBtn.addEventListener('click', () => {
    if (currentRoom) {
        console.log('Refreshing data for room:', currentRoom.roomId);
        loadStoredData(currentRoom);
    }
});

// Load stored data from room
function loadStoredData(room) {
    const timeline = room.timeline;
    const dataRecords = [];
    
    timeline.forEach(event => {
        if (event.getType() === 'com.hyphae.data.record') {
            const content = event.getContent();
            dataRecords.push({
                key: content.key,
                value: content.value,
                timestamp: content.timestamp || event.getTs(),
                sender: event.getSender()
            });
        }
    });
    
    // Display stored data
    storedData.innerHTML = '';
    
    if (dataRecords.length === 0) {
        storedData.innerHTML = '<p style="color: #999; font-size: 13px; margin-top: 10px;">No data stored yet</p>';
        return;
    }
    
    dataRecords.reverse().forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'data-record';
        recordDiv.innerHTML = `
            <div class="data-record-key">${escapeHtml(record.key)}</div>
            <div class="data-record-value">${escapeHtml(record.value)}</div>
            <div class="data-record-meta">
                ${new Date(record.timestamp).toLocaleString()} • ${escapeHtml(record.sender)}
            </div>
        `;
        storedData.appendChild(recordDiv);
    });
}

// Display messages
async function displayMessages(room) {
    const timeline = room.timeline;
    messages.innerHTML = '';
    
    if (timeline.length === 0) {
        messages.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No messages yet. Be the first to say something!</p>';
        return;
    }
    
    for (const event of timeline) {
        if (event.getType() === 'm.room.message') {
            const messageDiv = document.createElement('div');
            const isEncrypted = event.isEncrypted();
            messageDiv.className = `message ${isEncrypted ? 'encrypted' : ''}`;
            
            const sender = event.getSender();
            const content = event.getContent();
            const time = new Date(event.getTs()).toLocaleString();
            
            let bodyText = content.body || '[Unable to decrypt]';
            
            messageDiv.innerHTML = `
                <div class="message-sender">${escapeHtml(sender)}</div>
                <div class="message-body">${escapeHtml(bodyText)}</div>
                <div class="message-time">${time}</div>
                ${isEncrypted ? '<div class="message-encrypted-indicator">🔒 Encrypted</div>' : ''}
            `;
            
            messages.appendChild(messageDiv);
        }
    }
    
    // Scroll to bottom
    messages.scrollTop = messages.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Send message
sendBtn.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    if (!message || !currentRoom) return;
    
    sendBtn.disabled = true;
    
    try {
        await client.sendMessage(currentRoom.roomId, {
            msgtype: 'm.text',
            body: message
        });
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + (error.message || error.data?.error || 'Unknown error'));
    } finally {
        sendBtn.disabled = false;
    }
});

// Send on Enter
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        sendBtn.click();
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    if (client) {
        await client.stopClient();
        client = null;
    }
    currentRoom = null;
    clientArea.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginStatus.classList.add('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
    loginBtn.disabled = false;
    messagesContainer.classList.add('hidden');
});

// Device Verification Handlers - DISABLED FOR NOW
/*
verifyWithAnotherDevice.addEventListener('click', async () => {
    try {
        const crypto = client.getCrypto();
        const userId = client.getUserId();
        
        // Request verification with own user
        verificationRequest = await crypto.requestOwnUserVerification();
        
        // Listen for emoji verification
        verificationRequest.on('show_sas', (event) => {
            const emoji = event.sas.emoji;
            emojiVerification.classList.remove('hidden');
            emojiDisplay.innerHTML = emoji.map(e => `${e[0]} ${e[1]}`).join(' ');
        });
        
        // Hide method buttons, show emoji verification
        document.querySelector('.verification-methods').classList.add('hidden');
        
    } catch (error) {
        console.error('Verification error:', error);
        alert('Failed to start verification: ' + error.message);
    }
});

emojiMatch.addEventListener('click', async () => {
    try {
        if (verificationRequest) {
            await verificationRequest.confirm();
            alert('✓ Device verified successfully!');
            verificationModal.classList.add('hidden');
            resetVerificationModal();
        }
    } catch (error) {
        console.error('Confirmation error:', error);
        alert('Failed to confirm: ' + error.message);
    }
});

emojiDontMatch.addEventListener('click', () => {
    if (verificationRequest) {
        verificationRequest.cancel();
    }
    alert('Verification cancelled. The emoji did not match.');
    verificationModal.classList.add('hidden');
    resetVerificationModal();
});

verifyWithRecovery.addEventListener('click', () => {
    document.querySelector('.verification-methods').classList.add('hidden');
    recoveryKeyInput.classList.remove('hidden');
});

backFromRecovery.addEventListener('click', () => {
    document.querySelector('.verification-methods').classList.remove('hidden');
    recoveryKeyInput.classList.add('hidden');
    recoveryKeyField.value = '';
});

submitRecoveryKey.addEventListener('click', async () => {
    const key = recoveryKeyField.value.trim();
    if (!key) {
        alert('Please enter your recovery key');
        return;
    }
    
    submitRecoveryKey.disabled = true;
    
    try {
        // Recovery keys need to be decoded from the base58 format
        // Format: "EsAB cdef ghij klmn opqr stuv wxyz 0123 4567 89AB CDEF GHIJ KLMN"
        const cleanKey = key.replace(/\s/g, '');
        
        const crypto = client.getCrypto();
        
        // Decode the recovery key (it's base58 encoded)
        // We'll use the SDK's built-in decoder
        let decodedKey;
        try {
            // The SDK expects the key in a specific format
            // Try to use it directly first
            decodedKey = cleanKey;
        } catch (e) {
            throw new Error('Invalid recovery key format');
        }
        
        // Bootstrap secret storage with the recovery key
        await crypto.bootstrapSecretStorage({
            createSecretStorageKey: async () => {
                // Return the decoded key
                return { privateKey: decodedKey };
            },
            setupNewSecretStorage: false,
            key: decodedKey
        });
        
        // Also bootstrap cross-signing to restore keys
        try {
            await crypto.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (makeRequest) => {
                    // Use empty auth - keys should be restored from secret storage
                    return await makeRequest({});
                }
            });
        } catch (e) {
            console.log('Cross-signing bootstrap:', e.message);
        }
        
        alert('✓ Recovery key accepted! Your encryption keys have been restored.\n\nYou should now be able to decrypt your messages.');
        verificationModal.classList.add('hidden');
        resetVerificationModal();
        
        // Reload rooms to trigger key sync
        setTimeout(() => loadRooms(), 1000);
        
    } catch (error) {
        console.error('Recovery error:', error);
        let errorMsg = 'Failed to verify with recovery key.\n\n';
        
        if (error.message.includes('Invalid') || error.message.includes('format')) {
            errorMsg += 'The recovery key appears to be invalid. Please check:\n';
            errorMsg += '• It should be 58 characters (including spaces)\n';
            errorMsg += '• Format: EsAB cdef ghij klmn...\n';
            errorMsg += '• Copy it exactly from Element Settings → Security';
        } else {
            errorMsg += 'Error: ' + error.message;
            errorMsg += '\n\nTip: Make sure you copied the full recovery key from Element.';
        }
        
        alert(errorMsg);
    } finally {
        submitRecoveryKey.disabled = false;
    }
});

skipVerification.addEventListener('click', () => {
    console.log('Skip verification clicked');
    verificationModal.classList.add('hidden');
    verificationModal.style.display = 'none'; // Extra enforcement
    resetVerificationModal();
    console.log('Verification modal should be hidden now');
});

function resetVerificationModal() {
    document.querySelector('.verification-methods').classList.remove('hidden');
    emojiVerification.classList.add('hidden');
    recoveryKeyInput.classList.add('hidden');
    recoveryKeyField.value = '';
    verificationRequest = null;
}

// Add button to show verification modal (add to user info section)
userDisplay.addEventListener('click', () => {
    verificationModal.classList.remove('hidden');
});
*/

// Simple Recovery Key Handlers
enterRecoveryKeyBtn.addEventListener('click', () => {
    simpleRecoveryModal.classList.remove('hidden');
    simpleRecoveryModal.style.display = 'flex';
    recoveryStatus.classList.add('hidden');
});

cancelSimpleRecovery.addEventListener('click', () => {
    simpleRecoveryModal.classList.add('hidden');
    simpleRecoveryModal.style.display = 'none';
    simpleRecoveryKey.value = '';
    recoveryStatus.classList.add('hidden');
});

// Click outside to close
simpleRecoveryModal.addEventListener('click', (e) => {
    if (e.target === simpleRecoveryModal) {
        cancelSimpleRecovery.click();
    }
});

submitSimpleRecovery.addEventListener('click', async () => {
    const key = simpleRecoveryKey.value.trim();
    if (!key) {
        showRecoveryStatus('Please enter your recovery key', 'error');
        return;
    }
    
    submitSimpleRecovery.disabled = true;
    showRecoveryStatus('Restoring encryption keys...', 'info');
    
    try {
        const crypto = client.getCrypto();
        
        // Try to restore from secret storage using the recovery key
        await crypto.bootstrapSecretStorage({
            setupNewSecretStorage: false,
            createSecretStorageKey: async () => {
                return { encodedPrivateKey: key };
            }
        });
        
        showRecoveryStatus('✅ Keys restored!', 'success');
        
        // Close modal immediately
        setTimeout(() => {
            simpleRecoveryModal.classList.add('hidden');
            simpleRecoveryModal.style.display = 'none';
            simpleRecoveryKey.value = '';
            recoveryStatus.classList.add('hidden');
            
            // Reload current room if one is selected
            if (currentRoom) {
                displayMessages(currentRoom);
                loadStoredData(currentRoom);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Recovery error:', error);
        let errorMsg = 'Failed to restore keys: ' + error.message;
        
        if (error.message.includes('Secret storage') || error.message.includes('not set up')) {
            errorMsg = 'Secret storage not set up on this account. You may need to set it up in Element first.';
        }
        
        showRecoveryStatus(errorMsg, 'error');
    } finally {
        submitSimpleRecovery.disabled = false;
    }
});

function showRecoveryStatus(message, type) {
    recoveryStatus.textContent = message;
    recoveryStatus.className = type;
    recoveryStatus.classList.remove('hidden');
}

// Global Escape key handler for all modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close create room modal
        if (!createRoomModal.classList.contains('hidden')) {
            createRoomCancel.click();
        }
        // Close recovery modal
        if (!simpleRecoveryModal.classList.contains('hidden')) {
            cancelSimpleRecovery.click();
        }
    }
});

console.log('Hyphae E2EE Client loaded - Verification disabled for stability');
