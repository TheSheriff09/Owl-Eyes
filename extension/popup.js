document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const mainSection = document.getElementById('mainSection');
    const statusDiv = document.getElementById('status');
    const questionInput = document.getElementById('question');
    const defaultQuestionInput = document.getElementById('defaultQuestion');
    const captureBtn = document.getElementById('captureAndAsk');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const resultDiv = document.getElementById('result');
    const debugStatus = document.getElementById('debugStatus');
    const debugApiKey = document.getElementById('debugApiKey');
    const debugLastAction = document.getElementById('debugLastAction');
    const debugInfo = document.getElementById('debugInfo');
    const testCaptureBtn = document.getElementById('testCapture');

    function updateDebugInfo(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const newMessage = `[${timestamp}] ${message}`;
        debugInfo.innerHTML = newMessage + '<br>' + debugInfo.innerHTML;
        
        if (type === 'error') {
            debugInfo.style.color = '#c53030';
        } else if (type === 'success') {
            debugInfo.style.color = '#2c5530';
        } else {
            debugInfo.style.color = '#666';
        }
        
        console.log(`Owl Eyes Debug: ${message}`);
    }

    chrome.storage.local.get(['geminiApiKey', 'defaultQuestion'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            mainSection.classList.remove('hidden');
            statusDiv.textContent = "✅ Ready! Press C key to capture and analyze";
            statusDiv.className = 'status active';
            debugApiKey.textContent = 'Set (hidden)';
            debugStatus.textContent = 'Active';
            updateDebugInfo('Extension loaded successfully with API key');
        } else {
            debugStatus.textContent = 'Inactive - No API key';
            updateDebugInfo('Extension loaded - Please set API key');
        }
        
        if (result.defaultQuestion) {
            defaultQuestionInput.value = result.defaultQuestion;
        }
    });

    saveApiKeyBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({geminiApiKey: apiKey}, function() {
                mainSection.classList.remove('hidden');
                statusDiv.textContent = "✅ Ready! Press C key to capture and analyze";
                statusDiv.className = 'status active';
                debugApiKey.textContent = 'Set (hidden)';
                debugStatus.textContent = 'Active';
                updateDebugInfo('API key saved successfully', 'success');
                alert('🦉 API key saved successfully! Press C on any webpage to capture and analyze.');
            });
        } else {
            updateDebugInfo('No API key entered', 'error');
            alert('Please enter a valid API key');
        }
    });

    saveSettingsBtn.addEventListener('click', function() {
        const defaultQuestion = defaultQuestionInput.value.trim();
        chrome.storage.local.set({defaultQuestion: defaultQuestion}, function() {
            updateDebugInfo('Settings saved successfully', 'success');
            alert('Settings saved!');
        });
    });

    captureBtn.addEventListener('click', async function() {
        const question = questionInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!question) {
            updateDebugInfo('No question entered for manual capture', 'error');
            alert('Please enter a question');
            return;
        }

        if (!apiKey) {
            updateDebugInfo('No API key set for manual capture', 'error');
            alert('Please enter your Gemini API key');
            return;
        }

        captureBtn.disabled = true;
        debugLastAction.textContent = 'Manual capture initiated';
        updateDebugInfo('Starting manual screen capture...');
        resultDiv.innerHTML = '<div class="loading">🦉 Capturing screen and analyzing with Gemini...</div>';

        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            updateDebugInfo(`Capturing tab: ${tab.url}`);
            
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
            updateDebugInfo('✅ Screenshot captured successfully', 'success');
            
            updateDebugInfo('Sending to Gemini API...');
            const response = await sendToGemini(dataUrl, question, apiKey);
            updateDebugInfo('✅ Gemini analysis complete', 'success');
            
            resultDiv.innerHTML = `<strong>🦉 Gemini Analysis:</strong><br><br>${response || 'No response from Gemini'}`;
            debugLastAction.textContent = 'Manual capture completed successfully';
            
        } catch (error) {
            console.error('Error:', error);
            updateDebugInfo(`❌ Error: ${error.message}`, 'error');
            resultDiv.innerHTML = `❌ Error: ${error.message}`;
            debugLastAction.textContent = 'Manual capture failed';
        } finally {
            captureBtn.disabled = false;
        }
    });

    testCaptureBtn.addEventListener('click', async function() {
        updateDebugInfo('Testing screen capture...');
        
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            updateDebugInfo(`Testing capture on: ${tab.url}`);
            
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
            
            if (dataUrl && dataUrl.startsWith('data:image/png')) {
                updateDebugInfo('✅ Test capture SUCCESSFUL! Screenshot captured.', 'success');
                
                showTestResultDialog('✅ Screenshot Captured Successfully!\n\nImage size: ' + 
                    Math.round(dataUrl.length / 1024) + ' KB\n\nYou can now press C key on any page to capture and analyze.');
            } else {
                updateDebugInfo('❌ Test capture FAILED: Invalid image data', 'error');
                showTestResultDialog('❌ Screenshot capture failed. Please check permissions.');
            }
        } catch (error) {
            updateDebugInfo(`❌ Test capture ERROR: ${error.message}`, 'error');
            showTestResultDialog(`❌ Screenshot capture error: ${error.message}`);
        }
    });

    async function sendToGemini(imageDataUrl, question, apiKey) {
        const base64Image = imageDataUrl.split(',')[1];
        
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: question
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

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    function showTestResultDialog(message) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            text-align: center;
            border: 3px solid #2c5530;
        `;
        
        dialog.innerHTML = `
            <h3>🦉 Owl Eyes Test</h3>
            <div style="margin: 15px 0; white-space: pre-wrap;">${message}</div>
            <button onclick="this.parentElement.remove()" style="
                background: #2c5530;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">OK</button>
        `;
        
        document.body.appendChild(dialog);
    }

    questionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            captureBtn.click();
        }
    });

    updateDebugInfo('Popup initialized successfully');
});