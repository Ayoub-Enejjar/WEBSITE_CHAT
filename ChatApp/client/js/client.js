// client.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const registerUsernameInput = document.getElementById('register-username');
    const registerPasswordInput = document.getElementById('register-password');
    const registerCustomIdInput = document.getElementById('register-custom-id');
    const loginErrorP = document.getElementById('login-error');
    const registerErrorP = document.getElementById('register-error');
    const registerSuccessP = document.getElementById('register-success');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');

    const appContainer = document.getElementById('app-container');
    const messagesList = document.getElementById('messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('messageInput');
    const messageErrorP = document.getElementById('message-error');
    const userListUL = document.getElementById('user-list');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const logoutButton = document.getElementById('logout-button');
    const currentChatTargetDisplay = document.getElementById('current-chat-target');

    const myProfileArea = document.getElementById('my-profile-area');
    const myProfilePicElem = document.getElementById('my-profile-pic');
    const myUsernameDisplayElem = document.getElementById('my-username-display');
    const myCustomIdDisplayElem = document.getElementById('my-customid-display');

    const bodyElement = document.body;
    const chatWrapper = document.getElementById('chat-wrapper');
    const bgChoiceButtons = document.querySelectorAll('.bg-choice');
    const fileInput = document.getElementById('fileInput');
    const fileUploadProgress = document.getElementById('file-upload-progress');

    const editProfileModal = document.getElementById('edit-profile-modal');
    const closeProfileModalBtn = document.getElementById('close-profile-modal');
    const editProfileForm = document.getElementById('edit-profile-form');
    const currentProfilePicPreview = document.getElementById('current-profile-pic-preview');
    const editProfilePicInput = document.getElementById('edit-profile-pic-input');
    const editProfileIdDisplaySpan = document.querySelector('#edit-profile-id-display span');
    const editProfileErrorP = document.getElementById('edit-profile-error');
    const editProfileSuccessP = document.getElementById('edit-profile-success');

    const contactIdForm = document.getElementById('contact-id-form');
    const contactIdInput = document.getElementById('contact-id-input');
    const contactIdErrorP = document.getElementById('contact-id-error');
    const contactIdSuccessP = document.getElementById('contact-id-success');

    const conversationsList = document.getElementById('conversations-list');

    const recordButton = document.getElementById('recordButton');
    const recordingIndicator = document.getElementById('recording-indicator');
    const sendButton = document.getElementById('sendButton');

    // --- State ---
    let myUserData = null;
    let socket = null;
    let currentConversationUser = null; // The user object for the currently active private chat
    let currentChat = null; // Alias for currentConversationUser for clarity in some functions

    let loadingOlderMessages = false;
    let allMessagesLoaded = false;

    // Audio Recording State
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // --- Helper Functions ---
   function escapeHtml(unsafe) {
    // Vérification de type pour la sécurité
    if (typeof unsafe !== 'string') {
        console.warn("escapeHtml received non-string value:", unsafe);
        return ''; // Retourne une chaîne vide si ce n'est pas une chaîne
    }
    // L'ordre est important : on remplace d'abord le '&'
    return unsafe
        .replace(/&/g, "&amp;")   // & devient &amp;
        .replace(/</g, "&lt;")    // < devient &lt;
        .replace(/>/g, "&gt;")    // > devient &gt;
        .replace(/"/g, "&quot;")  // " devient &quot;
        .replace(/'/g, "&#039;"); // ' devient &#039;
}

    function displayMessage(messageData, type = 'chat', prepend = false) {
        console.log("displayMessage called with:", messageData, "type:", type, "prepend:", prepend);
        if (!messagesList) {
            console.error("Messages list element not found.");
            return;
        }

        // Always create the message item
        const item = document.createElement('li');
        item.classList.add('message-item');

        // Handle cases where messageData.sender might be an object with an _id, a string ID, or null/undefined
        let senderId = null;
        if (messageData && messageData.sender) {
            senderId = String(messageData.sender); // Always treat as string ID
            console.log('[displayMessage] Sender ID:', senderId);
        }

        // isMyMessage check should only happen if senderId is successfully determined
        const isMyMessage = myUserData && myUserData.id && senderId &&
                            String(myUserData.id) === senderId;

        console.log(`[displayMessage] Message Type: ${type}, Content Snippet: ${messageData.content ? messageData.content.substring(0, 50) : 'N/A'}, File/Audio: ${messageData.fileAttachment || messageData.audioFile ? 'Yes' : 'No'}, Sender Raw: ${JSON.stringify(messageData.sender)}, Extracted Sender ID: ${senderId}, My User ID: ${myUserData ? myUserData.id : 'N/A'}, Is My Message: ${isMyMessage}`);

        item.classList.add(isMyMessage ? 'my-message' : 'received');

        // Get sender profile data
        let username = 'Anonymous';
        let profilePic = 'assets/default-avatar.png'; // Default avatar path

        // Use myUserData if it's my message, otherwise use senderProfile from messageData
        if (isMyMessage && myUserData) {
             username = escapeHtml(myUserData.username || 'Anonymous');
             profilePic = myUserData.profilePic || 'assets/default-avatar.png';
        } else if (messageData.senderProfile) {
            username = escapeHtml(messageData.senderProfile.username || 'Anonymous');
            // Use the profilePic from senderProfile if available, otherwise use default
            profilePic = messageData.senderProfile.profilePic || 'assets/default-avatar.png';
        } else if (senderId) { // Fallback if senderProfile is missing but we have a senderId
             // This case might require fetching user data if not in myUserData or conversation list
             // For now, we can just use the senderId or a generic placeholder
             username = `User ID: ${escapeHtml(senderId.substring(0, 10))}...`;
        }

        // Render message content
        if (type === 'chat') {
            // Use messageData.timestamp directly as it's already a Date object or ISO string from server
            const time = messageData.timestamp ? new Date(messageData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const timestampSpan = time ? `<span class="timestamp">${time}</span>` : '';
            let messageHtml = '';
            let userPrefix = '';

            // Add prefix only for received messages and if username is available
            if (!isMyMessage && username && username !== 'Anonymous') {
                userPrefix = `<strong class="username">${escapeHtml(username)}</strong><br>`;
            }

            if (messageData.content) {
                messageHtml += `<span class="message-text">${escapeHtml(messageData.content)}</span>`;
            }

            // Add file attachment handling
            if (messageData.fileAttachment) {
                console.log("Received file message:", messageData);
                const fileUrl = messageData.fileAttachment.url;
                const fileName = messageData.fileAttachment.name;
                const fileType = messageData.fileAttachment.type;
                const fileSize = messageData.fileAttachment.size;

                // Format file size
                const formatFileSize = (bytes) => {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                };

                messageHtml += `
                    <div class="file-attachment">
                        <a href="${escapeHtml(fileUrl)}" target="_blank" class="file-link">
                            <i class="fas fa-file"></i>
                            <span class="file-name">${escapeHtml(fileName)}</span>
                            <span class="file-size">(${formatFileSize(fileSize)})</span>
                        </a>
                    </div>
                `;
            }

            // Add audio message handling
            if (messageData.audioFile) {
                console.log("Received audio message:", messageData);
                const audioUrl = messageData.audioFile.url;
                // Remove the codecs parameter from the URL if present
                const cleanAudioUrl = audioUrl.split(';')[0];
                messageHtml += `
                    <div class="audio-message">
                        <audio controls>
                            <source src="${escapeHtml(cleanAudioUrl)}" type="audio/webm"> // Assuming webm format for audio
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                `;
            }

            // Construct the full message item HTML
            item.innerHTML = userPrefix + messageHtml + timestampSpan;
            // Store timestamp for pagination
            if (messageData.timestamp) item.dataset.timestamp = messageData.timestamp;

            // Append or prepend the message based on the flag
            if (prepend) {
                messagesList.insertBefore(item, messagesList.firstChild);
            } else {
                messagesList.appendChild(item);
                // Auto-scroll for new messages only if not prepending and near the bottom
                // Add a small tolerance (e.g., 100 pixels) to scrollTo bottom check
                 const isScrolledToBottom = messagesList.scrollHeight - messagesList.clientHeight <= messagesList.scrollTop + 100;
                 if (!prepend && isScrolledToBottom) {
                     requestAnimationFrame(() => {
                         messagesList.scrollTop = messagesList.scrollHeight;
                     });
                 }
            }
        } else if (type === 'system' || type === 'system-error' || type === 'pm-notification') {
            // Always display system messages
            const time = messageData.timestamp ? new Date(messageData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const timestampSpan = time ? `<span class="timestamp">${time}</span>` : '';
            item.innerHTML = `<span class="system-text">${escapeHtml(messageData.text)}</span>${timestampSpan}`;
            item.classList.add('system-message');
            if (type === 'system-error') item.style.color = 'var(--error-color)';
            if (type === 'pm-notification') item.classList.add('pm-notification-message');
        } else {
            console.warn("displayMessage called with unhandled type:", type, messageData);
            return; // Don't append if type is not handled
        }
         // Scroll to bottom for new messages (only if not prepending)
        // Moved scroll logic into the 'chat' type handling for more control
        // if (!prepend) {
        //      requestAnimationFrame(() => messagesList.scrollTo({ top: messagesList.scrollHeight, behavior: 'smooth' }));
        // }
    }

    function updateUserListUI(users) {
        if (!userListUL) return;
        userListUL.innerHTML = '';

        if (users && users.length > 0) {
            users.forEach(user => {
                if (user.username) {
                    const li = document.createElement('li');
                    li.dataset.userId = user.id;
                    li.dataset.userUsername = user.username;
                    li.dataset.userCustomid = user.customId || '';
                    li.dataset.userProfilepic = user.profilePic || '';

                    const avatar = document.createElement('img');
                    avatar.classList.add('user-list-avatar');
                    avatar.src = user.profilePic ? user.profilePic : 'assets/default-avatar.png';
                    avatar.alt = `${user.username} avatar`;

                    const infoDiv = document.createElement('div');
                    infoDiv.classList.add('user-list-info');
                    const nameSpan = document.createElement('span');
                    nameSpan.classList.add('user-list-name');
                    nameSpan.textContent = escapeHtml(user.username);
                    const customIdSpan = document.createElement('span');
                    customIdSpan.classList.add('user-list-customid');
                    if (user.customId) customIdSpan.textContent = `ID: ${escapeHtml(user.customId)}`;
                    else if (user.id) customIdSpan.textContent = `ID: ${escapeHtml(user.id.substring(0, 10))}...`;

                    infoDiv.appendChild(nameSpan);
                    if (user.customId || user.id) infoDiv.appendChild(customIdSpan);
                    li.appendChild(avatar);
                    li.appendChild(infoDiv);

                    if (myUserData && user.id === myUserData.id) {
                        li.classList.add('my-user-in-list');
                        li.addEventListener('click', switchToGlobalChat);
                    } else {
                        li.classList.add('contactable');
                        li.addEventListener('click', () => startOrFocusPrivateChat(user));
                        // Gérer le badge de messages non lus
                        if (unreadMessagesCount[user.id] > 0) {
                            li.classList.add('has-unread-messages');
                            const badge = document.createElement('span');
                            badge.classList.add('unread-badge');
                            badge.textContent = unreadMessagesCount[user.id];
                            infoDiv.appendChild(badge); // Ajouter le badge à côté du nom ou ID
                        }
                    }
                    if (currentConversationUser && user.id === currentConversationUser.id) {
                        li.classList.add('active-private-chat-target');
                    }
                    userListUL.appendChild(li);
                }
            });
        } else {
            const li = document.createElement('li');
            li.textContent = "No other Saiyans online.";
            li.style.fontStyle = "italic"; li.style.cursor = "default"; li.style.color = "var(--timestamp-color)";
            userListUL.appendChild(li);
        }
    }

    function updateMyProfileUI() {
        if (myUserData && myProfileArea) {
            if (myProfilePicElem) myProfilePicElem.src = myUserData.profilePic ? myUserData.profilePic : 'assets/default-avatar.png';
            if (myUsernameDisplayElem) myUsernameDisplayElem.textContent = escapeHtml(myUserData.username);
            if (myCustomIdDisplayElem) {
                const displayId = myUserData.customId || (myUserData.id ? myUserData.id.substring(0, 10) + '...' : 'N/A');
                myCustomIdDisplayElem.textContent = `Saiyan ID: ${escapeHtml(displayId)}`;
            }
            myProfileArea.style.display = 'flex';
        } else if (myProfileArea) {
            myProfileArea.style.display = 'none';
        }
    }

    function showLoginView() {
        if (authContainer) authContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        if (registerView) registerView.style.display = 'none';
        if (loginView) loginView.style.display = 'block';
        if (loginErrorP) loginErrorP.textContent = '';
        if (registerErrorP) registerErrorP.textContent = '';
        if (registerSuccessP) registerSuccessP.textContent = '';
        if (loginUsernameInput) loginUsernameInput.focus();
    }

    function showRegisterView() {
        if (authContainer) authContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        if (loginView) loginView.style.display = 'none';
        if (registerView) registerView.style.display = 'block';
        if (loginErrorP) loginErrorP.textContent = '';
        if (registerErrorP) registerErrorP.textContent = '';
        if (registerSuccessP) registerSuccessP.textContent = '';
        if (registerUsernameInput) registerUsernameInput.focus();
    }

    function showChatView(userData) {
        myUserData = userData;
        if (authContainer) authContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
        updateMyProfileUI();
        if (messageInput) messageInput.focus();
        connectSocket();
        initializeChatBackground();
        loadConversationsSidebar();
        // No longer auto-loading global chat messages here
    }

    const themes = ['light-mode', 'dark-mode', 'saiyan-mode'];
    const themeIcons = { 'light-mode': '🌙', 'dark-mode': '💥', 'saiyan-mode': '☀️' };
    const themeLabels = { 'light-mode': 'Dark', 'dark-mode': 'Saiyan', 'saiyan-mode': 'Light' };
    let currentThemeIndex = 0;

    function applyTheme(themeName) {
        if (!themes.includes(themeName)) themeName = themes[0];
        currentThemeIndex = themes.indexOf(themeName);
        themes.forEach(t => bodyElement.classList.remove(t));
        bodyElement.classList.add(themeName);
        if (themeToggleButton) {
            themeToggleButton.textContent = themeIcons[themeName];
            themeToggleButton.setAttribute('aria-label', `Switch to ${themeLabels[themeName]} mode`);
        }
        localStorage.setItem('chatTheme', themeName);
        console.log(`UI Theme: ${themeName}`);
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem('chatTheme');
        let initialTheme = 'saiyan-mode';
        if (bodyElement.classList.contains('light-mode')) initialTheme = 'light-mode';
        else if (bodyElement.classList.contains('dark-mode')) initialTheme = 'dark-mode';
        if (savedTheme && themes.includes(savedTheme)) initialTheme = savedTheme;
        applyTheme(initialTheme);
    }

    const backgroundClasses = ['bg-default', 'bg-bg1', 'bg-bg2', 'bg-bg3', 'bg-bg4', 'bg-bg5', 'bg-bg6'];

    function applyChatBackground(bgName) {
        if (!chatWrapper) return;
        backgroundClasses.forEach(cls => chatWrapper.classList.remove(cls));
        const targetClass = bgName === "default" ? 'bg-default' : `bg-${bgName}`;
        if (backgroundClasses.includes(targetClass)) {
            chatWrapper.classList.add(targetClass);
            localStorage.setItem('chatBackground', bgName);
            console.log(`Chat BG: ${bgName}`);
            if (bgChoiceButtons) bgChoiceButtons.forEach(btn => btn.classList.toggle('active-bg', btn.dataset.bg === bgName));
        }
    }

    function initializeChatBackground() {
        const savedBg = localStorage.getItem('chatBackground');
        applyChatBackground(savedBg || 'default');
    }

    initializeTheme();

    if (themeToggleButton) themeToggleButton.addEventListener('click', () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        applyTheme(themes[currentThemeIndex]);
    });
    if (bgChoiceButtons) bgChoiceButtons.forEach(button => button.addEventListener('click', () => applyChatBackground(button.dataset.bg)));

    if (myProfileArea) myProfileArea.addEventListener('click', () => {
        if (!myUserData || !editProfileModal) return;
        if (currentProfilePicPreview) currentProfilePicPreview.src = myUserData.profilePic ? myUserData.profilePic : 'assets/default-avatar.png';
        if (editProfileIdDisplaySpan) editProfileIdDisplaySpan.textContent = escapeHtml(myUserData.customId || (myUserData.id ? myUserData.id.substring(0, 10) + '...' : 'N/A'));
        if (editProfileErrorP) editProfileErrorP.textContent = '';
        if (editProfileSuccessP) editProfileSuccessP.textContent = '';
        if (editProfilePicInput) editProfilePicInput.value = '';
        editProfileModal.style.display = 'block';
    });
    if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', () => { if (editProfileModal) editProfileModal.style.display = 'none'; });
    if (editProfileModal) window.addEventListener('click', (event) => { if (event.target === editProfileModal) editProfileModal.style.display = 'none'; });

    if (editProfileForm) editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (editProfileErrorP) editProfileErrorP.textContent = '';
        if (editProfileSuccessP) editProfileSuccessP.textContent = '';
        const newPicFile = editProfilePicInput.files[0];
        if (!newPicFile) { if (editProfileErrorP) editProfileErrorP.textContent = "Please select a new profile picture."; return; }
        const formData = new FormData();
        formData.append('newProfilePic', newPicFile);
        try {
            const response = await fetch('/api/update-profile-pic', { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok) {
                if (editProfileSuccessP) editProfileSuccessP.textContent = data.message;
                if (myUserData) myUserData.profilePic = data.newProfilePicPath;
                updateMyProfileUI();
                setTimeout(() => { if (editProfileModal) editProfileModal.style.display = 'none'; if (editProfileSuccessP) editProfileSuccessP.textContent = ''; }, 2000);
            } else { if (editProfileErrorP) editProfileErrorP.textContent = data.message || "Failed to update profile picture."; }
        } catch (err) { console.error("Update profile pic error:", err); if (editProfileErrorP) editProfileErrorP.textContent = "Network error or server issue."; }
    });

    if (showRegisterBtn) showRegisterBtn.addEventListener('click', showRegisterView);
    if (showLoginBtn) showLoginBtn.addEventListener('click', showLoginView);

    if (registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (registerErrorP) registerErrorP.textContent = '';
        if (registerSuccessP) registerSuccessP.textContent = '';
        const username = registerUsernameInput.value.trim();
        const password = registerPasswordInput.value;
        const customId = registerCustomIdInput.value.trim();
        const profilePicInput = document.getElementById('register-profile-pic');
        const file = profilePicInput && profilePicInput.files.length > 0 ? profilePicInput.files[0] : null;
        let response, data;
        try {
            if (file) {
                const formData = new FormData();
                formData.append('username', username);
                formData.append('password', password);
                formData.append('customId', customId);
                formData.append('profilePic', file);
                response = await fetch('/api/register', { method: 'POST', body: formData });
            } else {
                response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, customId })
                });
            }
            data = await response.json();
            if (response.ok) {
                if (registerSuccessP) registerSuccessP.textContent = data.message;
                registerForm.reset();
                setTimeout(showLoginView, 2500);
            } else {
                if (registerErrorP) registerErrorP.textContent = data.message || 'Registration failed.';
            }
        } catch (err) {
            console.error("Register fetch error:", err);
            if (registerErrorP) registerErrorP.textContent = 'Network error during registration. Is server running?';
        }
    });

    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loginErrorP) loginErrorP.textContent = '';
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value;

        if (!username || !password) {
            if (loginErrorP) loginErrorP.textContent = 'Please enter both username and password.';
            return;
        }

        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        const attemptLogin = async () => {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (!response.ok) {
            const data = await response.json();
                    throw new Error(data.message || 'Login failed');
                }

                const data = await response.json();
                loginForm.reset();
                showChatView(data.user);
            } catch (err) {
                console.error("Login attempt failed:", err);
                if (retryCount < maxRetries) {
                    retryCount++;
                    if (loginErrorP) loginErrorP.textContent = `Login attempt ${retryCount} failed. Retrying...`;
                    setTimeout(attemptLogin, retryDelay);
                } else {
                    if (loginErrorP) loginErrorP.textContent = 'Login failed after multiple attempts. Please try again later.';
                }
            }
        };

        attemptLogin();
    });

    if (logoutButton) logoutButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                if (socket) socket.disconnect();
                myUserData = null;
                currentConversationUser = null;
                currentChat = null;
                if (messagesList) messagesList.innerHTML = '';
                if (conversationsList) conversationsList.innerHTML = '';
                showLoginView();
            } else {
                alert(data.message || 'Logout failed.');
            }
        } catch (err) {
            console.error('Logout fetch error:', err);
            alert('Network error on logout.');
        }
    });

    async function checkAuthentication() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            if (data.isAuthenticated) {
                showChatView(data.user);
            } else {
                showLoginView();
            }
        } catch (error) { console.error("Auth check error:", error); if (loginErrorP) loginErrorP.textContent = "Can't reach server for auth check."; showLoginView(); }
    }
    checkAuthentication();

    function startOrFocusPrivateChat(targetUser) {
        currentConversationUser = targetUser;
        highlightActiveConversation(targetUser.id);
        startChat(targetUser);
        if (currentChatTargetDisplay) {
            currentChatTargetDisplay.innerHTML = `
                <img src="${targetUser.profilePic ? targetUser.profilePic : 'assets/default-avatar.png'}" class="chat-target-avatar" alt="">
                <span>${escapeHtml(targetUser.username)}</span>
            `;
        }
        if (messageInput) { messageInput.placeholder = `Message to ${escapeHtml(targetUser.username)}...`; messageInput.focus(); }
    }

    function highlightActiveConversation(userId) {
        const convList = document.getElementById('conversations-list');
        Array.from(convList.children).forEach(li => {
            li.classList.toggle('active', li.dataset.userid === userId);
        });
    }

    function connectSocket() {
        if (socket && socket.connected) {
            console.log("Socket already connected.");
            if (myUserData && socket.id) {
                 socket.emit('register-user', myUserData); // Optional: re-register user with server if needed
                 console.log("Re-registering user with socket.");
            }
            return;
        }

        console.log("Attempting to connect Socket.IO...");
        socket = io('http://localhost:3001'); // Explicitly connect to port 3001

        // --- Socket Event Listeners (Moved inside connectSocket) ---
        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            if (messageErrorP) messageErrorP.textContent = ''; // Clear message error on connect
            if (myUserData) { // Send user info to server upon successful connection
                socket.emit('user online', myUserData.id);
                console.log("Emitting 'user online' for user:", myUserData.id);
            } else {
                 console.warn("Socket connected but myUserData is null. Cannot emit 'user online'.");
            }
            // Load conversations sidebar after connecting and confirming user data
            loadConversationsSidebar(); // Ensure conversations are loaded after connect
        });

        socket.on('disconnect', (reason) => {
            console.warn('⚠️ Socket disconnected:', reason);
            displayMessage({ text: `Disconnected: ${reason}.`, timestamp: new Date().toISOString() }, 'system-error');
             if (userListUL) userListUL.innerHTML = ''; // Simple clear of user list
             console.log("Cleared user list on disconnect.");
        });

        socket.on('connect_error', (err) => {
            console.error('🚨 Socket connect_error:', err.message, err);
            displayMessage({ text: `Connection Error: ${err.message}. Is server running?`, timestamp: new Date().toISOString() }, 'system-error');
        });

        // Handle global chat messages
        socket.on('chat message', (msgData) => {
            console.log('[CLIENT] Received global chat message:', msgData);
             if (!currentChat) { // Only display in main chat if no private chat is active
                 displayMessage({
                     sender: msgData.id,
                     username: msgData.username,
                     content: msgData.text,
                     timestamp: msgData.timestamp,
                     isPrivate: false,
                     fileAttachment: msgData.fileAttachment,
                     senderProfile: msgData.senderProfile
                 }, 'chat');
             } else {
                 console.log('[CLIENT] Received global message while in a private chat, ignoring for now.', msgData);
             }
        });

        // Handle private messages received from others
        socket.on('private message received', (pmData) => {
            console.log('%c[CLIENT] Private message received:', 'color: dodgerblue; font-weight: bold;', pmData);
            // Display message if it's for the current active chat
            // Check if the received message is from the current conversation partner
            if (currentConversationUser && pmData.sender === currentConversationUser.id) {
                displayMessage({
                    _id: pmData._id,
                    sender: pmData.sender,
                    recipient: pmData.recipient,
                    content: pmData.content,
                    timestamp: pmData.timestamp,
                    audioFile: pmData.audioFile,
                    fileAttachment: pmData.fileAttachment,
                    isRead: pmData.isRead,
                    isPrivate: true,
                    senderProfile: pmData.senderProfile || {
                        id: pmData.sender,
                        username: 'Unknown User',
                        profilePic: 'assets/default-avatar.png'
                    }
                }, 'chat', false);
            } else if (myUserData && pmData.sender !== myUserData.id) {
                console.log('[CLIENT] Received private message for another chat.', pmData);
                loadConversationsSidebar();
            }
        });

        // Handle confirmation of messages sent by me
        socket.on('message confirmed', (messageData) => {
            console.log('%c[CLIENT] Message confirmed:', 'color: green; font-weight: bold;', messageData);
            if (currentConversationUser && messageData.recipient === currentConversationUser.id) {
                displayMessage({
                    _id: messageData._id,
                    sender: messageData.sender,
                    recipient: messageData.recipient,
                    content: messageData.content,
                    timestamp: messageData.timestamp,
                    audioFile: messageData.audioFile,
                    fileAttachment: messageData.fileAttachment,
                    isRead: messageData.isRead,
                    isPrivate: true,
                    senderProfile: myUserData
                }, 'chat', false);
            } else {
                console.log('[CLIENT] Message confirmed for another chat or not the current one, ignoring.', messageData);
            }
        });

        // Handle user search results
        socket.on('user found', (user) => {
            console.log('[Client][Search] User found:', user);
            if (contactIdErrorP) contactIdErrorP.textContent = '';
            if (contactIdSuccessP) contactIdSuccessP.textContent = `Found user: ${escapeHtml(user.username)}`;
            if (contactIdInput) contactIdInput.value = '';

            if (user && user.id) {
                // 1. Ajouter ou mettre à jour l'utilisateur dans la barre latérale des conversations (conversationsList)
                let userLi = conversationsList.querySelector(`li[data-userid="${user.id}"]`);
                if (!userLi && conversationsList) { // Si l'utilisateur n'est pas déjà dans la liste
                    userLi = document.createElement('li');
                    userLi.innerHTML = `
                <div class="conversation" data-user-id="${user.id}">
                    <img src="${user.profilePic || 'assets/default-avatar.png'}" class="avatar-circle" alt="${escapeHtml(user.username)}'s avatar">
                    <div class="conversation-info">
                        <span class="username">${escapeHtml(user.username)}</span>
                        <span class="custom-id">ID: ${escapeHtml(user.customId || user.id.substring(0, 6) + '...')}</span>
                    </div>
                </div>
            `;
                    userLi.classList.add('sidebar-conversation');
                    userLi.dataset.userid = user.id;
                    // Stocker les informations complètes de l'utilisateur pour startChat
                    const fullUserObject = {
                        id: user.id,
                        username: user.username,
                        customId: user.customId,
                        profilePic: user.profilePic
                    };
                    userLi.onclick = () => startChat(fullUserObject); // Passer l'objet utilisateur complet

                    // Pour s'assurer que ces attributs sont aussi là si on y accède autrement
                    userLi.dataset.userUsername = user.username;
                    userLi.dataset.userCustomid = user.customId || '';
                    userLi.dataset.userProfilepic = user.profilePic || '';

                    conversationsList.prepend(userLi); // Ajouter en haut de la liste
                    console.log('[Client][Search] Added newly found user to sidebar.');
                }

                // 2. Démarrer le chat avec cet utilisateur
                // S'assurer que startChat reçoit toutes les informations nécessaires
                startChat({
                    id: user.id,
                    username: user.username,
                    customId: user.customId,
                    profilePic: user.profilePic
                });
                console.log('[Client][Search] Called startChat with found user.');

                // ATTENTION: Décommentez loadConversationsSidebar() seulement si vous êtes sûr
                // qu'il ne supprime pas l'utilisateur nouvellement ajouté s'il n'a pas d'historique.
                // Pour l'instant, il vaut mieux le laisser commenté après une recherche fructueuse
                // pour garantir que l'utilisateur reste visible.
                // loadConversationsSidebar();

            } else {
                console.warn('[Client][Search] User found data incomplete, cannot start chat.', user);
                if (contactIdErrorP) contactIdErrorP.textContent = 'Found user data incomplete.';
            }
        });

