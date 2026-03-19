// client.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const messagesList = document.getElementById('messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('messageInput');
    const logoutButton = document.getElementById('logout-button');
    const currentChatTargetDisplay = document.getElementById('current-chat-target');

    const myProfileArea = document.getElementById('my-profile-area');
    const myProfilePicElem = document.getElementById('my-profile-pic');
    const myUsernameDisplayElem = document.getElementById('my-username-display');
    const myCustomIdDisplayElem = document.getElementById('my-customid-display');

    const conversationsList = document.getElementById('conversations-list');
    const recordButton = document.getElementById('recordButton');
    const recordingIndicator = document.getElementById('recording-indicator');
    const sendButton = document.getElementById('sendButton');

    const loginForm = document.getElementById('login-form');
    const loginErrorP = document.getElementById('login-error');

    // --- State ---
    let myUserData = null;
    let socket = null;
    let currentConversationUser = { id: 'global', username: 'Global Chat', isGlobal: true }; // Default
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];

    // --- Support Functions ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function displayMessage(messageData, type = 'chat', prepend = false) {
        if (!messagesList) return;

        // Skip if message already exists (deduplication)
        const msgId = messageData.id || messageData._id;
        if (msgId && messagesList.querySelector(`[data-id="${msgId}"]`)) return;

        const item = document.createElement('li');
        item.classList.add('message-item');
        if (msgId) item.setAttribute('data-id', msgId);

        if (type === 'chat') {
            const senderId = messageData.sender ? messageData.sender.toString() : null;
            const isMyMessage = myUserData && myUserData.id && senderId === myUserData.id.toString();

            item.classList.add(isMyMessage ? 'my-message' : 'received');

            let senderName = 'Unknown';
            if (isMyMessage) {
                senderName = myUserData.username;
            } else if (messageData.senderProfile) {
                senderName = messageData.senderProfile.username;
            }

            const time = formatTime(messageData.timestamp);
            let contentHtml = '';

            if (messageData.content && messageData.content !== '[Audio Message]') {
                contentHtml += `<div class="message-text">${escapeHtml(messageData.content)}</div>`;
            }

            if (messageData.fileAttachment) {
                const fa = messageData.fileAttachment;
                contentHtml += `
                    <div class="file-attachment">
                        <a href="${fa.url}" target="_blank">
                            <i class="fas fa-file"></i> ${escapeHtml(fa.name)}
                        </a>
                    </div>`;
            }

            if (messageData.audioFile) {
                contentHtml += `
                    <div class="audio-message">
                        <audio controls src="${messageData.audioFile.url}"></audio>
                    </div>`;
            }

            item.innerHTML = `
                ${!isMyMessage ? `<span class="username">${escapeHtml(senderName)}</span>` : ''}
                <div class="bubble-content">
                    ${contentHtml}
                    <span class="timestamp">${time}</span>
                </div>
            `;
        } else {
            item.classList.add('system-message');
            item.innerHTML = `<span class="system-text">${escapeHtml(messageData.text)}</span>`;
        }

        if (prepend) {
            messagesList.insertBefore(item, messagesList.firstChild);
        } else {
            messagesList.appendChild(item);
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }

    // --- Chat Logic ---
    async function startChat(user) {
        if (!user) return;
        currentConversationUser = user;
        
        // Update header
        if (currentChatTargetDisplay) {
            currentChatTargetDisplay.innerHTML = `
                <img src="${user.profilePic || 'assets/default-avatar.png'}" class="chat-target-avatar">
                <span>${escapeHtml(user.username)}</span>
            `;
        }

        if (messageInput) {
            messageInput.placeholder = `Message ${user.username}...`;
            messageInput.focus();
        }

        // Highlight sidebar
        document.querySelectorAll('#conversations-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.userid === (user.id ? user.id.toString() : 'global'));
        });

        // Load history
        messagesList.innerHTML = '<li class="system-message">Loading messages...</li>';
        try {
            const url = user.isGlobal ? '/api/messages?with=global' : `/api/messages?with=${user.id}`;
            const res = await fetch(url);
            const messages = await res.json();
            messagesList.innerHTML = '';
            if (messages.length === 0) {
                messagesList.innerHTML = '<li class="system-message">No messages yet.</li>';
            } else {
                messages.forEach(msg => displayMessage(msg));
            }
        } catch (err) {
            messagesList.innerHTML = '<li class="system-message">Failed to load history.</li>';
        }
    }

    async function loadConversationsSidebar() {
        try {
            const res = await fetch('/api/conversations');
            const conversations = await res.json();
            if (!conversationsList) return;
            
            conversationsList.innerHTML = '';
            
            // Always show Global Chat at the top
            const globalLi = document.createElement('li');
            globalLi.dataset.userid = 'global';
            globalLi.innerHTML = `
                <div class="conversation">
                    <img src="assets/default-avatar.png" class="avatar-circle">
                    <div class="conversation-info">
                        <span class="username">Global Chat</span>
                        <span class="last-msg">Connect with everyone</span>
                    </div>
                </div>
            `;
            globalLi.addEventListener('click', () => startChat({ id: 'global', username: 'Global Chat', isGlobal: true }));
            conversationsList.appendChild(globalLi);

            conversations.forEach(c => {
                const li = document.createElement('li');
                li.dataset.userid = c.id;
                li.innerHTML = `
                    <div class="conversation">
                        <img src="${c.profilePic || 'assets/default-avatar.png'}" class="avatar-circle">
                        <div class="conversation-info">
                            <span class="username">${escapeHtml(c.username)}</span>
                            <span class="last-msg">${escapeHtml(c.lastMessage ? c.lastMessage.content : '')}</span>
                        </div>
                    </div>
                `;
                li.addEventListener('click', () => startChat(c));
                conversationsList.appendChild(li);
            });

            // Re-apply active class
            if (currentConversationUser) {
                const activeLi = conversationsList.querySelector(`[data-userid="${currentConversationUser.id || 'global'}"]`);
                if (activeLi) activeLi.classList.add('active');
            }
        } catch (err) {
            console.error('Failed to load conversations', err);
        }
    }

    // --- Socket handlers ---
    function connectSocket() {
        if (socket) return;
        socket = io();

        socket.on('connect', () => {
            console.log('Socket connected');
        });

        socket.on('chat message', (msg) => {
            if (currentConversationUser && currentConversationUser.isGlobal) {
                displayMessage(msg);
            } else {
                // If we are not in global, we might still want to refresh sidebar or count unread
                loadConversationsSidebar();
            }
        });

        socket.on('private message received', (msg) => {
            if (currentConversationUser && msg.sender.toString() === currentConversationUser.id.toString()) {
                displayMessage(msg);
            } else {
                loadConversationsSidebar();
            }
        });

        socket.on('message confirmed', (msg) => {
            if (currentConversationUser) {
                const isMatch = currentConversationUser.isGlobal 
                    ? (!msg.recipient) 
                    : (msg.recipient && msg.recipient.toString() === currentConversationUser.id.toString());
                
                if (isMatch) displayMessage(msg);
            }
        });

        socket.on('user found', (user) => {
            startChat(user);
            loadConversationsSidebar();
        });
    }

    // --- Auth View Logic ---
    function showApp() {
        if (authContainer) authContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
        updateMyProfileUI();
        loadConversationsSidebar();
        connectSocket();
        startChat({ id: 'global', username: 'Global Chat', isGlobal: true });
    }

    function updateMyProfileUI() {
        if (!myUserData) return;
        if (myProfilePicElem) myProfilePicElem.src = myUserData.profilePic || 'assets/default-avatar.png';
        if (myUsernameDisplayElem) myUsernameDisplayElem.textContent = myUserData.username;
        if (myCustomIdDisplayElem) myCustomIdDisplayElem.textContent = `ID: ${myUserData.customId || myUserData.id}`;
    }

    // --- Event Listeners ---
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                myUserData = data.user;
                showApp();
            } else {
                if (loginErrorP) loginErrorP.textContent = data.message;
            }
        } catch (err) {
            if (loginErrorP) loginErrorP.textContent = 'Server error';
        }
    });

    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    if (showRegisterBtn) showRegisterBtn.addEventListener('click', () => {
        if (loginView) loginView.style.display = 'none';
        if (registerView) registerView.style.display = 'block';
    });

    if (showLoginBtn) showLoginBtn.addEventListener('click', () => {
        if (registerView) registerView.style.display = 'none';
        if (loginView) loginView.style.display = 'block';
    });

    const registerForm = document.getElementById('register-form');
    const registerErrorP = document.getElementById('register-error');
    const registerSuccessP = document.getElementById('register-success');

    if (registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(registerForm);
        // Map fields explicitly if names differ
        formData.append('username', document.getElementById('register-username').value);
        formData.append('password', document.getElementById('register-password').value);
        formData.append('customId', document.getElementById('register-custom-id').value);
        
        const picFile = document.getElementById('register-profile-pic').files[0];
        if (picFile) formData.append('profilePic', picFile);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                if (registerSuccessP) registerSuccessP.textContent = 'Account created! Please login.';
                if (registerErrorP) registerErrorP.textContent = '';
                setTimeout(() => showLoginBtn.click(), 2000);
            } else {
                if (registerErrorP) registerErrorP.textContent = data.message;
            }
        } catch (err) {
            if (registerErrorP) registerErrorP.textContent = 'Registration failed.';
        }
    });

    if (logoutButton) logoutButton.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
    });

    if (messageForm) messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content || !currentConversationUser) return;
        
        if (currentConversationUser.isGlobal) {
            socket.emit('chat message', content);
        } else {
            socket.emit('private message', {
                recipientId: currentConversationUser.id,
                message: content
            });
        }
        messageInput.value = '';
        messageInput.focus();
    });

    // --- Audio Logic ---
    async function startRecording() {
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audioFile', blob, 'recording.webm');
                
                if (currentConversationUser && !currentConversationUser.isGlobal) {
                    formData.append('recipientId', currentConversationUser.id);
                }

                try {
                    const res = await fetch('/api/messages/audio', { method: 'POST', body: formData });
                    if (!res.ok) console.error('Audio upload failed', await res.text());
                } catch (err) {
                    console.error('Failed to send audio', err);
                }
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            if (recordButton) recordButton.classList.add('recording');
            if (recordingIndicator) recordingIndicator.style.display = 'block';
        } catch (err) {
            console.error('Mic access denied', err);
            alert('Could not access microphone');
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            if (recordButton) recordButton.classList.remove('recording');
            if (recordingIndicator) recordingIndicator.style.display = 'none';
        }
    }

    if (recordButton) {
        recordButton.addEventListener('mousedown', startRecording);
        recordButton.addEventListener('mouseup', stopRecording);
        recordButton.addEventListener('mouseleave', stopRecording);
        recordButton.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
        recordButton.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });
    }
    const editProfileButton = document.getElementById('edit-profile-button');
    const editProfileModal = document.getElementById('edit-profile-modal');
    const closeProfileModal = document.getElementById('close-profile-modal');
    const editProfileForm = document.getElementById('edit-profile-form');
    const editProfileError = document.getElementById('edit-profile-error');
    const editProfileSuccess = document.getElementById('edit-profile-success');

    if (editProfileButton) editProfileButton.addEventListener('click', () => {
        if (editProfileModal) {
            editProfileModal.style.display = 'flex';
            const idSpan = document.querySelector('#edit-profile-id-display span');
            if (idSpan) idSpan.textContent = myUserData.customId || myUserData.id;
        }
    });

    if (closeProfileModal) closeProfileModal.addEventListener('click', () => {
        if (editProfileModal) editProfileModal.style.display = 'none';
    });

    if (editProfileForm) editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        const picFile = document.getElementById('edit-profile-pic-input').files[0];
        if (picFile) formData.append('profilePic', picFile);

        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                myUserData = data.user;
                updateMyProfileUI();
                if (editProfileSuccess) editProfileSuccess.textContent = 'Profile updated!';
                setTimeout(() => {
                    if (editProfileModal) editProfileModal.style.display = 'none';
                    if (editProfileSuccess) editProfileSuccess.textContent = '';
                }, 1500);
            } else {
                if (editProfileError) editProfileError.textContent = data.message;
            }
        } catch (err) {
            if (editProfileError) editProfileError.textContent = 'Update failed.';
        }
    });

    // --- Init ---
    async function checkAuth() {
        try {
            const res = await fetch('/api/check-auth');
            const data = await res.json();
            if (data.isAuthenticated) {
                myUserData = data.user;
                showApp();
            } else {
                if (authContainer) authContainer.style.display = 'flex';
            }
        } catch (err) {
            if (authContainer) authContainer.style.display = 'flex';
        }
    }

    checkAuth();
});