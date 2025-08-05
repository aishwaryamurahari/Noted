// Popup script for SummarizeIt Chrome Extension
class SummarizeItPopup {
    constructor() {
        this.backendUrl = 'http://localhost:8000';
        this.userId = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadSettings();
        this.generateUserId();

        console.log('=== INITIALIZING POPUP ===');
        console.log('Initial user ID:', this.userId);

        // Test backend connection first
        const backendConnected = await this.testBackendConnection();
        if (!backendConnected) {
            console.log('Backend not accessible, showing disconnected state');
            const statusElement = document.getElementById('status');
            statusElement.className = 'status disconnected';
            statusElement.textContent = '❌ Backend not accessible';
            await this.updateUIState();
            return;
        }

        // First, try auto-detection of connected users
        const autoDetected = await this.autoDetectConnection();

        if (!autoDetected) {
            // If auto-detection failed, try the more comprehensive check
            await this.checkForConnectedUsers();
        }

        // Then check for OAuth completion from background script
        await this.checkOAuthCompletion();

        // Finally check Notion connection status
        await this.checkNotionConnection();

        // Set up periodic status check
        this.setupStatusCheck();

        // Final UI state update to ensure everything is properly configured
        await this.updateUIState();

        console.log('=== INITIALIZATION COMPLETE ===');
    }

