// Popup script for Noted Chrome Extension
class NotedPopup {
    constructor() {
        this.backendUrl = 'https://noted-six.vercel.app';
        this.userId = null;
        this.backendConnected = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadSettings();
        this.generateUserId();

                // Test backend connection first
        const backendConnected = await this.testBackendConnection();
        if (!backendConnected) {
            const statusElement = document.getElementById('status');
            const refreshBtn = document.getElementById('refreshStatus');
            const errorElement = document.getElementById('error');

            // Hide all status messages for cleaner UI
            statusElement.style.display = 'none';
            refreshBtn.style.display = 'none';
            errorElement.style.display = 'none';

            // Set internal state for updateUIState to work properly
            statusElement.className = 'status disconnected';

            // Clear any cached connection state when backend is down
            await chrome.storage.local.remove(['notionConnected', 'lastConnectionCheck']);

            // Clear OpenAI API key when backend is disconnected - user must re-authenticate everything
            await this.clearStoredSettings();

            await this.updateUIState();
            return;
        }

        // Initialize with disconnected state by default
        const statusElement = document.getElementById('status');
        statusElement.className = 'status disconnected';
        statusElement.setAttribute('data-was-connected', 'false');

        // Check if user was previously authenticated (session persistence)
        const storedUserId = await this.getStoredUserId();
        if (storedUserId && storedUserId.length > 20) {
            // User has a stored Notion user ID, attempt to verify it's still valid
            this.userId = storedUserId;

            // Check if this user is still connected in the backend
            const isStillConnected = await this.verifyStoredConnection();
            if (isStillConnected) {
                await this.showConnectedState();
                return; // Skip the rest of initialization since we're connected
            } else {
                await chrome.storage.sync.remove(['userId']);
                this.userId = null;
                this.generateUserId();

                // Clear OpenAI API key when stored connection is invalid - user must re-authenticate everything
                await this.clearStoredSettings();
            }
        }

        // Clear any stale background OAuth state for fresh authentication
        try {
            await chrome.runtime.sendMessage({ action: 'clearOAuthState' });
        } catch (error) {
            // No background script or OAuth state to clear
        }

        // Check for OAuth completion (both active and completed sessions)
        try {
            const oauthStatus = await chrome.runtime.sendMessage({ action: 'getOAuthStatus' });
            if (oauthStatus) {
                if (oauthStatus.isInProgress) {
                    // OAuth is still in progress, continue monitoring
                    this.startOAuthCompletionPolling();
                } else if (oauthStatus.completionData && oauthStatus.completionData.status === 'success') {
                    // OAuth was completed while popup was closed, process it now
                    await this.processCompletedOAuth(oauthStatus.completionData);
                }
            }
        } catch (error) {
            // No background script or OAuth status available
        }

        // Check if user needs to authenticate (secure approach)
        if (!this.userId || this.userId.length < 30) {
            // Force disconnected state - user must explicitly authenticate
            const statusElement = document.getElementById('status');
            statusElement.className = 'status disconnected';
            statusElement.setAttribute('data-was-connected', 'false');
            await this.updateUIState();
        }

        // Set up periodic status check
        this.setupStatusCheck();

                // Final UI state update to ensure everything is properly configured
        await this.updateUIState();

    }