// Assurez-vous que la fonction startChat gère bien un objet utilisateur complet
        function startChat(user) {
            console.log("startChat called with user:", user);
            if (!user || !user.id || !user.username) {
                console.error("startChat called with invalid user object:", user);
                if (messageErrorP) messageErrorP.textContent = 'Cannot start chat: user data is invalid.';
                // Optionnel : réinitialiser l'interface à un état par défaut ou global chat
                // switchToGlobalChat(); // Si vous avez une telle fonction
                return;
            }
            currentChat = user;
            currentConversationUser = user;

            // Mettre à jour l'interface utilisateur pour le chat actuel
            if (currentChatTargetDisplay) {
                currentChatTargetDisplay.innerHTML = `
            <img src="${user.profilePic ? user.profilePic : 'assets/default-avatar.png'}" class="chat-target-avatar" alt="${escapeHtml(user.username)}'s avatar">
            <span>${escapeHtml(user.username)}</span>
        `;
            }
            if (messageInput) {
                messageInput.placeholder = `Message to ${escapeHtml(user.username)}...`;
                messageInput.focus();
            }

            // Effacer les messages existants
            clearChatArea();

            // Réinitialiser les indicateurs de pagination
            allMessagesLoaded = false;
            loadingOlderMessages = false;

            // Charger l'historique du chat
            console.log(`Loading chat history for user: ${user.id}`);
            // L'URL pour l'historique des messages doit utiliser l'ID de l'utilisateur
            // et non currentConversationUser.id qui pourrait être obsolète ou null.
            const historyUrl = `/api/messages?with=${encodeURIComponent(user.id)}`;
            fetch(historyUrl) // Correction ici pour utiliser user.id
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(messages => {
                    console.log(`Loaded ${messages.length} messages for chat with ${user.username}:`, messages);

                    if (messagesList) { // Vérifier si messagesList existe
                        if (messages.length === 0) {
                            messagesList.innerHTML = '<li class="system-message">No messages yet. Start the conversation!</li>';
                        } else {
                            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                            messages.forEach(msg => {
                                const messageData = {
                                    _id: msg._id,
                                    sender: msg.sender,
                                    recipient: msg.recipient,
                                    content: msg.content,
                                    timestamp: msg.timestamp,
                                    audioFile: msg.audioFile,
                                    fileAttachment: msg.fileAttachment,
                                    isRead: msg.isRead,
                                    isPrivate: !!msg.recipient,
                                    senderProfile: msg.senderProfile || { /* fallback */ }
                                };
                                displayMessage(messageData, 'chat', false); // Afficher les messages normalement (pas prepend pour l'historique initial)
                            });
                            // Faire défiler vers le bas après le chargement des messages initiaux
                            requestAnimationFrame(() => {
                                if (messagesList) messagesList.scrollTop = messagesList.scrollHeight;
                            });
                        }
                    } else {
                        console.error("messagesList element not found when trying to display history.");
                    }
                })
                .catch(error => {
                    console.error(`Error loading chat history for ${user.username}:`, error);
                    if (messagesList) {
                        messagesList.innerHTML = `<li class="system-message" style="color: var(--error-color);">Error loading messages: ${error.message}</li>`;
                    }
                });

            // Surligner la conversation sélectionnée dans la barre latérale
            highlightActiveConversation(user.id);
        }

        socket.on('user not found', () => {
            console.log('[Client][Search] User not found');
            // Clear previous messages
            if (contactIdSuccessP) contactIdSuccessP.textContent = '';
            if (contactIdErrorP) contactIdErrorP.textContent = "User not found. Check the ID and try again.";
            if (contactIdInput) contactIdInput.value = '';
        });

        // Handle system messages
        socket.on('system message', (msgData) => {
            console.log('[CLIENT] Received system message:', msgData);
            displayMessage(msgData, 'system');
        });

        // Handle user list updates
        socket.on('update user list', (users) => {
            console.log('[CLIENT] Updated user list:', users);
            updateUserListUI(users); // Update the list of online users
        });

        // Handle typing indicator from other users
        socket.on('user typing', ({ from }) => {
            console.log(`${from} is typing...`);
            // TODO: Implement UI to show who is typing
        });

        // Handle chat history received via socket (might be redundant if using HTTP fetch)
         socket.on('get chat history', (data) => {
              console.log('[CLIENT] Received chat history via socket (might be redundant):', data);
             // Example basic handling:
             // if (messagesList) messagesList.innerHTML = ''; // Clear current messages
             // data.messages.forEach(msg => displayMessage(msg, 'chat')); // Display received messages
         });

         // Handle socket disconnection
         socket.on('disconnect', (reason) => {
             console.log('Socket disconnected:', reason);
             displayMessage({ text: `Disconnected from server: ${reason}`, timestamp: new Date().toISOString() }, 'system-error');
              // TODO: Implement UI updates for disconnected state (e.g., grey out user list)
         });

        socket.on('error', (data) => {
            console.error('🚨 Socket error event:', data);
            showError('message-error', `Socket Error: ${data.message || 'Unknown error'}`);
        });
    }

    if (contactIdForm) contactIdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!socket || !socket.connected || !myUserData) {
            if (contactIdErrorP) contactIdErrorP.textContent = "Log in first.";
            return;
        }
        const targetCustomId = contactIdInput.value.trim();
        if (!targetCustomId) {
            if (contactIdErrorP) contactIdErrorP.textContent = "Enter Saiyan ID.";
            return;
        }
        if (contactIdErrorP) contactIdErrorP.textContent = '';
        if (contactIdSuccessP) contactIdSuccessP.textContent = `Finding ${escapeHtml(targetCustomId)}...`;
        console.log(`[Client][Search] Searching for user with ID: ${targetCustomId}`);
        socket.emit('search user', targetCustomId);
    });

    if (messageForm) messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!socket || !socket.connected || !myUserData) {
            if (messageErrorP) messageErrorP.textContent = 'Not connected.';
            return;
        }
        const messageText = messageInput.value.trim();
            if (!messageText) return;
        if (currentChat) {
            socket.emit('private message', { recipientId: currentChat.id, message: messageText });
            messageInput.value = '';
        } else {
            if (messageErrorP) messageErrorP.textContent = 'Select a chat first.';
        }
        messageInput.focus();
    });

    if (fileInput) fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!socket || !socket.connected || !myUserData) { alert("Not connected/logged in to upload."); fileInput.value = ''; return; }
        if (file.size > 10 * 1024 * 1024) { alert("File too large (max 10MB)."); fileInput.value = ''; return; }

        const formData = new FormData();
        formData.append('chatFile', file);

        // Add recipientId if in a private chat
        if (currentConversationUser) {
            formData.append('recipientId', currentConversationUser.id);
        }

        if (fileUploadProgress) { fileUploadProgress.textContent = 'Uploading...'; fileUploadProgress.style.display = 'block'; }
        if (messageErrorP) messageErrorP.textContent = '';
        try {
            const response = await fetch('/api/messages/upload', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) { if (messageErrorP) messageErrorP.textContent = data.message || 'File upload failed on server.'; }
        } catch (err) { console.error('File upload fetch error:', err); if (messageErrorP) messageErrorP.textContent = 'Network error on file upload.';
        } finally { if (fileUploadProgress) fileUploadProgress.style.display = 'none'; fileInput.value = ''; }
    });

    // Client: emit when typing
    messageInput.addEventListener('input', () => {
        if (currentConversationUser) {
            socket.emit('typing', { to: currentConversationUser.id });
        }
    });

    messagesList.addEventListener('scroll', async () => {
        if (messagesList.scrollTop === 0 && !loadingOlderMessages && !allMessagesLoaded && currentConversationUser) {
            loadingOlderMessages = true;
            const firstMsgElem = messagesList.querySelector('.message-item');
            if (!firstMsgElem || !firstMsgElem.dataset.timestamp) {
                loadingOlderMessages = false;
                return;
            }
            const before = firstMsgElem.dataset.timestamp;
            const res = await fetch(`/api/messages?with=${encodeURIComponent(currentConversationUser.id)}&before=${encodeURIComponent(before)}`);
            const olderMessages = await res.json();
            if (olderMessages.length > 0) {
                const prevHeight = messagesList.scrollHeight;
                olderMessages.forEach(msg => {
                    const messageData = {
                        _id: msg._id,
                        sender: msg.sender,
                        recipient: msg.recipient,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        audioFile: msg.audioFile,
                        fileAttachment: msg.fileAttachment,
                        isRead: msg.isRead,
                        isPrivate: !!msg.recipient,
                        senderProfile: msg.senderProfile || {
                            id: msg.sender,
                            username: 'Unknown User',
                            profilePic: 'assets/default-avatar.png'
                        }
                    };
                    console.log("Displaying history message:", messageData);
                    displayMessage(messageData, 'chat', true);
                });
                requestAnimationFrame(() => {
                    messagesList.scrollTop = messagesList.scrollHeight - prevHeight;
                });
            } else {
                allMessagesLoaded = true;
            }
            loadingOlderMessages = false;
        }
    });

    function loadInitialMessages() {
        allMessagesLoaded = false;
        fetch('/api/messages')
          .then(res => res.json())
          .then(messages => {
            messagesList.innerHTML = '';
            messages.forEach(msg => {
              displayMessage({
                id: msg.sender,
                username: msg.username || '',
                text: msg.content,
                timestamp: msg.timestamp,
                isPrivate: msg.receiver !== null,
                senderProfile: msg.senderProfile,
                fileAttachment: msg.fileAttachment
              }, 'chat');
            });
          });
    }

    async function loadConversationsSidebar() {
        console.log("Loading conversations sidebar...");
        try {
            const res = await fetch('/api/conversations');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const conversations = await res.json();
            console.log("Loaded conversations:", conversations);
            renderConversationsSidebar(conversations);
        } catch (error) {
            console.error("Error loading conversations:", error);
            if (conversationsList) {
                conversationsList.innerHTML = `<li class="system-message" style="color: var(--error-color);">Error loading conversations</li>`;
            }
        }
    }

    function renderConversationsSidebar(conversations) {
        console.log("Rendering conversations sidebar with:", conversations);
        const convList = document.getElementById('conversations-list');
        if (!convList) { console.error("Conversations list element not found."); return; }
        convList.innerHTML = '';
        if (!conversations || conversations.length === 0) {
            const li = document.createElement('li');
            li.textContent = "No conversations yet.";
            li.style.fontStyle = "italic"; li.style.color = "var(--timestamp-color)";
            convList.appendChild(li);
            // Also, if no conversations, ensure chat area is clear and indicates no chat selected
            if (currentChatTargetDisplay) currentChatTargetDisplay.innerHTML = '<span>Select a chat</span>';
            if (messagesList) messagesList.innerHTML = ''; // Clear messages
            currentChat = null; currentConversationUser = null; // Reset state
            return;
        }

        // Sort conversations by last message timestamp (already sorted by server, but good to be explicit)
        conversations.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

        conversations.forEach(user => {
            // Add a check to ensure user object is valid before rendering
            if (!user || !user.id || !user.username) {
                 console.warn("Skipping rendering of invalid conversation user data:", user);
                 return; // Skip this user if data is incomplete
            }
            const li = document.createElement('li');
            // Use user.profilePic for the avatar in the sidebar list
            li.innerHTML = `
                <div class="conversation" data-user-id="${user.id}">
                    <img src="${user.profilePic ? user.profilePic : 'assets/default-avatar.png'}" class="avatar-circle" alt="${escapeHtml(user.username)}'s avatar">
                    <div class="conversation-info">
                        <span class="username">${escapeHtml(user.username)}</span>
                        <span class="custom-id">ID: ${escapeHtml(user.customId || user.id.substring(0, 6) + '...')}</span> <!-- Use ID snippet if customId missing -->
                    </div>
                </div>
            `;
            li.classList.add('sidebar-conversation');
            li.dataset.userid = user.id;

            const userObjectForChat = { ...user };
            li.onclick = () => startChat(userObjectForChat); // Use startChat

            // Add data attributes for user info
            li.dataset.userUsername = user.username;
            li.dataset.userCustomid = user.customId || '';
            li.dataset.userProfilepic = user.profilePic || '';

            convList.appendChild(li);
        });

        // Automatically start chat with the first conversation (most recent)
        if (conversations.length > 0) {
            const firstConversationUser = conversations[0];
            // Check if we are not already in this chat to avoid redundant loading
            if (!currentConversationUser || currentConversationUser.id !== firstConversationUser.id) {
                 console.log("Auto-starting chat with first conversation:", firstConversationUser.username);
                 startChat(firstConversationUser);
            } else { // If already in this chat, just re-highlight
                 highlightActiveConversation(currentConversationUser.id);
                 console.log("Already in the most recent conversation, just highlighting.");
            }
        }
    }

    // Initialize the application
    async function init() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();

            if (data.isAuthenticated) {
                myUserData = data.user;
                showApp();
                connectSocket();
            } else {
                showAuth();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            showAuth();
        }
    }

    // Event Listeners
    showRegisterBtn.addEventListener('click', () => {
        loginView.style.display = 'none';
        registerView.style.display = 'block';
    });

    showLoginBtn.addEventListener('click', () => {
        registerView.style.display = 'none';
        loginView.style.display = 'block';
    });

    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    contactIdForm.addEventListener('submit', handleUserSearch);
    messageForm.addEventListener('submit', handleMessageSend);

    // Form Handlers
    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                myUserData = data.user;
                showApp();
                connectSocket();
            } else {
                showError('login-error', data.message);
            }
        } catch (error) {
            showError('login-error', 'Login failed. Please try again.');
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const customId = document.getElementById('register-custom-id').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, customId })
            });
            const data = await response.json();

            if (response.ok) {
                showSuccess('register-success', data.message);
                setTimeout(() => {
                    registerView.style.display = 'none';
                    loginView.style.display = 'block';
                }, 2000);
            } else {
                showError('register-error', data.message);
            }
        } catch (error) {
            showError('register-error', 'Registration failed. Please try again.');
        }
    }

    async function handleUserSearch(e) {
        e.preventDefault();
        const customId = document.getElementById('contact-id-input').value;
        socket.emit('search user', customId);
    }

    async function handleMessageSend(e) {
        e.preventDefault();
        if (!currentChat) return;

        const message = messageInput.value.trim();
        if (!message) return;

        socket.emit('private message', {
            recipientId: currentChat.id,
            message: message
        });

        messageInput.value = '';
    }

    // UI Helpers
    function showApp() {
        authContainer.style.display = 'none';
        appContainer.style.display = 'flex';
    }

    function showAuth() {
        appContainer.style.display = 'none';
        authContainer.style.display = 'flex';
    }

    function showError(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 5000);
    }

    function showSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 5000);
    }

    function appendMessage(sender, message, timestamp) {
        const li = document.createElement('li');
        li.className = sender.id === myUserData.id ? 'message sent' : 'message received';

        const time = new Date(timestamp).toLocaleTimeString();
        li.innerHTML = `
            <div class="message-header">
                <span class="username">${sender.username}</span>
                <span class="time">${time}</span>
            </div>
            <div class="message-content">${message}</div>
        `;

        messagesList.appendChild(li);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    async function loadConversations() {
        try {
            const response = await fetch('/api/conversations');
            const conversations = await response.json();

            conversationsList.innerHTML = '';
            conversations.forEach(conv => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="conversation" data-user-id="${conv.id}">
                        <span class="username">${conv.username}</span>
                        <span class="custom-id">${conv.customId}</span>
                    </div>
                `;
                li.addEventListener('click', () => startChat(conv));
                conversationsList.appendChild(li);
            });
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }

    function startChat(user) {
        console.log("startChat called with user:", user);
        currentChat = user;
        currentConversationUser = user;

        // Update UI for current chat
        if (currentChatTargetDisplay) {
            currentChatTargetDisplay.innerHTML = `
                <img src="${user.profilePic ? user.profilePic : 'assets/default-avatar.png'}" class="chat-target-avatar" alt="${escapeHtml(user.username)}'s avatar">
                <span>${escapeHtml(user.username)}</span>
            `;
        }
        if (messageInput) {
            messageInput.placeholder = `Message to ${escapeHtml(user.username)}...`;
            messageInput.focus();
        }

        // Clear existing messages
        clearChatArea();

        // Reset pagination flags
        allMessagesLoaded = false;
        loadingOlderMessages = false;

        // Load chat history
        console.log(`Loading chat history for user: ${user.id}`);
        fetch(`/api/messages?with=${encodeURIComponent(user.id)}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(messages => {
                console.log(`Loaded ${messages.length} messages for chat with ${user.username}:`, messages);

                if (messages.length === 0) {
                    messagesList.innerHTML = '<li class="system-message">No messages yet. Start the conversation!</li>';
                    return;
                }

                // Display each message, prepending for history
                 // Sort messages by timestamp in ascending order before displaying for history
                 messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                messages.forEach(msg => {
                    const messageData = {
                        _id: msg._id,
                        sender: msg.sender,
                        recipient: msg.recipient,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        audioFile: msg.audioFile,
                        fileAttachment: msg.fileAttachment,
                        isRead: msg.isRead,
                        isPrivate: !!msg.recipient,
                        senderProfile: msg.senderProfile || {
                            id: msg.sender,
                            username: 'Unknown User',
                            profilePic: 'assets/default-avatar.png'
                        }
                    };
                    console.log("Displaying history message:", messageData);
                    displayMessage(messageData, 'chat', true);
                });

                // Scroll to bottom after loading initial messages
                requestAnimationFrame(() => {
                    messagesList.scrollTop = messagesList.scrollHeight;
                });
            })
            .catch(error => {
                console.error(`Error loading chat history:`, error);
                messagesList.innerHTML = `<li class="system-message" style="color: var(--error-color);">Error loading messages: ${error.message}</li>`;
            });

        // Highlight the selected conversation in the sidebar
        highlightActiveConversation(user.id);
    }

    // Add this function before the updateUserListUI function
    function switchToGlobalChat() {
        currentChat = null;
        currentConversationUser = null;
        if (currentChatTargetDisplay) {
            currentChatTargetDisplay.innerHTML = '<span>Global Chat</span>';
        }
        if (messageInput) {
            messageInput.placeholder = 'Message to everyone...';
            messageInput.focus();
        }
        if (messagesList) {
            clearChatArea(); // Clear messages
            loadInitialMessages(); // Load global messages
        }
        // Remove active class from all conversations
        const convList = document.getElementById('conversations-list');
        if (convList) {
            Array.from(convList.children).forEach(li => li.classList.remove('active'));
        }
    }

    // Add this to ensure conversations are loaded when the page loads
    window.addEventListener('load', () => {
        if (myUserData) {
            loadConversationsSidebar();
        }
    });

    // Initialize the application
    init();

    // Add audio recording functionality (Removed dynamic button creation and fixed listener)
    // Check if the audio button exists (should be added in index.html)
    if (recordButton) {
        console.log('[Client Init] Audio recording button found. Adding event listener.'); // Add log
        recordButton.addEventListener('mousedown', startRecording);
        recordButton.addEventListener('mouseup', stopRecording);
        recordButton.addEventListener('mouseleave', stopRecording);

        // For touch devices
        recordButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRecording();
        });
        recordButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopRecording();
        });
    } else {
        console.error('[Client Init] Audio recording button element not found.'); // Log if button element wasn't found by ID
    }

     // The original Transmit button is removed via HTML edit now, so this JS is not needed.
     // const transmitButton = messageForm.querySelector('button[type="submit"]');
     // if (transmitButton) {
     //     transmitButton.remove();
     //     console.log('[Client Init] Removed original Transmit button.');
     // } else {
     //     console.warn('[Client Init] Original Transmit button not found.');
     // }

    // Add event listener to send message on Enter key press in the textarea
    if (messageInput) {
        messageInput.addEventListener('keydown', (event) => {
            // Check if Enter key is pressed (key code 13) and Shift key is NOT pressed
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // Prevent newline from being added
                // Find the send button and trigger its click event
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.click();
                }
            }
        });
    }

    // Audio Recording Functions (Moved inside DOMContentLoaded)

    async function startRecording() {
        console.log('[Audio] startRecording function called');
        if (isRecording) {
            console.log('[Audio] Already recording, ignoring start request.');
            return;
        }
        try {
            console.log('[Audio] Requesting microphone access...');
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[Audio] Microphone access granted.', stream);

                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = async () => {
                        // Hide recording indicator and reset button immediately on stop
                        isRecording = false; // Reset state
                recordButton.classList.remove('recording');
                // Ensure the icon is the microphone after stopping
                recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
                        if (recordingIndicator) recordingIndicator.style.display = 'none'; // Hide indicator

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Force webm type for broader compatibility
                        const formData = new FormData();
                        const filename = `audio-${Date.now()}.webm`; // Simplified filename
                        formData.append('audioFile', audioBlob, filename);

                        // Ensure recipientId is included for private messages
                        if (currentConversationUser && currentConversationUser.id) {
                            formData.append('recipientId', currentConversationUser.id);
                        } else {
                            console.warn("Attempted to send audio without a recipient in a private chat context.");
                            if (messageErrorP) messageErrorP.textContent = 'Recipient not set for audio message.';
                            return;
                        }

                // Attempt to get duration (optional, might require a library or server-side processing)
                // For now, we'll send without duration or add a placeholder
                // formData.append('duration', /* calculated duration */);

                if (fileUploadProgress) { // Re-using the file upload progress indicator for audio
                            fileUploadProgress.textContent = 'Sending audio...';
                            fileUploadProgress.style.display = 'block';
                        }
                        if (messageErrorP) messageErrorP.textContent = '';

                        try {
                            const response = await fetch('/api/messages/audio', {
                                method: 'POST',
                                body: formData
                            });

                    if (response.ok) {
                            const data = await response.json();
                        console.log('[Audio Upload] Successful upload response:', data);
                        // Message display will be handled by the 'message confirmed' socket event.
                            } else {
                        const errorData = await response.json();
                        console.error('[Audio Upload] Server responded with error:', errorData);
                        if (messageErrorP) messageErrorP.textContent = errorData.message || 'Audio upload failed on server.';
                            }

                        } catch (error) {
                            console.error('Error uploading audio:', error);
                            if (messageErrorP) messageErrorP.textContent = 'Failed to send audio message: ' + error.message;
                        } finally {
                            if (fileUploadProgress) fileUploadProgress.style.display = 'none';
                    // Stop the microphone stream after recording and sending
                    stream.getTracks().forEach(track => track.stop());
                        }
                    };

                    mediaRecorder.onerror = (event) => {
                         console.error('MediaRecorder error:', event.error);
                         if (messageErrorP) messageErrorP.textContent = 'Recording error: ' + event.error.name;
                          // Clean up recording state on error
                         isRecording = false;
                recordButton.classList.remove('recording');
                recordButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Reset icon
                         if (recordingIndicator) recordingIndicator.style.display = 'none';
                // Stop the microphone stream on error
                stream.getTracks().forEach(track => track.stop());
                    };

                    mediaRecorder.start();
                    isRecording = true;
            recordButton.classList.add('recording');
            recordButton.innerHTML = '<i class="fas fa-stop"></i>'; // Change icon to stop

                    // Show recording indicator
                     if (recordingIndicator) recordingIndicator.style.display = 'block';

                } catch (error) {
                    console.error('Error accessing microphone:', error);
            if (messageErrorP) messageErrorP.textContent = 'Could not access microphone. Please allow microphone access in your browser settings.';
        }
    }

    function stopRecording() {
        console.log('[Audio] stopRecording function called');
        if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                // isRecording and UI updates are handled at the start of mediaRecorder.onstop
            // Stopping the stream is also handled in onstop or onerror
        } else {
            console.log('[Audio] stopRecording called but not currently recording.');
        }
    }

    async function sendAudioMessage(audioBlob) {
        console.log('[Audio] sendAudioMessage function called');
        if (!currentChat) {
            showError('message-error', 'No active chat selected');
            console.warn('[Audio] sendAudioMessage called with no active chat.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('audioFile', audioBlob, 'audio-message.webm');
            formData.append('recipientId', currentChat.id);

            // Optional: Add duration if captured/sent)
            // formData.append('duration', calculatedDuration);

            console.log('[Audio] Sending audio message to /api/messages/audio');
            const response = await fetch('/api/messages/audio', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send audio message');
            }

            const result = await response.json();
            console.log('[Audio] Audio message sent successfully:', result);
            // Message display will be handled by the 'message confirmed' socket event.

        } catch (error) {
            console.error('[Audio] Error sending audio message:', error);
            showError('message-error', 'Failed to send audio message: ' + error.message);
        }
    }

    // Helper function to format duration (optional, if duration is captured/sent)
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Function to clear chat area
    function clearChatArea() {
        if (messagesList) {
            messagesList.innerHTML = '';
            // Optionally reset scroll position, but auto-scroll for new messages is better
            // messagesList.scrollTop = 0;
        }
    }

}); // End DOMContentLoade