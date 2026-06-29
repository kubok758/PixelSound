document.addEventListener("DOMContentLoaded", () => {
    // Toast Notification System
    function showToast(message, type = "info") {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 380px;
                width: calc(100% - 48px);
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            padding: 14px 20px;
            border-radius: 12px;
            background: rgba(18, 18, 22, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            font-family: 'Outfit', sans-serif;
            font-size: 0.9rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(12px);
            transform: translateY(-20px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
        `;

        if (type === "error") {
            toast.style.borderLeft = "4px solid #ef4444";
        } else if (type === "success") {
            toast.style.borderLeft = "4px solid #10b981";
        } else {
            toast.style.borderLeft = "4px solid #6366f1";
        }

        toast.textContent = message;
        container.appendChild(toast);

        // Trigger reflow & show
        setTimeout(() => {
            toast.style.transform = "translateY(0)";
            toast.style.opacity = "1";
        }, 10);

        // Hide & remove
        setTimeout(() => {
            toast.style.transform = "translateY(-20px)";
            toast.style.opacity = "0";
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 4000);
    }

    function resizeImageClientSide(file, maxPx) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxPx) {
                            height = Math.max(1, Math.round(height * (maxPx / width)));
                            width = maxPx;
                        }
                    } else {
                        if (height > maxPx) {
                            width = Math.max(1, Math.round(width * (maxPx / height)));
                            height = maxPx;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Не удалось сжать изображение."));
                        }
                    }, "image/png");
                };
                img.onerror = () => reject(new Error("Не удалось загрузить изображение."));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
            reader.readAsDataURL(file);
        });
    }

    // DOM Elements
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const previewContainer = document.getElementById("preview-container");
    const imagePreview = document.getElementById("image-preview");
    const removePreviewBtn = document.getElementById("remove-preview-btn");
    const dropZoneContent = dropZone.querySelector(".drop-zone-content");
    
    const maxPxSlider = document.getElementById("max-px-slider");
    const maxPxVal = document.getElementById("max-px-val");
    
    const uploadForm = document.getElementById("upload-form");
    const queueWarning = document.getElementById("queue-warning");
    const queueWarningText = document.getElementById("queue-warning-text");
    const historyContainer = document.getElementById("history-container");
    const historyList = document.getElementById("history-list");
    const clearHistoryBtn = document.getElementById("clear-history-btn");

    // Clear the old cookie to prevent header overflow
    document.cookie = "converted_files=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    function getHistory() {
        try {
            const val = localStorage.getItem("converted_files");
            return val ? JSON.parse(val) : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(history) {
        try {
            localStorage.setItem("converted_files", JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save history to localStorage:", e);
        }
    }

    function addToFileHistory(id, filename, previewImage) {
        let history = getHistory();
        if (!history.some(item => item.id === id)) {
            history.push({ id, filename, previewImage, timestamp: Date.now() });
            saveHistory(history);
        }
        renderHistory();
    }

    function removeFromFileHistory(id) {
        let history = getHistory();
        history = history.filter(item => item.id !== id);
        saveHistory(history);
        renderHistory();
    }

    function renderHistory() {
        const history = getHistory();
        historyContainer.style.display = "flex";
        historyList.innerHTML = "";
        
        if (history.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "empty-queue-msg";
            emptyEl.textContent = "История пуста.";
            historyList.appendChild(emptyEl);
            return;
        }
        
        history.slice().reverse().forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "queue-item";
            itemEl.innerHTML = `
                <div class="queue-item-info" style="display: flex; align-items: center; gap: 0.75rem; overflow: hidden; width: 100%;">
                    ${item.previewImage ? `<img src="${item.previewImage}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: contain; background: #000; border: 1px solid var(--card-border); image-rendering: pixelated; image-rendering: crisp-edges; flex-shrink: 0;" alt="Превью">` : ''}
                    <div style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span class="queue-item-name" title="${item.filename}">${item.filename}</span>
                        <span class="queue-item-status" style="color: var(--text-muted); font-size: 0.7rem;">
                            ${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                </div>
                <div class="queue-item-action" style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                    <button class="download-link-btn open-history-btn" data-task-id="${item.id}">Открыть</button>
                    <a class="download-link-btn download-history-btn" href="api/download/${item.id}" download>Скачать</a>
                </div>
            `;
            
            itemEl.querySelector(".open-history-btn").addEventListener("click", () => {
                loadVisualizer(item.id, item.filename);
            });

            itemEl.querySelector(".download-history-btn").addEventListener("click", async (e) => {
                e.preventDefault();
                try {
                    const res = await fetch(`api/notes/${item.id}`);
                    if (res.status === 404) {
                        showToast(`Файл "${item.filename}" больше не доступен на сервере и был удален из истории.`, "error");
                        removeFromFileHistory(item.id);
                    } else if (!res.ok) {
                        throw new Error();
                    } else {
                        const link = document.createElement("a");
                        link.href = `api/download/${item.id}`;
                        
                        // Parse name and set download attribute to guarantee extension
                        const baseName = item.filename.substring(0, item.filename.lastIndexOf('.')) || item.filename;
                        link.download = `${baseName}_pixelsound.mid`;
                        
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                } catch (err) {
                    showToast("Ошибка при скачивании файла.", "error");
                }
            });
            
            historyList.appendChild(itemEl);
        });
    }

    // Preview and Visualizer Elements
    const previewSection = document.getElementById("preview-section");
    const previewFilename = document.getElementById("preview-filename");
    const downloadMidiBtn = document.getElementById("download-midi-btn");
    const downloadAudioBtn = document.getElementById("download-audio-btn");

    // Modal Elements
    const exportModal = document.getElementById("export-modal");
    const exportModalClose = document.getElementById("export-modal-close");
    const exportStepSelect = document.getElementById("export-step-select");
    const exportStepProgress = document.getElementById("export-step-progress");
    const exportStepSuccess = document.getElementById("export-step-success");
    const formatWavCard = document.getElementById("format-wav");
    const formatMp3Card = document.getElementById("format-mp3");
    const exportProgressFill = document.getElementById("export-progress-fill");
    const exportProgressLabel = document.getElementById("export-progress-label");
    const exportStatusText = document.getElementById("export-status-text");
    const playbackPlayBtn = document.getElementById("playback-play");
    const playbackStopBtn = document.getElementById("playback-stop");
    const playbackPlayIcon = playbackPlayBtn.querySelector(".play-icon");
    const playbackPauseIcon = playbackPlayBtn.querySelector(".pause-icon");
    const progressBarBg = document.getElementById("progress-bar-bg");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const currentTimeLabel = document.getElementById("current-time");
    const totalTimeLabel = document.getElementById("total-time");
    const volumeSlider = document.getElementById("volume-control-slider");
    const pianoRollCanvas = document.getElementById("piano-roll-canvas");

    // Ambient Canvas, Sparks and Interactive Magnetism state
    const ambientCanvas = document.getElementById("ambient-canvas");
    let ambientCtx = null;
    let ambientParticles = [];
    let ambientExcitation = 0;
    let visualizerSparks = [];
    let pageMouse = { x: -1000, y: -1000 };
    let lastElapsedSeconds = 0;

    // Local state for active task tracking
    let trackedTasks = JSON.parse(localStorage.getItem("pixelsound_tasks") || "[]");

    // Synthesizer & Visualizer State
    let audioCtx = null;
    let mainGainNode = null;
    let midiNotes = [];
    let midiDuration = 0;
    let isPlaying = false;
    let playbackStartTime = 0;
    let playbackOffset = 0; // seconds
    let nextNoteIndex = 0;
    let schedulerTimerId = null;
    let animationFrameId = null;
    let selectedInstrument = 0;

    // Sync Slider value
    maxPxSlider.addEventListener("input", (e) => {
        maxPxVal.textContent = `${e.target.value} px`;
    });

    // Drag and Drop File Handlers
    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("drag-over");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("drag-over");
        }, false);
    });

    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith("image/")) {
            showToast("Пожалуйста, выберите файл изображения.", "error");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            previewContainer.style.display = "flex";
            dropZoneContent.style.visibility = "hidden";
        };
        reader.readAsDataURL(file);
    }

    // Remove Preview
    removePreviewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.value = "";
        previewContainer.style.display = "none";
        dropZoneContent.style.visibility = "visible";
        imagePreview.src = "#";
    });

    // Submit form (upload image)
    uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const files = fileInput.files;
        if (!files || files.length === 0) {
            showToast("Пожалуйста, выберите файл изображения.", "error");
            return;
        }

        const selectedInstValue = parseInt(document.getElementById("instrument-select").value);
        selectedInstrument = selectedInstValue;

        // Show loading overlay instead of removing preview
        const loadingOverlay = document.getElementById("upload-loading-overlay");
        if (loadingOverlay) loadingOverlay.style.display = "flex";
        removePreviewBtn.style.display = "none";

        try {
            const maxPx = parseInt(maxPxSlider.value);
            // Compress client-side
            const resizedBlob = await resizeImageClientSide(files[0], maxPx);

            const formData = new FormData();
            formData.append("file", resizedBlob, files[0].name);
            formData.append("max_px", maxPx);
            formData.append("instrument", selectedInstValue);

            const res = await fetch("api/convert", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                let errorMsg = "Ошибка при загрузке";
                if (res.status === 413) {
                    errorMsg = "Файл слишком большой. Максимальный размер 50 МБ.";
                } else {
                    try {
                        const err = await res.json();
                        errorMsg = err.detail || errorMsg;
                    } catch (e) {
                        errorMsg = `Ошибка сервера (${res.status})`;
                    }
                }
                throw new Error(errorMsg);
            }

            const data = await res.json();
            // Add to tracked tasks
            trackedTasks.push({
                id: data.task_id,
                filename: files[0].name,
                status: "pending"
            });
            saveTrackedTasks();
            
            // Start polling for this specific task
            pollTaskStatus(data.task_id);
        } catch (err) {
            resetUploadPreview();
            showToast(`Ошибка: ${err.message}`, "error");
        }
    });

    function resetUploadPreview() {
        const loadingOverlay = document.getElementById("upload-loading-overlay");
        if (loadingOverlay) loadingOverlay.style.display = "none";
        removePreviewBtn.style.display = "flex";
        removePreviewBtn.click();
    }

    function saveTrackedTasks() {
        localStorage.setItem("pixelsound_tasks", JSON.stringify(trackedTasks));
    }

    async function pollTaskStatus(taskId) {
        const checkStatus = async () => {
            const taskIndex = trackedTasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return true;
            
            try {
                const res = await fetch(`api/tasks/${taskId}`);
                if (!res.ok) return false;
                
                const data = await res.json();
                trackedTasks[taskIndex].status = data.status;
                saveTrackedTasks();
                
                if (data.status === "completed") {
                    addToFileHistory(taskId, trackedTasks[taskIndex].filename, data.preview_image);
                    loadVisualizer(taskId, trackedTasks[taskIndex].filename);
                    resetUploadPreview();
                    updateStats();
                    return true;
                } else if (data.status === "failed") {
                    resetUploadPreview();
                    return true;
                }
            } catch (e) {
                console.error("Error polling task status:", e);
            }
            return false;
        };

        const interval = setInterval(async () => {
            const stop = await checkStatus();
            if (stop) {
                clearInterval(interval);
            }
        }, 1500);
    }

    // Global queue statistics & Conditional load view
    async function updateQueueStats() {
        try {
            const res = await fetch("api/queue");
            if (res.ok) {
                const data = await res.json();
                const totalActiveTasks = data.pending + data.processing;
                if (totalActiveTasks > 0) {
                    if (queueWarningText) {
                        queueWarningText.textContent = `Сервер перегружен. В очереди: ${data.pending}, активных обработок: ${data.processing}.`;
                    }
                    if (queueWarning) queueWarning.style.display = "block";
                } else {
                    if (queueWarning) queueWarning.style.display = "none";
                }
            }
        } catch (e) {
            console.error("Error updating queue stats:", e);
        }
    }

    async function updateStats() {
        try {
            const res = await fetch("api/stats");
            if (res.ok) {
                const data = await res.json();
                const statsEl = document.getElementById("conversion-stats");
                if (statsEl) {
                    statsEl.textContent = `Конвертировано: ${data.total_conversions}`;
                    statsEl.style.display = "inline-block";
                }
            }
        } catch (e) {
            console.error("Error updating stats:", e);
        }
    }

    // --- Web Audio API MIDI Player & Visualizer ---

    async function loadVisualizer(taskId, filename) {
        // Stop current playback first
        stopAudio();

        previewFilename.textContent = filename;
        downloadMidiBtn.href = `api/download/${taskId}`;
        const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
        downloadMidiBtn.download = `${baseName}_pixelsound.mid`;
        previewSection.style.display = "block";
        previewSection.scrollIntoView({ behavior: "smooth" });

        try {
            const response = await fetch(`api/notes/${taskId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    showToast(`Файл "${filename}" больше не доступен на сервере и был удален из истории.`, "error");
                    removeFromFileHistory(taskId);
                    previewSection.style.display = "none";
                    return;
                }
                throw new Error("Не удалось загрузить ноты");
            }
            let data;
            try {
                data = await response.json();
            } catch (e) {
                throw new Error("Неверный формат ответа сервера");
            }
            
            const visualizerPreviewImg = document.getElementById("visualizer-preview-img");
            if (visualizerPreviewImg) {
                if (data.preview_image) {
                    visualizerPreviewImg.src = data.preview_image;
                    visualizerPreviewImg.style.display = "block";
                } else {
                    visualizerPreviewImg.style.display = "none";
                }
            }
            
            midiNotes = data.notes;
            midiDuration = data.duration;
            totalTimeLabel.textContent = formatTime(midiDuration);
            currentTimeLabel.textContent = "0:00";
            progressBarFill.style.width = "0%";
            playbackOffset = 0;

            setupCanvas();
            drawPianoRoll();
        } catch (err) {
            showToast(`Ошибка визуализации: ${err.message}`, "error");
        }
    }

    let delayNode = null;
    let delayFeedback = null;
    let delayWetGain = null;
    let activeSources = [];

    function stopAllActiveSources() {
        activeSources.forEach(s => {
            try {
                s.osc.stop();
                s.osc.disconnect();
            } catch (e) {}
        });
        activeSources = [];
    }

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            mainGainNode = audioCtx.createGain();
            mainGainNode.gain.setValueAtTime(parseFloat(volumeSlider.value), audioCtx.currentTime);
            
            // Atmospheric feedback delay (acts like a space reverb)
            delayNode = audioCtx.createDelay(1.0);
            delayNode.delayTime.setValueAtTime(0.35, audioCtx.currentTime);
            
            delayFeedback = audioCtx.createGain();
            delayFeedback.gain.setValueAtTime(0.35, audioCtx.currentTime);
            
            delayWetGain = audioCtx.createGain();
            delayWetGain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            
            // Dry mix
            mainGainNode.connect(audioCtx.destination);
            
            // Wet mix path
            mainGainNode.connect(delayNode);
            delayNode.connect(delayFeedback);
            delayFeedback.connect(delayNode); // feedback loop
            delayNode.connect(delayWetGain);
            delayWetGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    }

    function playNote(midiNumber, startTime, duration, velocity) {
        if (!audioCtx) return;
        
        // Clean up finished sources
        const now = audioCtx.currentTime;
        activeSources = activeSources.filter(s => now < s.stopTime);
        
        // Cap maximum concurrent voices to 32 to prevent glitches
        if (activeSources.length > 32) {
            return;
        }
        
        const oscs = playNoteOnContext(audioCtx, mainGainNode, midiNumber, startTime, duration, velocity);
        if (oscs && oscs.length > 0) {
            const stopTime = startTime + duration + 0.8;
            oscs.forEach(osc => {
                activeSources.push({ osc: osc, stopTime: stopTime });
            });
        }
    }

    function playNoteOnContext(audioCtx, mainGainNode, midiNumber, startTime, duration, velocity) {

        const freq = 440 * Math.pow(2, (midiNumber - 69) / 12);
        const volumeFactor = velocity / 127;
        
        const noteGain = audioCtx.createGain();
        noteGain.connect(mainGainNode);

        const filter = audioCtx.createBiquadFilter();
        filter.connect(noteGain);
        filter.type = "lowpass";

        const oscs = [];

        // Instrument sound design
        if (selectedInstrument === 10) { // Music Box
            const osc1 = audioCtx.createOscillator();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(freq, startTime);
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(freq * 4, startTime); // Chime harmonic
            
            const osc2Gain = audioCtx.createGain();
            osc2Gain.gain.setValueAtTime(0.4 * volumeFactor, startTime);
            osc2Gain.gain.setTargetAtTime(0, startTime, 0.05);
            
            osc1.connect(filter);
            osc2.connect(osc2Gain);
            osc2Gain.connect(filter);
            
            filter.Q.setValueAtTime(1, startTime);
            filter.frequency.setValueAtTime(3000, startTime);
            
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + 0.005);
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.08); // Clean release
            
            oscs.push(osc1, osc2);
            
        } else if (selectedInstrument === 19) { // Church Organ
            const osc1 = audioCtx.createOscillator();
            osc1.type = "sawtooth";
            osc1.frequency.setValueAtTime(freq, startTime);
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = "triangle";
            osc2.frequency.setValueAtTime(freq * 2, startTime);
            
            const osc2Gain = audioCtx.createGain();
            osc2Gain.gain.setValueAtTime(0.4 * volumeFactor, startTime);
            
            const osc3 = audioCtx.createOscillator();
            osc3.type = "sine";
            osc3.frequency.setValueAtTime(freq * 3, startTime);
            
            const osc3Gain = audioCtx.createGain();
            osc3Gain.gain.setValueAtTime(0.25 * volumeFactor, startTime);
            
            osc1.connect(filter);
            osc2.connect(osc2Gain);
            osc2Gain.connect(filter);
            osc3.connect(osc3Gain);
            osc3Gain.connect(filter);
            
            filter.frequency.setValueAtTime(2000, startTime);
            
            const attackTime = Math.min(0.02, duration * 0.5);
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.03); // Instant organ release
            
            oscs.push(osc1, osc2, osc3);
            
        } else if (selectedInstrument === 24) { // Acoustic Guitar
            const osc1 = audioCtx.createOscillator();
            osc1.type = "triangle";
            osc1.frequency.setValueAtTime(freq, startTime);
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = "sawtooth";
            osc2.frequency.setValueAtTime(freq, startTime);
            
            const osc2Gain = audioCtx.createGain();
            osc2Gain.gain.setValueAtTime(0.25 * volumeFactor, startTime);
            osc2Gain.gain.setTargetAtTime(0, startTime, 0.08);
            
            osc1.connect(filter);
            osc2.connect(osc2Gain);
            osc2Gain.connect(filter);
            
            // Plucked sweep filter
            filter.Q.setValueAtTime(3, startTime);
            filter.frequency.setValueAtTime(2500, startTime);
            filter.frequency.exponentialRampToValueAtTime(500, startTime + 0.25);
            
            const attackTime = 0.005;
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(0, startTime + attackTime, 0.2); // Natural string decay
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.04); // Note release
            
            oscs.push(osc1, osc2);
            
        } else if (selectedInstrument === 48) { // Strings
            const osc1 = audioCtx.createOscillator();
            osc1.type = "sawtooth";
            osc1.frequency.setValueAtTime(freq, startTime);
            osc1.detune.setValueAtTime(12, startTime); // Chorus effect
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = "sawtooth";
            osc2.frequency.setValueAtTime(freq, startTime);
            osc2.detune.setValueAtTime(-12, startTime);
            
            osc1.connect(filter);
            osc2.connect(filter);
            
            filter.frequency.setValueAtTime(1500, startTime);
            
            const attackTime = Math.min(0.12, duration * 0.5);
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.12); // Smooth orchestral release
            
            oscs.push(osc1, osc2);
            
        } else if (selectedInstrument === 62) { // Synth Brass
            const osc = audioCtx.createOscillator();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, startTime);
            
            osc.connect(filter);
            
            // Classic filter envelope
            filter.Q.setValueAtTime(6, startTime);
            filter.frequency.setValueAtTime(300, startTime);
            filter.frequency.exponentialRampToValueAtTime(4000, startTime + 0.08);
            filter.frequency.exponentialRampToValueAtTime(1000, startTime + 0.25);
            
            const attackTime = Math.min(0.04, duration * 0.5);
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.04);
            
            oscs.push(osc);
            
        } else if (selectedInstrument === 89) { // Space Pad
            const osc1 = audioCtx.createOscillator();
            osc1.type = "triangle";
            osc1.frequency.setValueAtTime(freq, startTime);
            osc1.detune.setValueAtTime(6, startTime);
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(freq * 2, startTime);
            osc2.detune.setValueAtTime(-6, startTime);
            
            const osc2Gain = audioCtx.createGain();
            osc2Gain.gain.setValueAtTime(0.3 * volumeFactor, startTime);
            
            osc1.connect(filter);
            osc2.connect(osc2Gain);
            osc2Gain.connect(filter);
            
            filter.frequency.setValueAtTime(1200, startTime);
            
            const attackTime = Math.min(0.2, duration * 0.5);
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.18);
            
            oscs.push(osc1, osc2);
            
        } else if (selectedInstrument === 103) { // Sci-Fi
            const osc = audioCtx.createOscillator();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, startTime);
            
            const lfo = audioCtx.createOscillator();
            lfo.frequency.setValueAtTime(8, startTime);
            
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.setValueAtTime(freq * 0.05, startTime);
            
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            
            osc.connect(filter);
            filter.Q.setValueAtTime(10, startTime);
            filter.frequency.setValueAtTime(1500, startTime);
            
            const attackTime = Math.min(0.05, duration * 0.5);
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.08);
            
            lfo.start(startTime);
            lfo.stop(startTime + duration + 0.5);
            
            oscs.push(osc, lfo);
            
        } else { // Piano (Acoustic Piano, instrument 0 / default)
            const osc1 = audioCtx.createOscillator();
            osc1.type = "triangle";
            osc1.frequency.setValueAtTime(freq, startTime);
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(freq * 2, startTime);
            
            const osc2Gain = audioCtx.createGain();
            osc2Gain.gain.setValueAtTime(0.25 * volumeFactor, startTime);
            osc2Gain.gain.setTargetAtTime(0, startTime, 0.1);
            
            osc1.connect(filter);
            osc2.connect(osc2Gain);
            osc2Gain.connect(filter);
            
            filter.frequency.setValueAtTime(2000, startTime);
            filter.frequency.exponentialRampToValueAtTime(450, startTime + 0.35);
            
            const attackTime = 0.005;
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(volumeFactor, startTime + attackTime);
            noteGain.gain.setTargetAtTime(volumeFactor * 0.3, startTime + attackTime, 0.15); // natural acoustic decay
            noteGain.gain.setTargetAtTime(0, startTime + duration, 0.05); // Clean key release
            
            oscs.push(osc1, osc2);
        }

        oscs.forEach(osc => {
            osc.start(startTime);
            osc.stop(startTime + duration + 0.8);
        });
        return oscs;
    }

    function startAudio() {
        initAudio();
        isPlaying = true;
        playbackStartTime = audioCtx.currentTime;
        nextNoteIndex = 0;
        
        // Find next note to play based on offset
        while (nextNoteIndex < midiNotes.length && midiNotes[nextNoteIndex].start_time < playbackOffset) {
            nextNoteIndex++;
        }

        playbackPlayIcon.style.display = "none";
        playbackPauseIcon.style.display = "block";

        // Start scheduler loop
        schedulerLoop();
        // Start rendering timeline updates
        updatePlaybackFrame();
    }

    function pauseAudio() {
        isPlaying = false;
        playbackOffset += audioCtx.currentTime - playbackStartTime;
        
        playbackPlayIcon.style.display = "block";
        playbackPauseIcon.style.display = "none";

        if (schedulerTimerId) clearTimeout(schedulerTimerId);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        stopAllActiveSources();
    }

    function stopAudio() {
        isPlaying = false;
        playbackOffset = 0;
        
        playbackPlayIcon.style.display = "block";
        playbackPauseIcon.style.display = "none";

        if (schedulerTimerId) clearTimeout(schedulerTimerId);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        stopAllActiveSources();

        currentTimeLabel.textContent = "0:00";
        progressBarFill.style.width = "0%";
        drawPianoRoll();
    }

    function schedulerLoop() {
        if (!isPlaying) return;

        const lookAhead = 0.15; // Schedule 150ms in advance
        const currentElapsed = (audioCtx.currentTime - playbackStartTime) + playbackOffset;

        if (currentElapsed >= midiDuration) {
            stopAudio();
            return;
        }

        while (nextNoteIndex < midiNotes.length && midiNotes[nextNoteIndex].start_time < currentElapsed + lookAhead) {
            const note = midiNotes[nextNoteIndex];
            const scheduleTime = playbackStartTime + (note.start_time - playbackOffset);
            if (scheduleTime >= audioCtx.currentTime) {
                playNote(note.note, scheduleTime, note.duration, note.velocity);
            }
            nextNoteIndex++;
        }

        schedulerTimerId = setTimeout(schedulerLoop, 50);
    }

    function updatePlaybackFrame() {
        if (!isPlaying) return;

        const currentElapsed = (audioCtx.currentTime - playbackStartTime) + playbackOffset;
        
        if (currentElapsed >= midiDuration) {
            stopAudio();
            return;
        }

        // Update timeline progress indicators
        currentTimeLabel.textContent = formatTime(currentElapsed);
        const percent = Math.min(100, (currentElapsed / midiDuration) * 100);
        progressBarFill.style.width = `${percent}%`;

        // Redraw canvas with cursor
        drawPianoRoll(currentElapsed);

        animationFrameId = requestAnimationFrame(updatePlaybackFrame);
    }

    // Playback control event listeners
    playbackPlayBtn.addEventListener("click", () => {
        if (midiNotes.length === 0) return;
        if (isPlaying) {
            pauseAudio();
        } else {
            startAudio();
        }
    });

    playbackStopBtn.addEventListener("click", () => {
        stopAudio();
    });

    volumeSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (mainGainNode && audioCtx) {
            mainGainNode.gain.setValueAtTime(val, audioCtx.currentTime);
        }
    });

    // ProgressBar seek handler
    progressBarBg.addEventListener("click", (e) => {
        if (midiNotes.length === 0) return;
        const rect = progressBarBg.getBoundingClientRect();
        const clickPercent = (e.clientX - rect.left) / rect.width;
        const targetTime = clickPercent * midiDuration;

        seekTo(targetTime);
    });

    // PianoRoll Canvas seek handler
    pianoRollCanvas.addEventListener("click", (e) => {
        if (midiNotes.length === 0) return;
        const rect = pianoRollCanvas.getBoundingClientRect();
        const clickPercent = (e.clientX - rect.left) / rect.width;
        const targetTime = clickPercent * midiDuration;

        seekTo(targetTime);
    });

    let isExporting = false;

    function showExportModal() {
        if (isExporting || midiNotes.length === 0 || midiDuration === 0) return;
        
        // Reset steps
        exportStepSelect.style.display = "block";
        exportStepProgress.style.display = "none";
        exportStepSuccess.style.display = "none";
        
        exportProgressFill.style.width = "0%";
        exportProgressLabel.textContent = "0%";
        exportStatusText.textContent = "Подготовка...";
        
        exportModal.style.display = "flex";
    }

    function hideExportModal() {
        if (isExporting) {
            isExporting = false;
            showToast("Экспорт отменен.", "info");
        }
        exportModal.classList.add("closing");
        setTimeout(() => {
            exportModal.style.display = "none";
            exportModal.classList.remove("closing");
        }, 220);
    }

    function updateExportProgress(value, statusText) {
        exportProgressFill.style.width = `${value}%`;
        exportProgressLabel.textContent = `${value}%`;
        if (statusText) {
            exportStatusText.textContent = statusText;
        }
    }

    if (downloadAudioBtn) {
        downloadAudioBtn.addEventListener("click", showExportModal);
    }

    if (exportModalClose) {
        exportModalClose.addEventListener("click", hideExportModal);
    }

    // Close on overlay click
    exportModal.addEventListener("click", (e) => {
        if (e.target === exportModal) {
            hideExportModal();
        }
    });

    if (formatWavCard) {
        formatWavCard.addEventListener("click", async () => {
            if (isExporting) return;
            isExporting = true;
            
            exportStepSelect.style.display = "none";
            exportStepProgress.style.display = "block";
            const progressTitle = document.getElementById("export-progress-title");
            if (progressTitle) progressTitle.textContent = "Экспорт в WAV...";
            
            try {
                await runWavExportProcess();
            } catch (e) {
                showToast("Ошибка при экспорте: " + e.message, "error");
                hideExportModal();
            } finally {
                isExporting = false;
            }
        });
    }

    if (formatMp3Card) {
        formatMp3Card.addEventListener("click", async () => {
            if (isExporting) return;
            isExporting = true;
            
            exportStepSelect.style.display = "none";
            exportStepProgress.style.display = "block";
            const progressTitle = document.getElementById("export-progress-title");
            if (progressTitle) progressTitle.textContent = "Экспорт в MP3...";
            
            try {
                await runMp3ExportProcess();
            } catch (e) {
                showToast("Ошибка при экспорте: " + e.message, "error");
                hideExportModal();
            } finally {
                isExporting = false;
            }
        });
    }

    async function runWavExportProcess() {
        updateExportProgress(10, "Подготовка...");
        const sampleRate = 44100;
        const durationSeconds = midiDuration + 1.5;
        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
            2, 
            sampleRate * durationSeconds, 
            sampleRate
        );

        const offlineMainGain = offlineCtx.createGain();
        offlineMainGain.gain.setValueAtTime(0.8, 0);

        const offlineDelay = offlineCtx.createDelay(1.0);
        offlineDelay.delayTime.setValueAtTime(0.35, 0);
        
        const offlineFeedback = offlineCtx.createGain();
        offlineFeedback.gain.setValueAtTime(0.35, 0);
        
        const offlineWetGain = offlineCtx.createGain();
        offlineWetGain.gain.setValueAtTime(0.25, 0);
        
        offlineMainGain.connect(offlineCtx.destination);
        offlineMainGain.connect(offlineDelay);
        offlineDelay.connect(offlineFeedback);
        offlineFeedback.connect(offlineDelay);
        offlineDelay.connect(offlineWetGain);
        offlineWetGain.connect(offlineCtx.destination);

        midiNotes.forEach(note => {
            playNoteOnContext(
                offlineCtx, 
                offlineMainGain, 
                note.note, 
                note.start_time, 
                note.duration, 
                note.velocity
            );
        });

        updateExportProgress(30, "Синтезирование аудиодорожки...");
        
        // Animate progress smoothly while rendering
        let progressVal = 30;
        const progressInterval = setInterval(() => {
            if (progressVal < 80) {
                progressVal += 5;
                updateExportProgress(progressVal, "Синтезирование аудиодорожки...");
            }
        }, 80);

        const renderedBuffer = await offlineCtx.startRendering();
        clearInterval(progressInterval);
        
        updateExportProgress(85, "Создание WAV-файла...");
        const wavBlob = bufferToWav(renderedBuffer);

        updateExportProgress(100, "Готово!");
        
        // Show success screen
        exportStepProgress.style.display = "none";
        exportStepSuccess.style.display = "block";

        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement("a");
        a.href = url;
        const originalName = previewFilename.textContent || "pixelsound";
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        a.download = `${baseName}_pixelsound.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setTimeout(() => {
            hideExportModal();
        }, 1500);
    }

    function bufferToWav(buffer) {
        const numOfChan = buffer.numberOfChannels;
        const lns = buffer.length * numOfChan * 2 + 44;
        const bufferArr = new ArrayBuffer(lns);
        const view = new DataView(bufferArr);
        const channels = [];
        let offset = 0;
        let pos = 0;

        writeString(view, pos, 'RIFF'); pos += 4;
        view.setUint32(pos, lns - 8, true); pos += 4;
        writeString(view, pos, 'WAVE'); pos += 4;
        writeString(view, pos, 'fmt '); pos += 4;
        view.setUint32(pos, 16, true); pos += 4;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint16(pos, numOfChan, true); pos += 2;
        view.setUint32(pos, buffer.sampleRate, true); pos += 4;
        view.setUint32(pos, buffer.sampleRate * numOfChan * 2, true); pos += 4;
        view.setUint16(pos, numOfChan * 2, true); pos += 2;
        view.setUint16(pos, 16, true); pos += 2;
        writeString(view, pos, 'data'); pos += 4;
        view.setUint32(pos, lns - pos - 4, true); pos += 4;

        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < lns) {
            for (let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return new Blob([bufferArr], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async function runMp3ExportProcess() {
        updateExportProgress(10, "Подготовка...");
        const sampleRate = 22050; 
        const durationSeconds = midiDuration + 1.5;
        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
            1, // Mono for 2x faster MP3 render & encoding
            sampleRate * durationSeconds, 
            sampleRate
        );

        const offlineMainGain = offlineCtx.createGain();
        offlineMainGain.gain.setValueAtTime(0.8, 0);

        const offlineDelay = offlineCtx.createDelay(1.0);
        offlineDelay.delayTime.setValueAtTime(0.35, 0);
        
        const offlineFeedback = offlineCtx.createGain();
        offlineFeedback.gain.setValueAtTime(0.35, 0);
        
        const offlineWetGain = offlineCtx.createGain();
        offlineWetGain.gain.setValueAtTime(0.25, 0);
        
        offlineMainGain.connect(offlineCtx.destination);
        offlineMainGain.connect(offlineDelay);
        offlineDelay.connect(offlineFeedback);
        offlineFeedback.connect(offlineDelay);
        offlineDelay.connect(offlineWetGain);
        offlineWetGain.connect(offlineCtx.destination);

        midiNotes.forEach(note => {
            playNoteOnContext(
                offlineCtx, 
                offlineMainGain, 
                note.note, 
                note.start_time, 
                note.duration, 
                note.velocity
            );
        });

        updateExportProgress(25, "Синтезирование аудиодорожки...");
        const renderedBuffer = await offlineCtx.startRendering();

        if (typeof lamejs === "undefined") {
            throw new Error("Библиотека lamejs не загрузилась. Проверьте подключение к интернету.");
        }

        updateExportProgress(35, "Сжатие звука в MP3 (0%)...");
        
        const mp3Blob = await bufferToMp3Async(renderedBuffer, (progress) => {
            const overallProgress = Math.round(35 + (progress * 0.6));
            updateExportProgress(overallProgress, `Сжатие звука в MP3 (${progress}%)...`);
        });

        updateExportProgress(100, "Готово!");
        
        exportStepProgress.style.display = "none";
        exportStepSuccess.style.display = "block";

        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement("a");
        a.href = url;
        const originalName = previewFilename.textContent || "pixelsound";
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        a.download = `${baseName}_pixelsound.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setTimeout(() => {
            hideExportModal();
        }, 1500);
    }

    function bufferToMp3Async(audioBuffer, onProgress) {
        return new Promise((resolve) => {
            const sampleRate = audioBuffer.sampleRate;
            const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128); // 1 channel (mono) for 2x speed
            const mp3Data = [];
            
            const channelData = audioBuffer.getChannelData(0);
            const numSamples = channelData.length;
            
            const samplesInt16 = new Int16Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
                let s = Math.max(-1, Math.min(1, channelData[i]));
                samplesInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            const sampleBlockSize = 1152;
            let offset = 0;

            function encodeChunk() {
                if (!isExporting) {
                    resolve(null); // interrupted
                    return;
                }
                const end = Math.min(offset + 460800, numSamples); 
                for (let i = offset; i < end; i += sampleBlockSize) {
                    const chunk = samplesInt16.subarray(i, i + sampleBlockSize);
                    const mp3buf = mp3encoder.encodeBuffer(chunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }
                
                offset = end;
                const progress = Math.round((offset / numSamples) * 100);
                onProgress(progress);

                if (offset < numSamples) {
                    setTimeout(encodeChunk, 0); 
                } else {
                    const mp3buf = mp3encoder.flush();
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                    resolve(new Blob(mp3Data, { type: 'audio/mp3' }));
                }
            }

            setTimeout(encodeChunk, 0);
        });
    }

    function seekTo(targetTime) {
        const wasPlaying = isPlaying;
        if (wasPlaying) {
            pauseAudio();
        }

        playbackOffset = Math.max(0, Math.min(midiDuration, targetTime));
        currentTimeLabel.textContent = formatTime(playbackOffset);
        progressBarFill.style.width = `${(playbackOffset / midiDuration) * 100}%`;
        
        lastElapsedSeconds = playbackOffset;
        drawPianoRoll(playbackOffset);

        if (wasPlaying) {
            startAudio();
        }
    }

    // Canvas drawing and setup
    let minNote = 127;
    let maxNote = 0;
    let noteRange = 12;

    function setupCanvas() {
        if (midiNotes.length === 0) return;

        // Auto-scale vertical note range
        minNote = Math.min(...midiNotes.map(n => n.note)) - 2;
        maxNote = Math.max(...midiNotes.map(n => n.note)) + 2;
        
        // Sanity constraints
        if (minNote < 0) minNote = 0;
        if (maxNote > 127) maxNote = 127;
        
        noteRange = maxNote - minNote;
        if (noteRange <= 0) noteRange = 12;

        resizeCanvas();
    }

    function resizeCanvas() {
        const rect = pianoRollCanvas.parentElement.getBoundingClientRect();
        pianoRollCanvas.width = rect.width * window.devicePixelRatio;
        pianoRollCanvas.height = rect.height * window.devicePixelRatio;
    }

    window.addEventListener("resize", () => {
        if (midiNotes.length > 0) {
            resizeCanvas();
            const currentElapsed = isPlaying ? (audioCtx.currentTime - playbackStartTime) + playbackOffset : playbackOffset;
            drawPianoRoll(currentElapsed);
        }
    });

    function drawPianoRoll(elapsedSeconds = 0) {
        if (!pianoRollCanvas || midiNotes.length === 0) return;
        const ctx = pianoRollCanvas.getContext("2d");
        const w = pianoRollCanvas.width;
        const h = pianoRollCanvas.height;

        ctx.resetTransform();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        const drawW = w / window.devicePixelRatio;
        const drawH = h / window.devicePixelRatio;

        ctx.clearRect(0, 0, drawW, drawH);

        // Draw horizontal grid lines (notes pitches)
        const noteHeight = drawH / noteRange;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= noteRange; i++) {
            const y = drawH - (i * noteHeight);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(drawW, y);
            ctx.stroke();
        }

        // Draw vertical grid lines (beats/seconds)
        const secondsPerGrid = 1.0;
        const gridWidth = drawW / midiDuration;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.03)";
        for (let t = 0; t <= midiDuration; t += secondsPerGrid) {
            const x = t * gridWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, drawH);
            ctx.stroke();
        }

        // Draw notes
        midiNotes.forEach(note => {
            const x = note.start_time * gridWidth;
            const noteW = note.duration * gridWidth;
            const y = drawH - ((note.note - minNote + 1) * noteHeight);
            
            // Highlight note if it's currently active/playing
            const isActive = elapsedSeconds >= note.start_time && elapsedSeconds <= (note.start_time + note.duration);
            
            if (isActive) {
                ctx.fillStyle = "#ffffff";
            } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.4)"; // Much more visible inactive notes
            }

            const drawWidth = Math.max(3, noteW - 1);
            const drawHeight = Math.max(3.5, noteHeight - 1);
            const radius = Math.min(2, drawWidth / 2, drawHeight / 2);

            ctx.beginPath();
            ctx.roundRect(x, y + (noteHeight - drawHeight) / 2, drawWidth, drawHeight, radius);
            ctx.fill();
        });

        // Trigger visual sparks on note activation
        if (elapsedSeconds > 0) {
            if (elapsedSeconds < lastElapsedSeconds) {
                lastElapsedSeconds = elapsedSeconds;
            }
            midiNotes.forEach(note => {
                if (note.start_time >= lastElapsedSeconds && note.start_time < elapsedSeconds) {
                    const numSparks = 6;
                    const x = note.start_time * gridWidth;
                    const y = drawH - ((note.note - minNote + 0.5) * noteHeight);
                    for (let s = 0; s < numSparks; s++) {
                        visualizerSparks.push({
                            x: x,
                            y: y,
                            vx: (Math.random() - 0.25) * 1.8 + 0.8,
                            vy: (Math.random() - 0.5) * 2,
                            life: 1.0,
                            decay: Math.random() * 0.06 + 0.04,
                            color: Math.random() > 0.4 ? "#ffffff" : "rgba(255, 255, 255, 0.4)"
                        });
                    }
                    ambientExcitation = Math.min(1.0, ambientExcitation + 0.08);
                }
            });
            lastElapsedSeconds = elapsedSeconds;
        }

        // Draw & Update sparks
        for (let i = visualizerSparks.length - 1; i >= 0; i--) {
            const sp = visualizerSparks[i];
            sp.x += sp.vx;
            sp.y += sp.vy;
            sp.life -= sp.decay;

            if (sp.life <= 0) {
                visualizerSparks.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = sp.life;
            ctx.fillStyle = sp.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw current timeline playback cursor
        const cursorX = elapsedSeconds * gridWidth;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, drawH);
        ctx.stroke();

        // Cursor head
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cursorX, 0, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    async function checkHistoryExistence() {
        const history = getHistory();
        if (history.length === 0) return;
        const taskIds = history.map(item => item.id);
        try {
            const res = await fetch("api/tasks/check", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ task_ids: taskIds })
            });
            if (res.ok) {
                const data = await res.json();
                const existingIds = new Set(data.existing_ids);
                let updatedHistory = history.filter(item => existingIds.has(item.id));
                if (updatedHistory.length !== history.length) {
                    saveHistory(updatedHistory);
                    renderHistory();
                }
            }
        } catch (e) {
            console.error("Failed to check history existence on server:", e);
        }
    }

    // Initialize
    renderHistory();
    checkHistoryExistence();
    trackedTasks.forEach(task => {
        if (task.status === "pending" || task.status === "processing") {
            pollTaskStatus(task.id);
        }
    });

    clearHistoryBtn.addEventListener("click", () => {
        saveHistory([]);
        renderHistory();
    });

    updateQueueStats();
    setInterval(updateQueueStats, 3000);
    updateStats();
    setInterval(updateStats, 10000);

    // --- Smooth Magnetic Translation Effect ---
    const setupMagnetism = () => {
        const magneticEls = document.querySelectorAll(".magnetic");
        magneticEls.forEach(el => {
            let targetX = 0, targetY = 0;
            let currentX = 0, currentY = 0;
            let isHovered = false;

            el.addEventListener("mousemove", (e) => {
                isHovered = true;
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                targetX = x * 0.35;
                targetY = y * 0.35;
            });

            el.addEventListener("mouseleave", () => {
                isHovered = false;
                targetX = 0;
                targetY = 0;
            });

            const updateLoop = () => {
                // Smooth interpolation (lerp)
                currentX += (targetX - currentX) * 0.12;
                currentY += (targetY - currentY) * 0.12;

                if (isHovered) {
                    el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.02)`;
                } else {
                    el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1)`;
                }
                requestAnimationFrame(updateLoop);
            };
            updateLoop();
        });
    };
    setupMagnetism();

    // --- Dynamic Ambient Particle Field ---
    if (ambientCanvas) {
        ambientCtx = ambientCanvas.getContext("2d");
        
        const resizeAmbient = () => {
            ambientCanvas.width = window.innerWidth;
            ambientCanvas.height = window.innerHeight;
        };
        resizeAmbient();
        window.addEventListener("resize", resizeAmbient);

        document.addEventListener("mousemove", (e) => {
            pageMouse.x = e.clientX;
            pageMouse.y = e.clientY;
        });

        const particles = [];
        const numParticles = 50;
        for (let i = 0; i < numParticles; i++) {
            particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 1.5 + 0.8,
                alpha: Math.random() * 0.25 + 0.05
            });
        }

        const animateAmbient = () => {
            ambientCtx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
            ambientExcitation *= 0.94; // Decay excitation

            particles.forEach(p => {
                // Movement speed scale based on music excitation
                p.x += p.vx * (1 + ambientExcitation * 10);
                p.y += p.vy * (1 + ambientExcitation * 10);

                if (p.x < 0 || p.x > ambientCanvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > ambientCanvas.height) p.vy *= -1;

                // Repelled by cursor
                const dx = p.x - pageMouse.x;
                const dy = p.y - pageMouse.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 100) {
                    const force = (100 - dist) / 100;
                    p.x += (dx / dist) * force * 1.2;
                    p.y += (dy / dist) * force * 1.2;
                }

                // Render dynamic sizing
                const currentRadius = p.radius * (1 + ambientExcitation * 1.8);
                const currentAlpha = Math.min(0.65, p.alpha * (1 + ambientExcitation * 3));
                ambientCtx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
                ambientCtx.beginPath();
                ambientCtx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
                ambientCtx.fill();
            });

            requestAnimationFrame(animateAmbient);
        };
        animateAmbient();
    }
});