    async testBackendConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/`);
            if (response.ok) {
                this.backendConnected = true;
                return true;
            } else {
                this.backendConnected = false;
                return false;
            }
        } catch (error) {
            this.backendConnected = false;
            return false;
        }
    }

    async checkAllConnections() {

                // Test backend connection first
        const backendConnected = await this.testBackendConnection();
        if (!backendConnected) {
            const statusElement = document.getElementById('status');
            const refreshBtn = document.getElementById('refreshStatus');
            const errorElement = document.getElementById('error');

            // Hide all status messages for cleaner UI
            statusElement.style.display = 'none';
            refreshBtn.style.display = 'none';
            errorElement.style.display = 'none';

            // Set internal state for updateUIState to work properly
            statusElement.className = 'status disconnected';

            // Clear any cached connection state when backend is down
            await chrome.storage.local.remove(['notionConnected', 'lastConnectionCheck']);

            // Clear OpenAI API key when backend is disconnected - user must re-authenticate everything
            await this.clearStoredSettings();

            await this.updateUIState();
            return;
        }

        // Check for existing Notion connection on startup
        // First, check if there's a recently completed OAuth (in case user ID changed)
        const detectedNewUser = await this.detectRealUser();
        if (!detectedNewUser) {
            // If no new user detected, check current user connection
            await this.checkNotionConnection();
        }

        // Check if there's a recent successful OAuth we missed
        await this.checkForMissedOAuth();
    }

    bindEvents() {
        // Event listeners
        const connectNotionBtn = document.getElementById('connectNotion');
        connectNotionBtn.addEventListener('click', () => {
            this.connectToNotion();
        });

        // Add double-click handler for force reconnect when stuck in connected state
        connectNotionBtn.addEventListener('dblclick', async () => {
            if (connectNotionBtn.classList.contains('connected')) {
                this.showMessage('Force reconnecting...', 'info');
                await this.forceDisconnectedState();
                this.showMessage('Disconnected! You can now reconnect to Notion.', 'success');
            }
        });

        const summarizeBtn = document.getElementById('summarizeBtn');
        summarizeBtn.disabled = true;

        document.getElementById('summarizeBtn').addEventListener('click', () => {
            this.summarizeCurrentPage();
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Update Save Settings button visibility when OpenAI key changes
        document.getElementById('openaiKey').addEventListener('input', async () => {
            // Invalidate the stored API key validation when user types
            await chrome.storage.sync.remove(['openaiKeyValid']);
            this.updateSaveSettingsVisibility();
            await this.updateUIState();
        });

        document.getElementById('refreshStatus').addEventListener('click', async () => {
            await this.checkAllConnections();
        });

        // Debug: Add force reset on double-click of extension icon area
        document.querySelector('.header').addEventListener('dblclick', async () => {
            await this.forceReset();
        });


    }

    async processCompletedOAuth(completionData) {
        try {
            // Set the user ID from OAuth completion
            await this.setNotionUserId(completionData.userId);

            // Clear the OAuth state
            await chrome.runtime.sendMessage({ action: 'clearOAuthState' });

            // Show success message
            this.showMessage('Successfully connected to Notion!', 'success');

            // Refresh connection status
            setTimeout(() => {
                this.checkNotionConnection();
            }, 1000);

            return true;
        } catch (error) {
            console.error('Error processing completed OAuth:', error);
            return false;
        }
    }

            async checkOAuthCompletion() {
        try {
            // Check if OAuth was completed in background
            const response = await chrome.runtime.sendMessage({ action: 'getOAuthStatus' });

            if (response.completionData && response.completionData.status === 'success') {
                return await this.processCompletedOAuth(response.completionData);
            }

            return false; // OAuth not completed yet
        } catch (error) {
            return false;
        }
    }

            // Auto-detect connected users on popup open
    async autoDetectConnection() {
                    // Auto-detect is now disabled for security - users must authenticate explicitly
        return false;
    }

    async checkForMissedOAuth() {
        // Check if there's a recent OAuth completion that we missed due to timing issues
        try {
            // Check if there's a recent successful OAuth stored locally
            const stored = await chrome.storage.local.get(['lastConnectedUser', 'lastConnectionTime']);

            if (stored.lastConnectedUser && stored.lastConnectionTime) {
                const timeSinceConnection = Date.now() - stored.lastConnectionTime;
                // If the connection was within the last 30 seconds, check it
                if (timeSinceConnection < 30000) {
                    console.log('Checking missed OAuth completion for user:', stored.lastConnectedUser);

                    // Check if this user is actually connected
                    try {
                        const response = await fetch(`${this.backendUrl}/user/${stored.lastConnectedUser}/status`);
                        const data = await response.json();

                        if (data.connected) {
                            console.log('✅ Found missed OAuth completion!');
                            this.userId = stored.lastConnectedUser;
                            await chrome.storage.sync.set({ userId: this.userId });
                            await this.updateUIState();
                            this.showMessage('✅ Successfully connected to Notion!', 'success');
                            return true;
                        }
                    } catch (error) {
                        console.error('Error checking missed OAuth:', error);
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error in checkForMissedOAuth:', error);
            return false;
        }
    }

        async detectRealUser() {
        try {
            // Always check for OAuth completion, regardless of current user ID
            // This handles cases where storage was cleared but OAuth completed
            const response = await fetch(`${this.backendUrl}/oauth/check-completion`);
            if (response.ok) {
                const data = await response.json();

                if (data.has_users && data.latest_user_id) {
                    // Only proceed if this is a different user than we currently have
                    // This prevents re-detecting the same existing session
                    if (data.latest_user_id !== this.userId) {
                        // Verify this user is actually connected
                        const statusResponse = await fetch(`${this.backendUrl}/user/${data.latest_user_id}/status`);
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();

                            if (statusData.connected) {
                                await this.setNotionUserId(data.latest_user_id);
                                return true;
                            }
                        }
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error detecting real user:', error);
            return false;
        }
    }

    async verifyUserToken(userId) {
        try {
            const response = await fetch(`${this.backendUrl}/user/${userId}/status`);
            if (!response.ok) {
                return false;
            }

            const data = await response.json();

            // Check if the token is valid and connected
            if (data.connected) {
                return true;
            } else {
                return false;
            }

        } catch (error) {
            return false;
        }
    }

                // Also check for any connected users when popup opens
    async checkForConnectedUsers() {
        // Method disabled for security - users must authenticate explicitly
        return;
    }

    async isUserConnected(userId) {
        try {
            const response = await fetch(`${this.backendUrl}/user/${userId}/status`);
            const data = await response.json();
            return data.connected;
        } catch (error) {
            console.error('Error checking user connection:', error);
            return false;
        }
    }

    // Force refresh the UI based on current connection status
    async forceRefreshUI() {


        if (!this.userId) {
            return;
        }

        try {
            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
            const data = await response.json();

            const statusElement = document.getElementById('status');

            if (data.connected) {
                statusElement.className = 'status connected';
                statusElement.textContent = `✅ Connected to Notion`;
            } else {
                statusElement.className = 'status disconnected';
                statusElement.textContent = '❌ Not connected to Notion';
            }

            // Update UI state after refreshing connection status
            await this.updateUIState();
        } catch (error) {
            console.error('Error refreshing UI:', error);
        }
    }

    generateUserId() {
        // Try to get stored user ID first
        this.loadStoredUserId();
    }

    async getStoredUserId() {
        try {
            const result = await chrome.storage.sync.get(['userId']);
            return result.userId || null;
        } catch (error) {
            console.error('Error getting stored user ID:', error);
            return null;
        }
    }

    async verifyStoredConnection() {
        try {
            if (!this.userId) return false;

            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
            if (!response.ok) return false;

            const data = await response.json();
            return data.connected === true;
        } catch (error) {
            console.error('Error verifying stored connection:', error);
            return false;
        }
    }

    async loadStoredUserId() {
        try {
            const result = await chrome.storage.sync.get(['userId']);
            if (result.userId) {
                this.userId = result.userId;
            } else {
                // Generate a temporary user ID until OAuth completes
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('Noted User', 2, 2);

                const fingerprint = canvas.toDataURL();
                const extensionId = chrome.runtime.id || 'noted';

                this.userId = btoa(fingerprint + extensionId).substring(0, 16);
            }
        } catch (error) {
            console.error('Error loading stored user ID:', error);
        }
    }

    async setNotionUserId(notionUserId) {
        this.userId = notionUserId;
        await chrome.storage.sync.set({ userId: notionUserId });
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['openaiApiKey', 'openaiKeyValid']);
            const openaiKeyInput = document.getElementById('openaiKey');

            if (result.openaiApiKey && result.openaiKeyValid) {
                // Show masked version of saved key
                const maskedKey = this.maskApiKey(result.openaiApiKey);
                openaiKeyInput.value = maskedKey;
                openaiKeyInput.setAttribute('data-saved-key', result.openaiApiKey);
                openaiKeyInput.setAttribute('data-is-masked', 'true');

                // Add focus handler to allow editing
                this.setupApiKeyEditHandlers(openaiKeyInput);
            } else if (result.openaiApiKey) {
                // Key exists but not validated, show full key for re-validation
                openaiKeyInput.value = result.openaiApiKey;
            }

            // Update Save Settings button visibility after loading
            await this.updateSaveSettingsVisibility();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    maskApiKey(key) {
        if (!key || key.length < 8) return key;
        // Show first 7 characters and last 4 characters, mask the middle
        const start = key.substring(0, 7);
        const end = key.substring(key.length - 4);
        const middle = '•'.repeat(Math.min(32, key.length - 11));
        return start + middle + end;
    }

    setupApiKeyEditHandlers(input) {
        const handleFocus = () => {
            if (input.getAttribute('data-is-masked') === 'true') {
                input.value = '';
                input.placeholder = 'Enter new OpenAI API key or paste existing key';
                input.removeAttribute('data-is-masked');
            }
        };

        const handleBlur = () => {
            const currentValue = input.value.trim();
            const savedKey = input.getAttribute('data-saved-key');

            if (!currentValue && savedKey) {
                // User cleared input, show masked version again
                input.value = this.maskApiKey(savedKey);
                input.setAttribute('data-is-masked', 'true');
                input.placeholder = 'Enter your OpenAI API key';
            }
        };

        // Remove existing listeners to avoid duplicates
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);

        // Add new listeners
        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);
    }

        async saveSettings() {
        try {
            const openaiKeyInput = document.getElementById('openaiKey');
            let openaiKey = openaiKeyInput.value.trim();

            // Check if input is showing masked key
            if (openaiKeyInput.getAttribute('data-is-masked') === 'true') {
                this.showMessage('Please enter a new API key or clear the field to edit the existing one', 'error');
                return;
            }

            if (!openaiKey) {
                this.showMessage('Please enter an OpenAI API key', 'error');
                return;
            }

            // Show validation message
            this.showMessage('Validating OpenAI API key...', 'info');

            // Validate the API key
            const isValid = await this.validateOpenAIKey(openaiKey);

            if (!isValid) {
                this.showMessage('Invalid OpenAI API key. Please check your key and try again.', 'error');
                return;
            }

            // Only save if validation passes
            await chrome.storage.sync.set({
                openaiApiKey: openaiKey,
                openaiKeyValid: true
            });

            // Update the input to show masked version of new key
            const maskedKey = this.maskApiKey(openaiKey);
            openaiKeyInput.value = maskedKey;
            openaiKeyInput.setAttribute('data-saved-key', openaiKey);
            openaiKeyInput.setAttribute('data-is-masked', 'true');
            this.setupApiKeyEditHandlers(openaiKeyInput);

            this.showMessage('Settings saved successfully! OpenAI API key validated.', 'success');

            // Update UI state after saving settings
            await this.updateUIState();
            await this.updateSaveSettingsVisibility();
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Failed to save settings: ' + error.message, 'error');
        }
    }

    async validateOpenAIKey(apiKey) {
        try {
            // Make a simple request to OpenAI API to validate the key
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('Error validating OpenAI API key:', error);
            return false;
        }
    }

    async checkNotionConnection() {
        try {

            if (!this.userId) {
                await this.showDisconnectedState('No user ID available');
                return;
            }

            // Check connection status with enhanced backend validation
            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);

            if (!response.ok) {
                await this.forceDisconnectedState();
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.connected !== true) {
                // If backend says user is not connected, clear stored authentication
                if (data.reason === 'invalid_token' || data.reason === 'no_token') {
                    await chrome.storage.sync.remove(['userId']);
                    this.userId = null;
                    this.generateUserId();

                    // Clear OpenAI API key when tokens are invalid - user must re-authenticate everything
                    await this.clearStoredSettings();
                }

                // Handle different disconnection reasons
                if (data.action === 'clear_extension_storage') {
                    await this.clearExtensionStorage();
                }

                await this.showDisconnectedState(data.message || 'Not connected to Notion');
                return;
            }

            // User is connected and token is valid
            await this.showConnectedState(data.workspace_name);

        } catch (error) {
            console.error('Error checking Notion connection:', error);
            await this.showDisconnectedState('Error checking connection');
        }
    }

    async verifyNotionToken() {
        try {
            // Test the token by checking user status
            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);

            if (!response.ok) {
                return false;
            }

            const data = await response.json();

            // Check if the token is valid and connected
            if (data.connected) {
                return true;
            } else {
                return false;
            }

        } catch (error) {
            console.error('Error verifying Notion token:', error);
            return false;
        }
    }

        async showConnectedState(workspaceName = null) {
        const statusElement = document.getElementById('status');
        const refreshBtn = document.getElementById('refreshStatus');
        const errorElement = document.getElementById('error');

        // Hide all status messages for cleaner UI
        statusElement.style.display = 'none';
        refreshBtn.style.display = 'none';
        errorElement.style.display = 'none';

        // Set internal state for updateUIState to work properly
        statusElement.className = 'status connected';

        // Update UI state (includes summarize button and connect button)
        await this.updateUIState();

        // Show success message only if this is a new connection
        const wasConnected = statusElement.getAttribute('data-was-connected') === 'true';
        if (!wasConnected) {
            const message = workspaceName
                ? `Successfully connected to Notion workspace: ${workspaceName}! You can now summarize pages.`
                : 'Successfully connected to Notion! You can now summarize pages.';
            this.showMessage(message, 'success');
            statusElement.setAttribute('data-was-connected', 'true');
        }
    }

    async showDisconnectedState(reason = 'Not connected to Notion') {
        const statusElement = document.getElementById('status');
        const refreshBtn = document.getElementById('refreshStatus');
        const errorElement = document.getElementById('error');

        // Hide status messages and error messages for cleaner UI
        statusElement.style.display = 'none';
        refreshBtn.style.display = 'none';
        errorElement.style.display = 'none';

        // Set internal state for updateUIState to work properly
        statusElement.className = 'status disconnected';
        statusElement.setAttribute('data-was-connected', 'false');

        // Update UI state (includes summarize button and connect button)
        await this.updateUIState();

        // Clear OpenAI API key when disconnected from Notion
        this.clearStoredSettings();
    }

    async forceDisconnectedState() {
        // Clear any stored user ID that might be stale
        await chrome.storage.sync.remove(['userId']);
        this.userId = null;

        // Generate a new temporary user ID
        this.generateUserId();

        // Force UI to disconnected state
        const statusElement = document.getElementById('status');
        const connectNotionBtn = document.getElementById('connectNotion');

        statusElement.className = 'status disconnected';
        statusElement.setAttribute('data-was-connected', 'false');
        statusElement.style.display = 'none';

        // Reset connect button
        connectNotionBtn.disabled = false;
        connectNotionBtn.textContent = 'Connect to Notion';
        connectNotionBtn.classList.remove('connected', 'connecting');

        // Clear settings
        await this.clearStoredSettings();

        // Update UI state
        await this.updateUIState();

    }

    async clearStoredSettings() {
        try {
            // Clear OpenAI API key and validation status from storage
            await chrome.storage.sync.remove(['openaiApiKey', 'openaiKeyValid']);

            // Clear the input field
            const openaiKeyInput = document.getElementById('openaiKey');
            if (openaiKeyInput) {
                openaiKeyInput.value = '';
            }

        } catch (error) {
            console.error('Error clearing stored settings:', error);
        }
    }

    async clearExtensionStorage() {
        try {
            // Clear all user-related data from Chrome storage
            await chrome.storage.sync.remove(['userId', 'openaiApiKey', 'openaiKeyValid']);
            await chrome.storage.local.remove(['notionConnected', 'lastConnectionCheck']);

            // Clear the user ID from memory
            this.userId = null;

            // Clear the input field
            const openaiKeyInput = document.getElementById('openaiKey');
            if (openaiKeyInput) {
                openaiKeyInput.value = '';
            }

        } catch (error) {
            console.error('Error clearing extension storage:', error);
        }
    }

    setupStatusCheck() {
        // Only check backend connectivity, not auto-detect connections
        this.statusInterval = setInterval(async () => {
            // Only check backend connection, don't auto-detect users
            await this.testBackendConnection();
        }, 5000);

        // Check connection when popup gains focus (user returns from OAuth)
        window.addEventListener('focus', async () => {
            // Always check for OAuth completion when popup gains focus
            try {
                const oauthStatus = await chrome.runtime.sendMessage({ action: 'getOAuthStatus' });
                if (oauthStatus && oauthStatus.isInProgress) {
                    // Check immediately, then again after a short delay
                    await this.checkOAuthCompletion();
                    setTimeout(async () => {
                        await this.checkOAuthCompletion();
                    }, 500);
                } else {
                    // Even if no active OAuth, check connection status
                    await this.checkNotionConnection();
                }
            } catch (error) {
                console.log('Error checking OAuth on focus:', error);
                // Fallback: check connection anyway
                await this.checkNotionConnection();
            }
        });

        // Check connection when popup becomes visible again
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                // Always check for OAuth completion when popup becomes visible
                try {
                    const oauthStatus = await chrome.runtime.sendMessage({ action: 'getOAuthStatus' });
                    if (oauthStatus && oauthStatus.isInProgress) {
                        // Check immediately, then again after a short delay
                        await this.checkOAuthCompletion();
                        setTimeout(async () => {
                            await this.checkOAuthCompletion();
                        }, 500);
                    } else {
                        // Even if no active OAuth, check connection status
                        await this.checkNotionConnection();
                    }
                } catch (error) {
                    console.log('Error checking OAuth on visibility change:', error);
                    // Fallback: check connection anyway
                    await this.checkNotionConnection();
                }
            }
        });

        // Clear interval when popup closes
        window.addEventListener('beforeunload', () => {
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
            }
        });
    }

    async connectToNotion() {
        try {
            const connectNotionBtn = document.getElementById('connectNotion');

            // Clear any existing stored user ID to force fresh authentication
            await chrome.storage.sync.remove(['userId']);
            await chrome.storage.local.remove(['lastConnectedUser', 'lastConnectionTime']);
            this.userId = null;
            this.generateUserId();

            // Update button to show connecting state
            connectNotionBtn.textContent = 'Connecting...';
            connectNotionBtn.disabled = true;
            connectNotionBtn.classList.add('connecting');

            // Clear any previous OAuth state in background script
            await chrome.runtime.sendMessage({ action: 'clearOAuthState' });

            // Wait a moment, then start new OAuth
            setTimeout(async () => {
                // Notify background script that OAuth is starting
                await chrome.runtime.sendMessage({ action: 'startOAuth' });
            }, 100);

                const authUrl = `${this.backendUrl}/auth/notion/login`;


            const popup = window.open(
                authUrl,
                'notion_auth',
                'width=500,height=600,scrollbars=yes,resizable=yes,noopener=yes'
            );

            const keepAlive = setInterval(() => {
                if (popup && popup.closed) {
                    clearInterval(keepAlive);
                    // When popup closes, immediately check for OAuth completion
                    setTimeout(async () => {
                        await this.checkOAuthCompletion();
                        // Check again after a short delay in case there's network lag
                        setTimeout(async () => {
                            await this.checkOAuthCompletion();
                        }, 1000);
                    }, 100);
                } else if (popup) {
                    // Periodically check if popup still exists
                    try {
                        popup.location; // This will throw if popup is closed
                    } catch (e) {
                        clearInterval(keepAlive);
                        // When popup closes, immediately check for OAuth completion
                        setTimeout(async () => {
                            await this.checkOAuthCompletion();
                            // Check again after a short delay in case there's network lag
                            setTimeout(async () => {
                                await this.checkOAuthCompletion();
                            }, 1000);
                        }, 100);
                    }
                }
            }, 1000);

            // Show connecting message
            this.showMessage('Connecting to Notion... Complete authorization in the popup window. This extension popup will stay open to show connection status.', 'success');

            // Start OAuth monitoring immediately
            this.startOAuthCompletionPolling();

        } catch (error) {
            console.error('Error connecting to Notion:', error);
            this.showMessage('Failed to connect to Notion', 'error');

            // Reset button on error
            const connectNotionBtn = document.getElementById('connectNotion');
            connectNotionBtn.textContent = 'Connect to Notion';
            connectNotionBtn.disabled = false;
            connectNotionBtn.classList.remove('connecting', 'connected');
        }
    }

    async forceReset() {

        try {
            // Clear all Chrome storage
            await chrome.storage.sync.clear();
            await chrome.storage.local.clear();

            // Reset internal state
            this.userId = null;
            this.backendConnected = false;

            // Reset UI elements
            const statusElement = document.getElementById('status');
            const connectNotionBtn = document.getElementById('connectNotion');
            const errorElement = document.getElementById('error');

            // Hide status messages
            statusElement.style.display = 'none';
            errorElement.style.display = 'none';

            // Reset button to disconnected state
            connectNotionBtn.textContent = 'Connect to Notion';
            connectNotionBtn.disabled = false;
            connectNotionBtn.classList.remove('connected', 'connecting');

            // Reset status element
            statusElement.className = 'status disconnected';
            statusElement.setAttribute('data-was-connected', 'false');

            // Clear API key input
            const openaiKeyInput = document.getElementById('openaiKey');
            if (openaiKeyInput) {
                openaiKeyInput.value = '';
            }

            // Update UI
            await this.updateUIState();

            this.showMessage('🔄 Extension reset! Please authenticate again.', 'info');
        } catch (error) {
            this.showMessage('Reset failed. Try reloading the extension.', 'error');
        }
    }

    async startOAuthCompletionPolling() {
        const connectNotionBtn = document.getElementById('connectNotion');
        let attempts = 0;
        const maxAttempts = 20; // 20 attempts over 40 seconds (more time)

        const pollInterval = setInterval(async () => {
            attempts++;

            try {
                // Check for OAuth completion via background script first
                const oauthCompleted = await this.checkOAuthCompletion();

                if (oauthCompleted) {
                    clearInterval(pollInterval);

                    // Update button immediately
                    connectNotionBtn.textContent = '✅ Connected to Notion';
                    connectNotionBtn.disabled = true;
                    connectNotionBtn.classList.remove('connecting');
                    connectNotionBtn.classList.add('connected');

                    // Update internal state and UI
                    await this.checkNotionConnection();

                    return;
                }

                // Check if any user was successfully connected to backend during this session
                // Only check for new connections, not existing ones
                const detectedUser = await this.detectRealUser();

                if (detectedUser) {
                    clearInterval(pollInterval);

                    // Update button immediately
                    connectNotionBtn.textContent = '✅ Connected to Notion';
                    connectNotionBtn.disabled = true;
                    connectNotionBtn.classList.remove('connecting');
                    connectNotionBtn.classList.add('connected');

                    // Update internal state and UI
                    await this.checkNotionConnection();

                    return;
                }

                // Additional fallback: Check current user ID status
                if (this.userId) {
                    const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.connected) {
                            clearInterval(pollInterval);

                            // Update button immediately
                            connectNotionBtn.textContent = '✅ Connected to Notion';
                            connectNotionBtn.disabled = true;
                            connectNotionBtn.classList.remove('connecting');
                            connectNotionBtn.classList.add('connected');

                            // Update internal state and UI
                            await this.checkNotionConnection();

                            return;
                        }
                    }
                }

                // If max attempts reached, reset button
                if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    connectNotionBtn.textContent = 'Connect to Notion';
                    connectNotionBtn.disabled = false;
                    connectNotionBtn.classList.remove('connecting', 'connected');
                    this.showMessage('Connection timeout. Please try again.', 'error');
                }

            } catch (error) {
                console.error('Error during OAuth polling:', error);
                if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    connectNotionBtn.textContent = 'Connect to Notion';
                    connectNotionBtn.disabled = false;
                    connectNotionBtn.classList.remove('connecting', 'connected');
                }
            }
        }, 2000); // Check every 2 seconds
    }

    async summarizeCurrentPage() {
        try {
            this.showLoading(true);
            this.disableSummarizeButton(); // Disable button to prevent multiple clicks

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Extract content from the page
            const content = await this.extractPageContent(tab.id);

            if (!content) {
                throw new Error('Could not extract content from this page');
            }

            // Get OpenAI API key from storage
            const result = await chrome.storage.sync.get(['openaiApiKey']);
            const openaiKey = result.openaiApiKey;

            if (!openaiKey) {
                throw new Error('Please enter your OpenAI API key in settings');
            }

            // Show category detection status
            this.showMessage('🤖 Analyzing content and detecting category...', 'info');

            // Summarize and categorize using OpenAI via backend
            const summaryData = await this.summarizeAndCategorizeWithBackend(content, tab.title, openaiKey);

            // Show detected category to user with option to change
            const finalCategory = await this.showCategoryConfirmation(summaryData.category);

            // Hide category confirmation UI and show processing message
            this.hideCategoryConfirmation();
            this.showMessage('💾 Saving to Notion...', 'info');

            // Save to Notion via backend with category
            const notionPageUrl = await this.saveToNotionWithCategory(
                summaryData.summary,
                tab.url,
                tab.title,
                finalCategory
            );

            this.showSuccessWithLink(
                `Article summarized and saved to Notion under "${finalCategory}" category!`,
                notionPageUrl
            );

        } catch (error) {
            this.showMessage(error.message, 'error');
            this.hideCategoryConfirmation(); // Hide category UI if there's an error
        } finally {
            this.showLoading(false);
            this.enableSummarizeButton(); // Re-enable button when process completes
        }
    }

    disableSummarizeButton() {
        const summarizeBtn = document.getElementById('summarizeBtn');
        summarizeBtn.disabled = true;
        summarizeBtn.style.opacity = '0.5';
        summarizeBtn.style.cursor = 'not-allowed';
    }

    enableSummarizeButton() {
        const summarizeBtn = document.getElementById('summarizeBtn');
        summarizeBtn.disabled = false;
        summarizeBtn.style.opacity = '1';
        summarizeBtn.style.cursor = 'pointer';
    }

    async extractPageContent(tabId) {
        try {
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: () => {
                    // Try to extract readable content
                    const article = document.querySelector('article');
                    if (article) {
                        return article.textContent.trim();
                    }

                    // Fallback to main content
                    const main = document.querySelector('main');
                    if (main) {
                        return main.textContent.trim();
                    }

                    // Fallback to body content
                    const body = document.body;
                    if (body) {
                        // Remove script and style elements
                        const scripts = body.querySelectorAll('script, style, nav, header, footer');
                        scripts.forEach(el => el.remove());
                        return body.textContent.trim();
                    }

                    return null;
                }
            });

            return result;
        } catch (error) {
            console.error('Error extracting content:', error);
            return null;
        }
    }

    async summarizeWithOpenAI(content, apiKey) {
        try {
            // Call the backend summarization endpoint
            const response = await fetch(`${this.backendUrl}/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    title: document.title || '',
                    openai_api_key: apiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Backend summarization error: ${errorData.detail || response.statusText}`);
            }

            const data = await response.json();
            return data.summary;

        } catch (error) {
            throw new Error(`Failed to create summary: ${error.message}`);
        }
    }

    async summarizeAndCategorizeWithBackend(content, title, openaiKey) {
        try {
            const response = await fetch(`${this.backendUrl}/summarize-and-categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    title: title || 'Untitled',
                    openai_api_key: openaiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to summarize and categorize content');
            }

            const data = await response.json();
            return {
                summary: data.summary,
                category: data.category
            };

        } catch (error) {
            throw new Error(`Failed to process content: ${error.message}`);
        }
    }

    async showCategoryConfirmation(detectedCategory) {
        return new Promise((resolve) => {
            // Show the detected category with option to change
            const categoryDisplay = document.getElementById('categoryDisplay');
            const categoryConfirm = document.getElementById('categoryConfirm');
            const categorySelect = document.getElementById('categorySelect');
            const confirmBtn = document.getElementById('confirmCategory');
            const changeBtn = document.getElementById('changeCategory');
            const cancelBtn = document.getElementById('cancelCategory');

            // Set detected category
            categoryDisplay.textContent = detectedCategory;
            categorySelect.value = detectedCategory;

            // Reset UI state
            categorySelect.style.display = 'none';
            confirmBtn.textContent = 'Confirm Category';
            changeBtn.textContent = 'Change';

            // Ensure correct button visibility
            changeBtn.style.display = 'block';
            cancelBtn.style.display = 'none';

            // Show confirmation UI
            categoryConfirm.style.display = 'block';

            // Store original category for cancel functionality
            let originalCategory = detectedCategory;
            let isInChangeMode = false;

            // Handle initial confirm button (confirm detected category)
            const handleInitialConfirm = () => {
                // Just confirm the category selection - no summarization here
                this.showMessage(`✅ Category confirmed: ${originalCategory}`, 'info');
                setTimeout(() => {
                    cleanup();
                    resolve(originalCategory);
                }, 500); // Brief delay to show confirmation
            };

            // Handle change button (show dropdown)
            const handleChange = () => {
                isInChangeMode = true;
                categorySelect.style.display = 'block';

                // Show/hide buttons appropriately
                changeBtn.style.display = 'none';
                cancelBtn.style.display = 'block';

                // Change button texts
                confirmBtn.textContent = '✓ Confirm Selection';
                cancelBtn.textContent = '✖ Cancel';

                // Remove old event listeners
                confirmBtn.removeEventListener('click', handleInitialConfirm);
                changeBtn.removeEventListener('click', handleChange);

                // Add new event listeners
                confirmBtn.addEventListener('click', handleNewCategoryConfirm);
                cancelBtn.addEventListener('click', handleCancel);
            };
            // Handle

            // Handle confirm button when in change mode (confirm new selection)
            const handleNewCategoryConfirm = () => {
                const selectedCategory = categorySelect.value;
                this.showMessage(`✅ Category updated to: ${selectedCategory}`, 'info');
                setTimeout(() => {
                    cleanup();
                    resolve(selectedCategory);
                }, 500); // Brief delay to show confirmation
            };

            // Handle cancel button (keep original category)
            const handleCancel = () => {
                this.showMessage(`↩️ Keeping original category: ${originalCategory}`, 'info');
                setTimeout(() => {
                    cleanup();
                    resolve(originalCategory);
                }, 500); // Brief delay to show message
            };

            // Cleanup function to remove all event listeners and hide UI
            const cleanup = () => {
                categoryConfirm.style.display = 'none';

                // Reset button visibility to initial state
                changeBtn.style.display = 'block';
                cancelBtn.style.display = 'none';

                // Remove all event listeners
                confirmBtn.removeEventListener('click', handleInitialConfirm);
                confirmBtn.removeEventListener('click', handleNewCategoryConfirm);
                changeBtn.removeEventListener('click', handleChange);
                cancelBtn.removeEventListener('click', handleCancel);
            };

            // Set up initial event listeners
            confirmBtn.addEventListener('click', handleInitialConfirm);
            changeBtn.addEventListener('click', handleChange);
        });
    }

    hideCategoryConfirmation() {
        const categoryConfirm = document.getElementById('categoryConfirm');
        categoryConfirm.style.display = 'none';
    }

    async saveToNotion(summary, url, title) {
        try {
            const response = await fetch(`${this.backendUrl}/notion/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: summary,
                    url: url,
                    title: title,
                    user_id: this.userId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save to Notion');
            }

            const data = await response.json();
            return data.page_url; // Return the page URL

        } catch (error) {
            throw new Error(`Failed to save to Notion: ${error.message}`);
        }
    }

    async saveToNotionWithCategory(summary, url, title, category) {
        try {

            if (!this.userId) {
                throw new Error('No user ID available. Please reconnect to Notion.');
            }

            // Verify user is actually connected before attempting to save
            const statusResponse = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (!statusData.connected) {
                    const detectedUser = await this.detectRealUser();
                    if (!detectedUser) {
                        // Force UI to disconnected state and clear any stale data
                        await this.forceDisconnectedState();
                        throw new Error('User not authenticated with Notion. Please reconnect.');
                    }
                }
            } else {
                // Status check failed, force disconnected state
                await this.forceDisconnectedState();
                throw new Error('Unable to verify Notion connection. Please reconnect.');
            }

            const response = await fetch(`${this.backendUrl}/notion/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: summary,
                    url: url,
                    title: title,
                    user_id: this.userId,
                    category: category
                })
            });


            if (!response.ok) {
                const errorData = await response.json();
                // Handle specific error cases
                if (response.status === 401) {
                    throw new Error('Authentication failed. Please reconnect to Notion.');
                } else if (response.status === 500) {
                    throw new Error(`Server error: ${errorData.detail || 'Unknown error'}`);
                } else {
                    throw new Error(errorData.detail || `HTTP ${response.status}: Failed to save to Notion`);
                }
            }

            const data = await response.json();
            return data.page_url;

        } catch (error) {
            console.error('Save to Notion error:', error);
            throw new Error(`Failed to save to Notion: ${error.message}`);
        }
    }

    testPopupWindow() {
        const testPopup = window.open(
            'https://www.google.com',
            'test_popup',
            'width=400,height=300,scrollbars=yes,resizable=yes'
        );

        if (testPopup) {
            this.showMessage('Test popup created successfully!', 'success');
        } else {
            this.showMessage('Popup blocked. Please allow popups for this extension.', 'error');
        }
    }

    async debugConnection() {

        try {
            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
            const data = await response.json();
            this.showMessage(`Status: ${JSON.stringify(data, null, 2)}`, 'success');
        } catch (error) {
            console.error('Status check error:', error);
            this.showMessage(`Status error: ${error.message}`, 'error');
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = show ? 'block' : 'none';
    }

    showMessage(message, type = 'info') {
        const errorElement = document.getElementById('error');
        const successElement = document.getElementById('success');
        const infoElement = document.getElementById('info'); // Added info element

        // Hide all message types
        errorElement.style.display = 'none';
        successElement.style.display = 'none';
        infoElement.style.display = 'none'; // Hide info element

        // Show the appropriate message
        if (type === 'error') {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else if (type === 'success') {
            successElement.textContent = message;
            successElement.style.display = 'block';
        } else if (type === 'info') { // Added info message handling
            infoElement.textContent = message;
            infoElement.style.display = 'block';
        }

        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                successElement.style.display = 'none';
            }, 3000);
        }
        // Auto-hide info messages after 3 seconds
        if (type === 'info') {
            setTimeout(() => {
                infoElement.style.display = 'none';
            }, 3000);
        }
    }

    showSuccessWithLink(message, notionUrl) {
        const successElement = document.getElementById('success');

        // Clear any existing content
        successElement.innerHTML = '';

        // Create the main message
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.marginBottom = '10px';

        // Create the link container
        const linkContainer = document.createElement('div');
        linkContainer.style.marginTop = '8px';
        linkContainer.style.padding = '8px';
        linkContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        linkContainer.style.borderRadius = '4px';
        linkContainer.style.border = '1px solid rgba(0, 0, 0, 0.1)';

        // Create the link text
        const linkText = document.createElement('div');
        linkText.textContent = '🔗 View in Notion';
        linkText.style.fontSize = '12px';
        linkText.style.color = '#374151';
        linkText.style.marginBottom = '4px';

        // Create the clickable link
        const linkElement = document.createElement('a');
        linkElement.href = notionUrl;
        linkElement.textContent = 'Open Saved Summary';
        linkElement.target = '_blank';
        linkElement.style.color = '#2563eb';
        linkElement.style.textDecoration = 'none';
        linkElement.style.fontWeight = 'bold';
        linkElement.style.fontSize = '13px';
        linkElement.style.display = 'block';
        linkElement.style.padding = '4px';
        linkElement.style.borderRadius = '3px';
        linkElement.style.transition = 'background-color 0.2s';

        // Add hover effect
        linkElement.addEventListener('mouseenter', () => {
            linkElement.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
        });
        linkElement.addEventListener('mouseleave', () => {
            linkElement.style.backgroundColor = 'transparent';
        });

        // Assemble the elements
        linkContainer.appendChild(linkText);
        linkContainer.appendChild(linkElement);
        successElement.appendChild(messageDiv);
        successElement.appendChild(linkContainer);

        // Show the success element
        successElement.style.display = 'block';

        // Auto-hide after 10 seconds (longer since user might want to click the link)
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 10000);
    }

    async updateSaveSettingsVisibility() {
        const saveSettingsBtn = document.getElementById('saveSettings');
        const openaiKeyInput = document.getElementById('openaiKey');
        const statusElement = document.getElementById('status');

        if (openaiKeyInput && saveSettingsBtn && statusElement) {
            // Check if OpenAI key is saved and validated in storage
            const result = await chrome.storage.sync.get(['openaiApiKey', 'openaiKeyValid']);
            const savedOpenaiKey = result.openaiApiKey;
            const isOpenaiKeyValid = result.openaiKeyValid === true;
            const currentInputValue = openaiKeyInput.value.trim();
            const isInputMasked = openaiKeyInput.getAttribute('data-is-masked') === 'true';

            // Always show the Save Settings button - users should always be able to update their API key
            saveSettingsBtn.style.display = 'block';

            // Update button text and style based on current state
            if (savedOpenaiKey && savedOpenaiKey.trim() && isOpenaiKeyValid) {
                if (isInputMasked) {
                    // Showing masked saved key
                    saveSettingsBtn.textContent = 'API Key Saved ✓';
                    saveSettingsBtn.style.backgroundColor = 'white'; // White color for saved
                    saveSettingsBtn.disabled = true; // Disable until user starts editing
                } else if (currentInputValue && currentInputValue !== savedOpenaiKey) {
                    // User has typed a different key
                    saveSettingsBtn.textContent = 'Update API Key';
                    saveSettingsBtn.style.backgroundColor = 'white'; // White color for update
                    saveSettingsBtn.disabled = false;
                } else if (!currentInputValue) {
                    // User cleared the input
                    saveSettingsBtn.textContent = 'Enter New API Key';
                    saveSettingsBtn.style.backgroundColor = 'white'; // White color
                    saveSettingsBtn.disabled = true;
                } else {
                    // Same key as saved
                    saveSettingsBtn.textContent = 'API Key Unchanged';
                    saveSettingsBtn.style.backgroundColor = 'white'; // White color
                    saveSettingsBtn.disabled = true;
                }
            } else {
                // No valid key saved yet
                saveSettingsBtn.textContent = 'Save Settings';
                saveSettingsBtn.style.backgroundColor = 'white'; // White color
                saveSettingsBtn.disabled = !currentInputValue;
            }
        }
    }

    async updateUIState() {
        const statusElement = document.getElementById('status');
        const summarizeBtn = document.getElementById('summarizeBtn');
        const connectNotionBtn = document.getElementById('connectNotion');

        if (!statusElement || !summarizeBtn || !connectNotionBtn) return;

        // Only consider connected to Notion if backend is accessible AND status shows connected
        // FIX: Use exact class check instead of includes() to avoid "disconnected" matching "connected"
        const hasConnectedClass = statusElement.classList.contains('connected');
        const isConnectedToNotion = this.backendConnected && hasConnectedClass;

        // Check if OpenAI key is saved and valid
        const result = await chrome.storage.sync.get(['openaiApiKey', 'openaiKeyValid']);
        const savedOpenaiKey = result.openaiApiKey;
        const isOpenaiKeyValid = result.openaiKeyValid === true;
        const hasValidOpenaiKey = savedOpenaiKey && savedOpenaiKey.trim() && isOpenaiKeyValid;

        // Enable summarize button only if ALL conditions are met
        if (this.backendConnected && isConnectedToNotion && hasValidOpenaiKey) {
            summarizeBtn.disabled = false;
        } else {
            summarizeBtn.disabled = true;
            if (!this.backendConnected) {
                console.log('Summarize button disabled - backend not accessible');
            }
            if (!isConnectedToNotion) {
                console.log('Summarize button disabled - Notion not connected');
            }
            if (!hasValidOpenaiKey) {
                if (!savedOpenaiKey) {
                    console.log('Summarize button disabled - OpenAI key not provided');
                } else if (!isOpenaiKeyValid) {
                    console.log('Summarize button disabled - OpenAI key not validated');
                }
            }
        }

        // Update Connect to Notion button based on connection status
        if (isConnectedToNotion) {
            connectNotionBtn.disabled = true;
            connectNotionBtn.textContent = '✅ Connected to Notion';
            connectNotionBtn.classList.remove('connecting');
            connectNotionBtn.classList.add('connected');
        } else {
            // Only reset if not currently in connecting state
            if (!connectNotionBtn.classList.contains('connecting')) {
                connectNotionBtn.disabled = false;
                connectNotionBtn.textContent = 'Connect to Notion';
                connectNotionBtn.classList.remove('connected', 'connecting');
            }
        }

        // Update save settings visibility
        await this.updateSaveSettingsVisibility();
    }
}

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NotedPopup();
});