    async testBackendConnection() {
        try {
            console.log('Testing backend connection...');
            const response = await fetch(`${this.backendUrl}/`);
            if (response.ok) {
                console.log('Backend is accessible');
                return true;
            } else {
                console.log('Backend returned error:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Backend connection failed:', error);
            return false;
        }
    }

    bindEvents() {
        // Event listeners
        document.getElementById('connectNotion').addEventListener('click', () => {
            this.connectToNotion();
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
        document.getElementById('openaiKey').addEventListener('input', () => {
            this.updateSaveSettingsVisibility();
        });

        document.getElementById('refreshStatus').addEventListener('click', () => {
            this.checkNotionConnection();
        });


    }

            async checkOAuthCompletion() {
        try {
            // Check if OAuth was completed in background
            const response = await chrome.runtime.sendMessage({ action: 'getOAuthStatus' });
            console.log('OAuth status from background:', response);

            if (response.completionData && response.completionData.status === 'success') {
                console.log('OAuth completed in background, setting user ID:', response.completionData.userId);

                // Set the user ID from OAuth completion
                await this.setNotionUserId(response.completionData.userId);

                // Clear the OAuth state
                await chrome.runtime.sendMessage({ action: 'clearOAuthState' });

                // Show success message
                this.showMessage('Successfully connected to Notion!', 'success');

                // Refresh connection status
                setTimeout(() => {
                    this.checkNotionConnection();
                }, 1000);
            }
        } catch (error) {
            console.error('Error checking OAuth completion:', error);
        }
    }

            // Auto-detect connected users on popup open
    async autoDetectConnection() {
        console.log('=== AUTO-DETECTING CONNECTION ===');
        try {
            const response = await fetch(`${this.backendUrl}/debug/users`);
            const usersData = await response.json();

            if (usersData.users && usersData.users.length > 0) {
                // Check the first user (most likely the one who just completed OAuth)
                const user = usersData.users[0].user_id;
                console.log('Checking first user:', user);

                // Verify this user has a valid token
                const isUserValid = await this.verifyUserToken(user);

                if (isUserValid) {
                    console.log('Auto-detected valid user:', user);
                    await this.setNotionUserId(user);
                    console.log('Auto-detection: Found valid user, will check connection');
                    return true;
                } else {
                    console.log('Auto-detection: User found but token is invalid');
                }
            }
        } catch (error) {
            console.error('Error in auto-detection:', error);
        }
        return false;
    }

    async verifyUserToken(userId) {
        try {
            console.log(`Verifying token for user: ${userId}`);

            const response = await fetch(`${this.backendUrl}/debug/user/${userId}`);
            if (!response.ok) {
                console.log(`User ${userId} verification failed - HTTP error`);
                return false;
            }

            const data = await response.json();
            console.log(`User ${userId} verification data:`, data);

            // Check if the token is valid and can access Notion
            if (data.notion_status === 'connected' && data.workspace_info) {
                console.log(`User ${userId} has valid token`);
                return true;
            } else {
                console.log(`User ${userId} has invalid token`);
                return false;
            }

        } catch (error) {
            console.error(`Error verifying user ${userId} token:`, error);
            return false;
        }
    }

                // Also check for any connected users when popup opens
    async checkForConnectedUsers() {
        try {
            console.log('=== CHECKING FOR CONNECTED USERS ===');
            const response = await fetch(`${this.backendUrl}/debug/users`);
            const usersData = await response.json();

            console.log('Checking for connected users:', usersData);
            console.log('Current user ID:', this.userId);

            // Check if any user has a valid token
            for (const user of usersData.users) {
                try {
                    console.log(`Checking user: ${user}`);

                    // Verify this user has a valid token
                    const isUserValid = await this.verifyUserToken(user);

                    if (isUserValid) {
                        console.log('Found user with valid token:', user);

                        // Switch to the user with valid token
                        console.log('Switching to user with valid token:', user);
                        await this.setNotionUserId(user);

                        // Don't update UI here - let checkNotionConnection handle it
                        console.log('Found user with valid token, will check connection');
                        break;
                    } else {
                        console.log(`User ${user} has invalid token`);
                    }
                } catch (error) {
                    console.error(`Error checking user ${user}:`, error);
                }
            }
        } catch (error) {
            console.error('Error checking for connected users:', error);
        }
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
        console.log('=== FORCE REFRESHING UI ===');
        console.log('Current user ID:', this.userId);

        if (!this.userId) {
            console.log('No user ID available');
            return;
        }

        try {
            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
            const data = await response.json();
            console.log('Connection data:', data);

            const statusElement = document.getElementById('status');

            if (data.connected) {
                statusElement.className = 'status connected';
                statusElement.textContent = `✅ Connected to Notion`;
                console.log('UI updated to connected state');
            } else {
                statusElement.className = 'status disconnected';
                statusElement.textContent = '❌ Not connected to Notion';
                console.log('UI updated to disconnected state');
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

    async loadStoredUserId() {
        try {
            const result = await chrome.storage.sync.get(['userId']);
            if (result.userId) {
                this.userId = result.userId;
                console.log('Loaded stored User ID:', this.userId);
            } else {
                // Generate a temporary user ID until OAuth completes
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('SummarizeIt User', 2, 2);

                const fingerprint = canvas.toDataURL();
                const extensionId = chrome.runtime.id || 'summarizeit';

                this.userId = btoa(fingerprint + extensionId).substring(0, 16);
                console.log('Generated temporary User ID:', this.userId);
            }
        } catch (error) {
            console.error('Error loading stored user ID:', error);
        }
    }

    async setNotionUserId(notionUserId) {
        this.userId = notionUserId;
        await chrome.storage.sync.set({ userId: notionUserId });
        console.log('Set Notion User ID:', notionUserId);
    }

    // Debug function to manually set the correct user ID
    async setCorrectUserId() {
        console.log('=== SETTING CORRECT USER ID ===');
        // Use the user ID that we know has a token stored
        const correctUserId = 'c425202e-f79f-40e2-98e4-aecacac9ec4e';
        console.log('Setting user ID to:', correctUserId);

        await this.setNotionUserId(correctUserId);
        console.log('User ID set, now checking connection...');

        await this.checkNotionConnection();
        console.log('Connection check completed');

        // Force UI update
        const statusElement = document.getElementById('status');

        // Check if the user is actually connected
        try {
            const response = await fetch(`${this.backendUrl}/user/${correctUserId}/status`);
            const data = await response.json();
            console.log('Final connection check:', data);

            if (data.connected) {
                statusElement.className = 'status connected';
                statusElement.textContent = `✅ Connected to Notion`;
                console.log('UI updated to connected state');
            } else {
                statusElement.className = 'status disconnected';
                statusElement.textContent = '❌ Not connected to Notion';
                console.log('UI updated to disconnected state');
            }

            // Update UI state after setting user ID
            await this.updateUIState();
        } catch (error) {
            console.error('Error in final connection check:', error);
        }

        this.showMessage('Set correct user ID for testing', 'success');
    }

    // Debug function to test connection with correct user ID
    async testCorrectUserId() {
        console.log('=== TESTING CORRECT USER ID ===');
        const correctUserId = 'c425202e-f79f-40e2-98e4-aecacac9ec4e';
        console.log('Testing connection with correct user ID:', correctUserId);

        try {
            const response = await fetch(`${this.backendUrl}/user/${correctUserId}/status`);
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Test connection result:', data);

            if (data.connected) {
                this.showMessage('Backend shows user is connected!', 'success');

                // Also update the UI immediately
                const statusElement = document.getElementById('status');
                statusElement.className = 'status connected';
                statusElement.textContent = `✅ Connected to Notion`;
                await this.updateUIState();
            } else {
                this.showMessage('Backend shows user is NOT connected', 'error');
            }
        } catch (error) {
            console.error('Test connection error:', error);
            this.showMessage('Test connection failed', 'error');
        }
    }

    // Debug function to simulate OAuth completion
    async simulateOAuthCompletion() {
        console.log('Simulating OAuth completion...');

        // Manually trigger the OAuth completion logic
        this.showMessage('Successfully connected to Notion!', 'success');

        console.log('Setting Notion user ID from simulation: c425202e-f79f-40e2-98e4-aecacac9ec4e');
        await this.setNotionUserId('c425202e-f79f-40e2-98e4-aecacac9ec4e');

        // Refresh connection status
        setTimeout(() => {
            this.checkNotionConnection();
        }, 1000);

        this.showMessage('Simulated OAuth completion', 'success');
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['openaiApiKey']);
            if (result.openaiApiKey) {
                document.getElementById('openaiKey').value = result.openaiApiKey;
            }

            // Update Save Settings button visibility after loading
            await this.updateSaveSettingsVisibility();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const openaiKey = document.getElementById('openaiKey').value;
            await chrome.storage.sync.set({ openaiApiKey: openaiKey });
            this.showMessage('Settings saved successfully!', 'success');

            // Update UI state after saving settings
            await this.updateUIState();
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('Failed to save settings', 'error');
        }
    }

    async checkNotionConnection() {
        try {
            console.log('=== CHECKING NOTION CONNECTION ===');
            console.log('Checking Notion connection for user ID:', this.userId);
            console.log('Current user ID type:', typeof this.userId);
            console.log('Current user ID length:', this.userId ? this.userId.length : 'null');

            if (!this.userId) {
                console.log('No user ID available, showing disconnected state');
                this.showDisconnectedState('No user ID available');
                return;
            }

            // First, check if the user has a token stored
            const response = await fetch(`${this.backendUrl}/user/${this.userId}/status`);
            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Connection status data:', data);

            if (data.connected !== true) {
                console.log('User is not connected to Notion');
                this.showDisconnectedState('Not connected to Notion');
                return;
            }

            // If we have a token, verify it's actually working by testing Notion API access
            const isTokenValid = await this.verifyNotionToken();

            if (isTokenValid) {
                console.log('Notion token is valid and working');
                this.showConnectedState();
            } else {
                console.log('Notion token is invalid or expired');
                this.showDisconnectedState('Token invalid or expired');
            }

        } catch (error) {
            console.error('Error checking Notion connection:', error);
            this.showDisconnectedState('Error checking connection');
        }
    }

    async verifyNotionToken() {
        try {
            console.log('=== VERIFYING NOTION TOKEN ===');

            // Test the token by making a request to Notion API through our backend
            const response = await fetch(`${this.backendUrl}/debug/user/${this.userId}`);
            console.log('Token verification response status:', response.status);

            if (!response.ok) {
                console.log('Token verification failed - HTTP error');
                return false;
            }

            const data = await response.json();
            console.log('Token verification data:', data);

            // Check if the token is valid and can access Notion
            if (data.notion_status === 'connected' && data.workspace_info) {
                console.log('Token is valid and can access Notion workspace');
                return true;
            } else {
                console.log('Token is invalid or cannot access Notion');
                return false;
            }

        } catch (error) {
            console.error('Error verifying Notion token:', error);
            return false;
        }
    }

    async showConnectedState() {
        const statusElement = document.getElementById('status');

        statusElement.className = 'status connected';
        statusElement.textContent = `✅ Connected to Notion`;

        // Update UI state (includes summarize button and save settings visibility)
        await this.updateUIState();

        // Show success message only if this is a new connection
        const wasConnected = statusElement.getAttribute('data-was-connected') === 'true';
        if (!wasConnected) {
            this.showMessage('Successfully connected to Notion! You can now summarize pages.', 'success');
            statusElement.setAttribute('data-was-connected', 'true');
        }
    }

    async showDisconnectedState(reason = 'Not connected to Notion') {
        const statusElement = document.getElementById('status');

        statusElement.className = 'status disconnected';
        statusElement.textContent = `❌ ${reason}`;
        statusElement.setAttribute('data-was-connected', 'false');

        // Update UI state (includes summarize button and save settings visibility)
        await this.updateUIState();

        // Clear OpenAI API key when disconnected from Notion
        this.clearStoredSettings();

        // Show helpful message for disconnected state
        this.showMessage('Click "Connect to Notion" to authorize the extension.', 'error');
    }

    async clearStoredSettings() {
        try {
            // Clear OpenAI API key from storage
            await chrome.storage.sync.remove(['openaiApiKey']);

            // Clear the input field
            const openaiKeyInput = document.getElementById('openaiKey');
            if (openaiKeyInput) {
                openaiKeyInput.value = '';
            }

            console.log('Cleared stored OpenAI API key - user disconnected from Notion');
        } catch (error) {
            console.error('Error clearing stored settings:', error);
        }
    }

    setupStatusCheck() {
        // Check status every 3 seconds while popup is open
        this.statusInterval = setInterval(async () => {
            await this.checkNotionConnection();
        }, 3000);

        // Check connection when popup gains focus (user returns from OAuth)
        window.addEventListener('focus', async () => {
            console.log('Popup gained focus - checking connection status');
            await this.checkOAuthCompletion();
            await this.checkForConnectedUsers();
            await this.checkNotionConnection();
        });

        // Check connection when popup becomes visible again
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                console.log('Popup became visible - checking connection status');
                await this.checkOAuthCompletion();
                await this.checkForConnectedUsers();
                await this.checkNotionConnection();
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
            // Notify background script that OAuth is starting
            await chrome.runtime.sendMessage({ action: 'startOAuth' });

            const authUrl = `${this.backendUrl}/auth/notion/login`;
            console.log('Opening Notion auth URL:', authUrl);

            // Store the current connection state before starting OAuth
            const wasConnected = document.getElementById('status').getAttribute('data-was-connected') === 'true';

            // Open Notion authorization in a popup window
            const popup = window.open(
                authUrl,
                'notion_auth',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );

            console.log('Popup window created:', popup);

            if (!popup) {
                throw new Error('Popup blocked. Please allow popups for this extension.');
            }

            // Show connecting message
            this.showMessage('Connecting to Notion... Please complete the authorization in the popup window.', 'success');

            // Listen for popup close
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    console.log('OAuth popup window closed');
                    clearInterval(checkClosed);

                    // Check for OAuth completion after popup closes
                    setTimeout(async () => {
                        await this.checkOAuthCompletion();
                        await this.checkNotionConnection();
                    }, 2000);
                }
            }, 1000);

        } catch (error) {
            console.error('Error connecting to Notion:', error);
            this.showMessage('Failed to connect to Notion', 'error');
        }
    }

