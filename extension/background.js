// Background service worker for Noted Chrome Extension

// Store OAuth state
let oauthState = {
    isInProgress: false,
    completionData: null,
    lastCheck: null
};

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Noted extension installed');
    }
});



// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup automatically due to manifest configuration
    console.log('Extension icon clicked');
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        console.log('Storage changed:', changes);
    }
});

// Handle errors
chrome.runtime.onSuspend.addListener(() => {
    console.log('Noted extension suspended');
});

// Monitor for OAuth completion by checking backend status
async function checkOAuthCompletion() {
    if (!oauthState.isInProgress) {
        return;
    }

    try {
        // Check if OAuth completion occurred by checking for new users
        const response = await fetch(`https://noted-six.vercel.app/oauth/check-completion`);
        const completionData = await response.json();

        console.log('OAuth completion check:', completionData);

        let connectedUserId = null;
        if (completionData.has_users && completionData.latest_user_id) {
            // Check if this user is connected
            try {
                const userResponse = await fetch(`https://noted-six.vercel.app/user/${completionData.latest_user_id}/status`);
                const userData = await userResponse.json();

                console.log(`User ${completionData.latest_user_id} status:`, userData);

                if (userData.connected) {
                    connectedUserId = completionData.latest_user_id;
                    console.log('✅ OAuth completion detected for user:', connectedUserId);

                    // Store the successful user ID to prevent re-processing
                    await chrome.storage.local.set({
                        'lastConnectedUser': connectedUserId,
                        'lastConnectionTime': Date.now()
                    });
                }
            } catch (error) {
                console.error(`Error checking user ${completionData.latest_user_id}:`, error);
            }
        } else {
            console.log('No users found or latest_user_id missing');
        }

        if (connectedUserId) {
            // OAuth completed successfully
            oauthState.isInProgress = false;
            oauthState.completionData = {
                status: 'success',
                userId: connectedUserId,
                timestamp: Date.now()
            };
            oauthState.lastCheck = Date.now();

            console.log('🎉 OAuth completed successfully!');

            // Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Noted',
                message: 'Successfully connected to Notion!'
            });
        } else {
            // Still not connected, update last check time
            oauthState.lastCheck = Date.now();
            console.log('OAuth still in progress...');
        }
    } catch (error) {
        console.error('Error checking OAuth completion:', error);
        oauthState.lastCheck = Date.now();
    }
}

// Set up periodic OAuth completion checking
let oauthCheckInterval = null;

function startOAuthMonitoring() {
    if (oauthCheckInterval) {
        clearInterval(oauthCheckInterval);
    }

    oauthCheckInterval = setInterval(() => {
        if (oauthState.isInProgress) {
            checkOAuthCompletion();
        }
    }, 1000); // Check every 1 second for faster detection

}

function stopOAuthMonitoring() {
    if (oauthCheckInterval) {
        clearInterval(oauthCheckInterval);
        oauthCheckInterval = null;
    }
}

// Start monitoring when OAuth is in progress
function handleOAuthMessages(request, sender, sendResponse) {
    if (request.action === 'startOAuth') {
        startOAuthMonitoring();
    }

    if (request.action === 'clearOAuthState') {
        stopOAuthMonitoring();
    }
}

// Add the OAuth message handler to the existing listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === 'getTabInfo') {
        // Get current tab information
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendResponse({
                    url: tabs[0].url,
                    title: tabs[0].title,
                    id: tabs[0].id
                });
            }
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'extractContent') {
        // Extract content from current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: () => {
                        // This function runs in the context of the web page
                        return window.extractReadableContent ? window.extractReadableContent() : document.body.textContent;
                    }
                }, (results) => {
                    if (results && results[0]) {
                        sendResponse({ content: results[0].result });
                    } else {
                        sendResponse({ content: null });
                    }
                });
            }
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'startOAuth') {
        // Clear any previous OAuth state
        oauthState = {
            isInProgress: true,
            completionData: null,
            lastCheck: Date.now()
        };

        console.log('🚀 Starting OAuth monitoring...');
        startOAuthMonitoring();
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'getOAuthStatus') {
        // Return current OAuth status
        sendResponse({
            isInProgress: oauthState.isInProgress,
            completionData: oauthState.completionData,
            lastCheck: oauthState.lastCheck
        });
        return true;
    }

    if (request.action === 'clearOAuthState') {
        // Clear OAuth state
        oauthState = {
            isInProgress: false,
            completionData: null,
            lastCheck: null
        };
        stopOAuthMonitoring();
        sendResponse({ success: true });
        return true;
    }
});

// Keep service worker alive (only if alarms permission is available)
if (chrome.alarms) {
    chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'keepAlive') {
            console.log('Service worker kept alive');
        }
    });
} else {
    console.log('alarms API not available - service worker will use default lifecycle');
}