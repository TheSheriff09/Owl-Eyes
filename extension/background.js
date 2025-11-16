console.log('🦉 Owl Eyes background script loaded');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('🦉 Background received message:', request);
    
    if (request.action === "captureScreenshot") {
        console.log('🦉 Starting screenshot capture process...');
        captureAndAnalyze(request.question)
            .then(() => {
                console.log('🦉 Capture process completed successfully');
                sendResponse({status: "success", message: "Analysis complete"});
            })
            .catch(error => {
                console.error('🦉 Capture process failed:', error);
                sendResponse({status: "error", error: error.message});
            });
        return true;
    } else if (request.action === "testConnection") {
        console.log('🦉 Test connection received');
        sendResponse({status: "connected", message: "Background script is working"});
        return true;
    }
});

async function captureAndAnalyze(question) {
    let currentTab = null;
    
    try {
        console.log('🦉 Starting capture and analyze process...');
        
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        currentTab = tab;
        
        if (!tab) {
            throw new Error('No active tab found');
        }

        console.log('🦉 Active tab found:', tab.url);

        const data = await chrome.storage.local.get(['geminiApiKey']);
        const apiKey = data.geminiApiKey;

        if (!apiKey) {
            throw new Error("Please set your Gemini API key in the Owl Eyes extension popup first.");
        }

        console.log('🦉 API key found, starting screenshot capture...');
        
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: "processing",
                message: "Capturing screen..."
            });
        } catch (error) {
            console.warn('🦉 Could not send processing message:', error);
        }

        console.log('🦉 Calling chrome.tabs.captureVisibleTab...');
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
        
        if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
            throw new Error('Failed to capture screenshot');
        }

        console.log('🦉 ✅ Screenshot captured successfully');
        
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: "processing", 
                message: "Analyzing with Gemini..."
            });
        } catch (error) {
            console.warn('🦉 Could not send capture success message:', error);
        }

        console.log('🦉 Sending screenshot to Gemini API...');
        const response = await sendToGemini(dataUrl, apiKey);
        
        console.log('🦉 ✅ Got response from Gemini:', response);
        
        await chrome.tabs.sendMessage(tab.id, {
            action: "showResult",
            result: response
        });
        
        console.log('🦉 ✅ Analysis complete!');

    } catch (error) {
        console.error('🦉 ❌ Error in captureAndAnalyze:', error);
        
        if (currentTab) {
            try {
                await chrome.tabs.sendMessage(currentTab.id, {
                    action: "showError",
                    error: error.message
                });
            } catch (sendError) {
                console.error('🦉 Failed to send error to content script:', sendError);
            }
        }
        
        throw error;
    }
}

async function sendToGemini(imageDataUrl, apiKey) {
    const base64Image = imageDataUrl.split(',')[1];
    
    if (!base64Image) {
        throw new Error('Failed to process screenshot image');
    }

    console.log('🦉 🌐 Making API request to Gemini...');
    
    const requestBody = {
        contents: [{
            parts: [
                {
                    text: `You are an expert tutor. Analyze this educational image and provide direct answers.

SPECIFIC CASES:
- Matching questions: Guess logical matches like "1-A, 2-B, 3-C"
- Multiple choice: Single letter like "C"  
- Math: Numbers only like "42"
- Incomplete questions: Make reasonable assumptions
- Definitions: Key terms only

EDUCATION RULES:
- Individual Action = personal choice/benefit
- Group/Collective = shared interests  
- Organization = formal structure/rules
- Science = standard textbook answers
- Math = calculate directly

FORMAT: 2-5 words maximum, no explanations

If you see a matching question about individual/group/organization, provide the most logical matches based on standard sociology definitions.`
                },
                {
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Image
                    }
                }
            ]
        }]
    };

    const models = [
        'gemini-2.5-flash'
    ];

    let lastError = null;
    
    for (const model of models) {
        try {
            console.log(`🦉 Trying model: ${model}`);
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log(`🦉 ✅ Success with model: ${model}`);
                return data.candidates[0].content.parts[0].text;
            } else {
                const errorData = await response.json();
                lastError = errorData.error?.message || `Model ${model} failed with status ${response.status}`;
                console.log(`🦉 Model ${model} failed:`, lastError);
            }
        } catch (error) {
            lastError = error.message;
            console.log(`🦉 Model ${model} error:`, error.message);
        }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('🦉 🎉 Extension installed successfully!');
    }
});

console.log('🦉 ✅ Owl Eyes background script initialized successfully');