    async summarizeCurrentPage() {
        try {
            this.showLoading(true);

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

            // Summarize using OpenAI (client-side)
            const summary = await this.summarizeWithOpenAI(content, openaiKey);

            // Save to Notion via backend
            const notionPageUrl = await this.saveToNotion(summary, tab.url, tab.title);

            this.showSuccessWithLink('Article summarized and saved to Notion!', notionPageUrl);

        } catch (error) {
            console.error('Error summarizing page:', error);
            this.showMessage(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
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
            console.log('Saved to Notion:', data.page_url);
            return data.page_url; // Return the page URL

        } catch (error) {
            throw new Error(`Failed to save to Notion: ${error.message}`);
        }
    }

    testPopupWindow() {
        console.log('Testing popup window functionality');
        const testPopup = window.open(
            'https://www.google.com',
            'test_popup',
            'width=400,height=300,scrollbars=yes,resizable=yes'
        );

        if (testPopup) {
            console.log('Test popup created successfully');
            this.showMessage('Test popup created successfully!', 'success');
        } else {
            console.log('Test popup blocked');
            this.showMessage('Popup blocked. Please allow popups for this extension.', 'error');
        }
    }

    async debugConnection() {
        console.log('=== DEBUG CONNECTION ===');
        console.log('User ID:', this.userId);
        console.log('Backend URL:', this.backendUrl);

        try {
            const response = await fetch(`${this.backendUrl}/debug/user/${this.userId}`);
            const data = await response.json();
            console.log('Debug data:', data);
            this.showMessage(`Debug: ${JSON.stringify(data, null, 2)}`, 'success');
        } catch (error) {
            console.error('Debug error:', error);
            this.showMessage(`Debug error: ${error.message}`, 'error');
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = show ? 'block' : 'none';
    }

    showMessage(message, type) {
        const errorElement = document.getElementById('error');
        const successElement = document.getElementById('success');

        // Hide both elements
        errorElement.style.display = 'none';
        successElement.style.display = 'none';

        // Show the appropriate message
        if (type === 'error') {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else if (type === 'success') {
            successElement.textContent = message;
            successElement.style.display = 'block';
        }

        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                successElement.style.display = 'none';
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
        linkContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        linkContainer.style.borderRadius = '4px';
        linkContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';

        // Create the link text
        const linkText = document.createElement('div');
        linkText.textContent = '🔗 View in Notion';
        linkText.style.fontSize = '12px';
        linkText.style.color = 'rgba(255, 255, 255, 0.8)';
        linkText.style.marginBottom = '4px';

        // Create the clickable link
        const linkElement = document.createElement('a');
        linkElement.href = notionUrl;
        linkElement.textContent = 'Open Saved Summary';
        linkElement.target = '_blank';
        linkElement.style.color = '#FFFFFF';
        linkElement.style.textDecoration = 'none';
        linkElement.style.fontWeight = 'bold';
        linkElement.style.fontSize = '13px';
        linkElement.style.display = 'block';
        linkElement.style.padding = '4px';
        linkElement.style.borderRadius = '3px';
        linkElement.style.transition = 'background-color 0.2s';

        // Add hover effect
        linkElement.addEventListener('mouseenter', () => {
            linkElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
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
            // Check if OpenAI key is actually saved in storage (not just typed)
            const result = await chrome.storage.sync.get(['openaiApiKey']);
            const savedOpenaiKey = result.openaiApiKey;
            const isConnectedToNotion = statusElement.className.includes('connected');

            // Hide Save Settings button only if both Notion is connected AND OpenAI key is SAVED
            if (savedOpenaiKey && savedOpenaiKey.trim() && isConnectedToNotion) {
                saveSettingsBtn.style.display = 'none';
                console.log('Save Settings button hidden - fully configured');
            } else {
                saveSettingsBtn.style.display = 'block';
                console.log('Save Settings button shown - configuration needed');
            }
        }
    }

    async updateUIState() {
        const statusElement = document.getElementById('status');
        const summarizeBtn = document.getElementById('summarizeBtn');

        if (!statusElement || !summarizeBtn) return;

        const isConnectedToNotion = statusElement.className.includes('connected');

        // Check if OpenAI key is saved
        const result = await chrome.storage.sync.get(['openaiApiKey']);
        const savedOpenaiKey = result.openaiApiKey;
        const hasOpenaiKey = savedOpenaiKey && savedOpenaiKey.trim();

        // Enable summarize button only if BOTH conditions are met
        if (isConnectedToNotion && hasOpenaiKey) {
            summarizeBtn.disabled = false;
            console.log('Summarize button enabled - both Notion and OpenAI configured');
        } else {
            summarizeBtn.disabled = true;
            if (!isConnectedToNotion) {
                console.log('Summarize button disabled - Notion not connected');
            }
            if (!hasOpenaiKey) {
                console.log('Summarize button disabled - OpenAI key not saved');
            }
        }

        // Update save settings visibility
        await this.updateSaveSettingsVisibility();
    }
}

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SummarizeItPopup();
});