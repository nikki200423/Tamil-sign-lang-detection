document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const startBtn = document.getElementById('startBtn');
    const captureBtn = document.getElementById('captureBtn');
    const detectBtn = document.getElementById('detectBtn');
    const realTimeBtn = document.getElementById('realTimeBtn');
    const detectedSign = document.getElementById('detectedSign');
    const detectedSignOverlay = document.getElementById('detectedSignOverlay');
    const confidence = document.getElementById('confidence');
    const debugImage = document.getElementById('debugImage');
    const dictionaryContent = document.getElementById('dictionaryContent');
    const currentSentence = document.getElementById('currentSentence');
    const addToSentenceBtn = document.getElementById('addToSentenceBtn');
    const speakBtn = document.getElementById('speakBtn');
    const clearBtn = document.getElementById('clearBtn');
    const englishTranslation = document.getElementById('englishTranslation');
    
    // Canvas context
    const ctx = canvas.getContext('2d');
    
    // Application state
    let stream;
    let isRealTimeDetection = false;
    let detectionInterval;
    let lastDetectedSign = '';
    let detectionCooldown = false;
    
    // Dictionary of Tamil sign language with English translations
    const tamilSigns = [
        { id: 'a', label: 'அ', english: 'a', meaning: 'that', image: 'images/signs/a.png' },
        { id: 'aa', label: 'ஆ', english: 'aa', meaning: 'cow', image: 'images/signs/aa.png' },
        { id: 'e', label: 'இ', english: 'i', meaning: 'this', image: 'images/signs/e.png' },
        { id: 'ee', label: 'ஈ', english: 'ee', meaning: 'fly', image: 'images/signs/ee.png' },
        { id: 'u', label: 'உ', english: 'u', meaning: 'food', image: 'images/signs/u.png' },
        { id: 'uu', label: 'ஊ', english: 'oo', meaning: 'blow', image: 'images/signs/uu.png' },
        { id: 'ae', label: 'எ', english: 'e', meaning: 'which', image: 'images/signs/ae.png' },
        { id: 'aee', label: 'ஏ', english: 'ae', meaning: 'why', image: 'images/signs/aee.png' },
        { id: 'ai', label: 'ஐ', english: 'ai', meaning: 'five', image: 'images/signs/ai.png' },
        { id: 'o', label: 'ஒ', english: 'o', meaning: 'one', image: 'images/signs/o.png' },
        { id: 'oo', label: 'ஓ', english: 'oa', meaning: 'run', image: 'images/signs/oo.png' },
        { id: 'au', label: 'ஔ', english: 'au', meaning: 'beauty', image: 'images/signs/au.png' },
        { id: 'ka', label: 'க', english: 'ka', meaning: 'eye', image: 'images/signs/ka.png' },
        { id: 'nga', label: 'ங', english: 'nga', meaning: 'good', image: 'images/signs/nga.png' },
        { id: 'sa', label: 'ச', english: 'sa', meaning: 'die', image: 'images/signs/sa.png' },
        { id: 'nya', label: 'ஞ', english: 'nya', meaning: 'wisdom', image: 'images/signs/nya.png' },
        { id: 'ta', label: 'ட', english: 'ta', meaning: 'obstacle', image: 'images/signs/ta.png' },
        { id: 'na', label: 'ந', english: 'na', meaning: 'good', image: 'images/signs/na.png' },
        { id: 'tha', label: 'த', english: 'tha', meaning: 'give', image: 'images/signs/tha.png' },
        { id: 'nha', label: 'ன', english: 'nha', meaning: 'I/me', image: 'images/signs/nha.png' }
    ];

    // Common Tamil words and phrases
    const tamilPhrases = {
        'வணக்கம்': 'Hello/Greetings',
        'நன்றி': 'Thank you',
        'எப்படி இருக்கிறீர்கள்': 'How are you',
        'நான் நலமாக இருக்கிறேன்': 'I am fine',
        'உங்கள் பெயர் என்ன': 'What is your name',
        'என் பெயர்': 'My name is',
        'சந்தோஷமாக இருங்கள்': 'Be happy',
        'நான் உங்களை காதலிக்கிறேன்': 'I love you',
        'உதவி': 'Help',
        'தயவு செய்து': 'Please'
    };
    
    // Populate dictionary
    function populateDictionary() {
        tamilSigns.forEach(sign => {
            const item = document.createElement('div');
            item.className = 'dictionary-item';
            item.setAttribute('data-id', sign.id);
            item.setAttribute('data-label', sign.label);
            item.setAttribute('data-english', sign.english);
            item.setAttribute('data-meaning', sign.meaning);
            
            // Use placeholder images since real images might not be available
            const img = document.createElement('div');
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.backgroundColor = '#eee';
            img.style.display = 'flex';
            img.style.alignItems = 'center';
            img.style.justifyContent = 'center';
            img.style.margin = '0 auto 5px auto';
            img.style.borderRadius = '5px';
            img.textContent = sign.label;
            
            const label = document.createElement('div');
            label.textContent = sign.label;
            
            item.appendChild(img);
            item.appendChild(label);
            dictionaryContent.appendChild(item);
        });
    }
    
    // Start webcam
    startBtn.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            
            // Set video dimensions
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                startBtn.disabled = true;
                captureBtn.disabled = false;
                realTimeBtn.disabled = false;
            });
        } catch (err) {
            console.error('Error accessing webcam:', err);
            alert('Unable to access the webcam. Please ensure you have granted permission.');
        }
    });
    
    // Capture image
    captureBtn.addEventListener('click', () => {
        canvas.style.display = 'block';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        detectBtn.disabled = false;
    });
    
    // Send to backend for detection
    detectBtn.addEventListener('click', async () => {
        await detectSign();
    });
    
    // Toggle real-time detection
    realTimeBtn.addEventListener('click', () => {
        isRealTimeDetection = !isRealTimeDetection;
        video.classList.toggle('active-detection', isRealTimeDetection);
        
        if (isRealTimeDetection) {
            realTimeBtn.textContent = 'Stop Real-time Detection';
            realTimeBtn.style.backgroundColor = '#ff6b6b';
            startRealTimeDetection();
        } else {
            realTimeBtn.textContent = 'Start Real-time Detection';
            realTimeBtn.style.backgroundColor = '#8470ff';
            stopRealTimeDetection();
        }
    });
    
    // Start real-time detection
    function startRealTimeDetection() {
        // Check if the interval is already set
        if (detectionInterval) return;
        
        detectionInterval = setInterval(async () => {
            if (detectionCooldown) return;
            
            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Set cooldown to prevent too frequent API calls
            detectionCooldown = true;
            
            // Detect sign
            await detectSign(true);
            
            // Reset cooldown after a delay
            setTimeout(() => {
                detectionCooldown = false;
            }, 1000); // 1 second cooldown
        }, 1500); // Check every 1.5 seconds
    }
    
    // Stop real-time detection
    function stopRealTimeDetection() {
        clearInterval(detectionInterval);
        detectionInterval = null;
        detectedSignOverlay.style.display = 'none';
    }
    
    // Detect sign function
    async function detectSign(isRealTime = false) {
        try {
            // Convert canvas to blob
            const imageBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg');
            });
            
            // Create form data to send the image
            const formData = new FormData();
            formData.append('image', imageBlob, 'sign.jpg');
            
            // Show loading state
            if (!isRealTime) {
                detectedSign.textContent = 'Processing...';
                confidence.textContent = 'Please wait';
            }
            
            // In a real application, you would send this to your Python backend
            // For demo purposes, simulate a response
            setTimeout(() => {
                simulateDetection(isRealTime);
            }, isRealTime ? 300 : 1000);
            
            /* Actual API call would look like this:
            const response = await fetch('/api/detect', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                updateDetection(result.sign, result.confidence, result.debug_image, isRealTime);
            } else {
                throw new Error('Failed to detect sign');
            }
            */
        } catch (err) {
            console.error('Error in detection:', err);
            detectedSign.textContent = 'Error';
            confidence.textContent = 'Detection failed';
        }
    }
    
    // Update detection UI
    function updateDetection(sign, confidenceValue, debugImageUrl, isRealTime) {
        // Update the detected sign
        lastDetectedSign = sign;
        
        // Update main UI
        detectedSign.textContent = sign;
        confidence.textContent = `Confidence: ${confidenceValue}%`;
        
        // Enable add to sentence button
        addToSentenceBtn.disabled = false;
        
        // Update overlay for real-time detection
        if (isRealTime) {
            detectedSignOverlay.textContent = sign;
            detectedSignOverlay.style.display = 'block';
            
            // Hide overlay after 3 seconds
            setTimeout(() => {
                detectedSignOverlay.style.display = 'none';
            }, 3000);
        }
        
        // Update debug image if available
        if (debugImageUrl) {
            const img = document.createElement('img');
            img.src = debugImageUrl;
            img.alt = 'Debug Image';
            debugImage.innerHTML = '';
            debugImage.appendChild(img);
            img.style.display = 'block';
        }
        
        // Highlight the detected sign in the dictionary
        const dictItems = document.querySelectorAll('.dictionary-item');
        dictItems.forEach(item => {
            item.style.backgroundColor = 'transparent';
            if (item.getAttribute('data-label') === sign) {
                item.style.backgroundColor = '#e6f7ff';
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
    
    // Simulate detection for demo purposes
    function simulateDetection(isRealTime) {
        const randomIndex = Math.floor(Math.random() * tamilSigns.length);
        const sign = tamilSigns[randomIndex];
        const confidenceValue = (70 + Math.random() * 25).toFixed(1);
        
        updateDetection(sign.label, confidenceValue, null, isRealTime);
    }
    
    // Add to sentence
    addToSentenceBtn.addEventListener('click', () => {
        if (!lastDetectedSign) return;
        
        // Find the sign details
        const sign = tamilSigns.find(s => s.label === lastDetectedSign);
        
        if (sign) {
            // Add to sentence
            const signSpan = document.createElement('span');
            signSpan.textContent = sign.label;
            signSpan.className = 'sentence-sign';
            signSpan.title = sign.meaning;
            
            // Add a space if not the first sign
            if (currentSentence.textContent) {
                currentSentence.appendChild(document.createTextNode(' '));
            }
            
            currentSentence.appendChild(signSpan);
            
            // Update translation
            updateTranslation();
            
            // Enable speak button if there's text
            speakBtn.disabled = false;
        }
    });
    
    // Update translation
    function updateTranslation() {
        const sentenceSigns = currentSentence.querySelectorAll('.sentence-sign');
        
        if (sentenceSigns.length === 0) {
            englishTranslation.textContent = '-';
            return;
        }
        
        // Get Tamil sentence
        const tamilSentence = Array.from(sentenceSigns).map(sign => sign.textContent).join(' ');
        
        // Check if it matches any known phrases
        if (tamilPhrases[tamilSentence]) {
            englishTranslation.textContent = tamilPhrases[tamilSentence];
            return;
        }
        
        // Translate individual signs
        const englishWords = Array.from(sentenceSigns).map(sign => {
            const tamilSign = sign.textContent;
            const signObj = tamilSigns.find(s => s.label === tamilSign);
            return signObj ? signObj.meaning : tamilSign;
        });
        
        englishTranslation.textContent = englishWords.join(' ');
    }
    
    // Speak the translation
    speakBtn.addEventListener('click', () => {
        const textToSpeak = englishTranslation.textContent;
        
        if (textToSpeak && textToSpeak !== '-') {
            // Use Web Speech API for speech synthesis
            const speech = new SpeechSynthesisUtterance(textToSpeak);
            speech.lang = 'en-US';
            speechSynthesis.speak(speech);
        }
    });
    
    // Clear sentence
    clearBtn.addEventListener('click', () => {
        currentSentence.innerHTML = '';
        englishTranslation.textContent = '-';
        speakBtn.disabled = true;
    });
    
    // Dictionary item click handler
    dictionaryContent.addEventListener('click', (event) => {
        const item = event.target.closest('.dictionary-item');
        if (item) {
            const label = item.getAttribute('data-label');
            const english = item.getAttribute('data-english');
            const meaning = item.getAttribute('data-meaning');
            
            lastDetectedSign = label;
            detectedSign.textContent = label;
            confidence.textContent = 'Dictionary selection';
            addToSentenceBtn.disabled = false;
            
            // Show meaning as a tooltip or info text
            const meaningInfo = `${label} (${english}) - ${meaning}`;
            alert(meaningInfo);
        }
    });
    
    // Initialize
    populateDictionary();
});
