// Content script for Noted Chrome Extension
// This script runs on every page to extract readable content

(function() {
    'use strict';

    // Listen for messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractContent') {
            const content = extractReadableContent();
            sendResponse({ content: content });
        }
    });

    function extractReadableContent() {
        // Try multiple strategies to extract the best content

        // Strategy 1: Use Readability.js if available
        if (typeof Readability !== 'undefined') {
            return extractWithReadability();
        }

        // Strategy 2: Look for article tags
        const article = document.querySelector('article');
        if (article) {
            return cleanText(article.textContent);
        }

        // Strategy 3: Look for main content area
        const main = document.querySelector('main');
        if (main) {
            return cleanText(main.textContent);
        }

        // Strategy 4: Look for content-specific selectors
        const contentSelectors = [
            '.content',
            '.post-content',
            '.entry-content',
            '.article-content',
            '.story-content',
            '.post-body',
            '.entry-body',
            '.article-body'
        ];

        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                return cleanText(element.textContent);
            }
        }

        // Strategy 5: Fallback to body content
        return extractBodyContent();
    }

    function extractWithReadability() {
        try {
            const documentClone = document.cloneNode(true);
            const reader = new Readability(documentClone);
            const article = reader.parse();
            return cleanText(article.textContent);
        } catch (error) {
            console.error('Readability extraction failed:', error);
            return extractBodyContent();
        }
    }

    function extractBodyContent() {
        const body = document.body.cloneNode(true);

        // Remove unwanted elements
        const selectorsToRemove = [
            'script',
            'style',
            'nav',
            'header',
            'footer',
            'aside',
            '.sidebar',
            '.navigation',
            '.menu',
            '.advertisement',
            '.ads',
            '.social-share',
            '.comments',
            '.related-posts',
            '.newsletter',
            '.popup',
            '.modal',
            '.overlay'
        ];

        selectorsToRemove.forEach(selector => {
            const elements = body.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        return cleanText(body.textContent);
    }

    function cleanText(text) {
        if (!text) return '';

        return text
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
            .trim();
    }

    // Expose function globally for debugging
    window.extractReadableContent = extractReadableContent;

    console.log('Noted content script loaded');
})();