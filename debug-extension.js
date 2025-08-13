// Debug script to test your extension's backend connection
// Run this in Chrome DevTools Console

async function testBackend() {
    const backendUrl = 'https://noted-six.vercel.app';

    console.log('🧪 Testing Noted Extension Backend...');

    try {
        // Test main endpoint
        console.log('1. Testing main API...');
        const mainResponse = await fetch(`${backendUrl}/`);
        const mainData = await mainResponse.json();
        console.log('✅ Main API:', mainData);

        // Test OAuth check
        console.log('2. Testing OAuth check...');
        const oauthResponse = await fetch(`${backendUrl}/oauth/check-completion`);
        const oauthData = await oauthResponse.json();
        console.log('✅ OAuth check:', oauthData);

        // Test CORS
        console.log('3. Testing CORS headers...');
        console.log('Response headers:', Object.fromEntries([...oauthResponse.headers.entries()]));

        console.log('🎉 All tests passed! Your extension should work.');

    } catch (error) {
        console.error('❌ Backend test failed:', error);

        // Test if it's a CORS issue
        if (error.message.includes('CORS')) {
            console.log('💡 This looks like a CORS issue. Check if your extension has the right permissions.');
        }
    }
}

// Run the test
testBackend();
