#!/usr/bin/env node

// Simple test script to verify connection detection
const fetch = require('node-fetch');

async function testConnection() {
    const backendUrl = 'http://localhost:8000';
    const userId = 'c425202e-f79f-40e2-98e4-aecacac9ec4e'; // Use the known user ID

    console.log('Testing connection for user:', userId);

    try {
        // Test status endpoint
        const statusResponse = await fetch(`${backendUrl}/user/${userId}/status`);
        const statusData = await statusResponse.json();
        console.log('Status response:', statusData);

        // Test debug endpoint
        const debugResponse = await fetch(`${backendUrl}/debug/user/${userId}`);
        const debugData = await debugResponse.json();
        console.log('Debug response:', debugData);

        if (statusData.connected) {
            console.log('✅ User is connected to Notion');
        } else {
            console.log('❌ User is not connected to Notion');
        }

    } catch (error) {
        console.error('Error testing connection:', error);
    }
}

testConnection();