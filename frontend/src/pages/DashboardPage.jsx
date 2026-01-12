import { useState, useEffect, useRef } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useWebSocket } from '../hooks/useWebSocket'
import { AudioVisualizer } from '../components/AudioVisualizer'
import { PrimaryButton, SecondaryButton, TertiaryButton } from '@fremtind/jokul/button'
import { TextArea } from '@fremtind/jokul/text-area'
import { Loader } from '@fremtind/jokul/loader'
import { ErrorMessage, InfoMessage } from '@fremtind/jokul/message'
import { Card } from '@fremtind/jokul/card'

const PROMPT_TEMPLATES = {
    "oppsummering_kort": {
        label: "Oppsummering (kort)",
        text: "Lag en kort og konsis oppsummering av den transkriberte teksten. Maks 5 setninger..\n\nTEKST:\n{text}"
    },
    "oppsummering_lang": {
        label: "Oppsummering (lang)",
        text: "Lag en detaljert oppsummering av teksten under. Inkluder alle viktige detaljer og nyanser.\n\nTEKST:\n{text}"
    },
    "motereferat": {
        label: "Møtereferat",
        text: "Du er en ekspert på å lage strukturerte møtereferater.\nAnalyser følgende transkripsjon av et møte og lag et profesjonelt møtereferat på norsk.\n\nStrukturer referatet slik:\n1. **Hovedtemaer diskutert**\n2. **Viktige beslutninger**\n3. **Handlingspunkter** (hvem gjør hva, med frister hvis nevnt)\n4. **Oppfølgingssaker**\n\nHold referatet konsist men fullstendig.\n\nTRANSKRIPSJON:\n{text}\n\nMØTEREFERAT:"
    },
    "executive_summary": {
        label: "Executive Summary",
        text: "Lag en kort ledersammendrag (executive summary) på norsk av den transkriberte teksten.\nSammendraget skal være 2-3 avsnitt og dekke:\n- Hovedbudskapet/konklusjonen\n- Viktigste funn eller beslutninger\n- Anbefalte neste steg\n\nTEKST:\n{text}\n\nLEDERSAMMENDRAG:"
    },
    "teknisk": {
        label: "Teknisk",
        text: "Analyser teksten under fra et teknisk perspektiv. Trekk frem tekniske løsninger, arkitekturvalg, og tekniske utfordringer som blir diskutert.\n\nTEKST:\n{text}"
    },
    "custom": {
        label: "Custom",
        text: "{text}"
    }
}

export default function DashboardPage() {
    // Audio Recording Hook
    const {
        isRecording,
        isPaused,
        formattedTime,
        audioBlob,
        error: recordingError,
        recordingId,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        clearRecording,
        stream,
    } = useAudioRecorder()

    // WebSocket Hook for Live Transcription
    const {
        isConnected: _isConnected,
        lastMessage,
        connect,
        disconnect,
        sendMessage
    } = useWebSocket()

    // State
    // State
    const [transcriptionText, setTranscriptionText] = useState('')
    const [isLiveMode, _setIsLiveMode] = useState(true) // Default to live mode
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [isSummarizing, setIsSummarizing] = useState(false)

    // AI Summary State
    const [selectedPromptKey, setSelectedPromptKey] = useState('motereferat')
    const [customPromptText, setCustomPromptText] = useState(PROMPT_TEMPLATES['motereferat'].text)
    const [summaryResult, setSummaryResult] = useState('')

    const [error, setError] = useState(null)
    const [copySuccess, setCopySuccess] = useState(false)
    const [summaryCopySuccess, setSummaryCopySuccess] = useState(false)
    const [transcriptionProgress, setTranscriptionProgress] = useState(0)

    // Audio Playback State
    const audioPlayerRef = useRef(null)
    const audioUrl = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playbackTime, setPlaybackTime] = useState(0)
    const [_duration, setDuration] = useState(0)

    // Update audio URL when blob changes
    useEffect(() => {
        if (audioBlob) {
            audioUrl.current = URL.createObjectURL(audioBlob)
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = audioUrl.current
                audioPlayerRef.current.load()
                
                // Set up event listeners for playback tracking
                const audio = audioPlayerRef.current
                
                const handleTimeUpdate = () => setPlaybackTime(audio.currentTime)
                const handlePlay = () => setIsPlaying(true)
                const handlePause = () => setIsPlaying(false)
                const handleEnded = () => {
                    setIsPlaying(false)
                    setPlaybackTime(0)
                }
                const handleLoadedMetadata = () => setDuration(audio.duration)
                
                audio.addEventListener('timeupdate', handleTimeUpdate)
                audio.addEventListener('play', handlePlay)
                audio.addEventListener('pause', handlePause)
                audio.addEventListener('ended', handleEnded)
                audio.addEventListener('loadedmetadata', handleLoadedMetadata)
                
                return () => {
                    audio.removeEventListener('timeupdate', handleTimeUpdate)
                    audio.removeEventListener('play', handlePlay)
                    audio.removeEventListener('pause', handlePause)
                    audio.removeEventListener('ended', handleEnded)
                    audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
                }
            }
        } else {
            setIsPlaying(false)
            setPlaybackTime(0)
            setDuration(0)
        }
        return () => {
            if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
        }
    }, [audioBlob])

    // Handle incoming WebSocket messages

    // Handle incoming WebSocket messages
    useEffect(() => {
        if (lastMessage && lastMessage.text) {
            // Append or replace? 
            // For simple streaming, we might just get the latest chunk or full text.
            // Our backend currently sends the *full* text of the buffer.
            setTranscriptionText(lastMessage.text)
        }
    }, [lastMessage])

    // Start/Resume Recording Handler
    const handleStartRecording = async () => {
        setError(null)

        // Check if we are continuing an existing session
        const isContinuing = !!audioBlob

        if (!isContinuing) {
            setSummaryResult('')
            setTranscriptionText('')
            setCopySuccess(false)
            setTranscriptionProgress(0)
        }

        if (isLiveMode) {
            // Note: In a real app we might want to keep the socket open or handle reconnection smartly.
            // For now, new connection is fine, it will just append text.
            connect('/api/streaming/realtime')
        }

        // Pass true if continuing
        await startRecording((chunk) => {
            if (isLiveMode) {
                sendMessage(chunk)
            }
        }, isContinuing)
    }

    // Playback Handler - Toggle play/pause
    const handleTogglePlayback = () => {
        if (audioPlayerRef.current) {
            if (isPlaying) {
                audioPlayerRef.current.pause()
            } else {
                audioPlayerRef.current.play()
            }
        }
    }

    // Delete Recording Handler
    const handleDeleteRecording = async () => {
        if (!window.confirm('Er du sikker på at du vil slette opptaket? Dette kan ikke angres.')) {
            return
        }

        try {
            if (recordingId) {
                const response = await fetch(`/api/transcription/recording/${recordingId}`, {
                    method: 'DELETE',
                })
                
                if (!response.ok) {
                    throw new Error('Kunne ikke slette opptak fra server')
                }
            }
            
            clearRecording()
            setIsPlaying(false)
            setPlaybackTime(0)
            setDuration(0)
            
        } catch (err) {
            setError(err.message || 'Kunne ikke slette opptak')
        }
    }

    // Save Recording Handler (keep file on server, clear UI for new recording)
    const handleSaveRecording = () => {
        // Clear local state but keep file on server
        clearRecording()
        setIsPlaying(false)
        setPlaybackTime(0)
        setDuration(0)
    }

    // Reset Handler
    const _handleResetSession = async () => {
        if (!window.confirm('Er du sikker på at du vil starte en ny sesjon? Dette sletter opptaket.')) {
            return
        }

        try {
            // Delete recording from server if it exists
            if (recordingId) {
                await fetch(`/api/transcription/recording/${recordingId}`, {
                    method: 'DELETE',
                })
            }
            
            clearRecording()
            setTranscriptionText('')
            setSummaryResult('')
            setError(null)
            setIsPlaying(false)
            setPlaybackTime(0)
            setDuration(0)
            if (isLiveMode) disconnect()
            
        } catch (err) {
            // Continue with reset even if delete fails
            console.error('Failed to delete recording:', err)
            clearRecording()
            setTranscriptionText('')
            setSummaryResult('')
            setError(null)
            setIsPlaying(false)
            setPlaybackTime(0)
            setDuration(0)
            if (isLiveMode) disconnect()
        }
    }

    // Stop Recording Handler
    const handleStopRecording = () => {
        stopRecording()
        if (isLiveMode) {
            setTimeout(() => disconnect(), 1000)
        }
    }

    // Transcribe File Handler (Fallback or for non-live)
    const handleTranscribeFile = async () => {
        if (!audioBlob) return

        setIsTranscribing(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', audioBlob, 'recording.webm')
            formData.append('language', 'no')

            const response = await fetch('/api/transcription/upload', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) throw new Error('Transkripsjon feilet')

            const result = await response.json()
            setTranscriptionText(result.text)
        } catch (err) {
            setError(err.message)
        } finally {
            setIsTranscribing(false)
        }
    }

    // Summarize Handler (Bedrock)
    const handleGenerateSummary = async () => {
        if (!transcriptionText) return

        setIsSummarizing(true)
        setError(null)

        try {
            const response = await fetch('/api/summarization/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcriptionText,
                    prompt: customPromptText // Send the edited prompt
                })
            })

            if (!response.ok) throw new Error('Generering av AI-sammendrag feilet')

            const result = await response.json()
            setSummaryResult(result.summary)
        } catch (err) {
            setError(err.message)
        } finally {
            setIsSummarizing(false)
        }
    }

    const handlePromptChange = (e) => {
        const key = e.target.value
        setSelectedPromptKey(key)
        if (key && PROMPT_TEMPLATES[key]) {
            setCustomPromptText(PROMPT_TEMPLATES[key].text)
        }
    }

    // Copy Handler
    const handleCopy = () => {
        navigator.clipboard.writeText(transcriptionText)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
    }

    // Download Handler
    const handleDownload = () => {
        if (transcriptionText) {
            const blob = new Blob([transcriptionText], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `transcription-${Date.now()}.txt`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    // Summary Copy Handler
    const handleCopySummary = () => {
        navigator.clipboard.writeText(summaryResult)
        setSummaryCopySuccess(true)
        setTimeout(() => setSummaryCopySuccess(false), 2000)
    }

    // Summary Download Handler
    const handleDownloadSummary = () => {
        if (summaryResult) {
            const blob = new Blob([summaryResult], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `sammendrag-${Date.now()}.txt`
            a.click()
            URL.revokeObjectURL(url)
        }
    }


    // Handle File Select (Auto-transcribe with Streaming Progress)
    const fileInputRef = useRef(null)

    const handleFileSelect = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        setIsTranscribing(true)
        setTranscriptionProgress(0)
        setError(null)
        setTranscriptionText('')
        setSummaryResult('')

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('language', 'no')

            // Use the SSE streaming endpoint
            const response = await fetch('/api/transcription/upload/stream', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) throw new Error('Transkripsjon feilet (' + response.status + ')')

            // Read the stream
            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            let buffer = ''
            let streamDone = false

            while (!streamDone) {
                const { value, done } = await reader.read()
                streamDone = done

                if (value) {
                    buffer += decoder.decode(value, { stream: !done })
                }

                const parts = buffer.split('\n\n')
                // Keep the last part in buffer if we are not done yet, otherwise process everything
                if (!done) {
                    buffer = parts.pop() || ''
                } else {
                    buffer = ''
                }

                for (const part of parts) {
                    if (!part.trim()) continue
                    // ... process message ...
                    const lines = part.split('\n')
                    let eventType = 'message'
                    let dataStr = ''

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.substring(7).trim()
                        } else if (line.startsWith('data: ')) {
                            dataStr = line.substring(6)
                        }
                    }

                    if (dataStr && dataStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(dataStr)

                            if (eventType === 'progress' || data.status === 'processing') {
                                setTranscriptionProgress(data.progress_percent)
                                if (data.partial_text) {
                                    setTranscriptionText(data.partial_text)
                                }
                            } else if (eventType === 'complete' || data.status === 'completed') {
                                setTranscriptionProgress(100)
                                setTranscriptionText(data.text)
                            } else if (eventType === 'error') {
                                throw new Error(data)
                            }
                        } catch (e) {
                            if (eventType === 'error') setError(dataStr)
                        }
                    }
                }

                if (done) break
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setIsTranscribing(false)
            setTranscriptionProgress(0)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    return (
        <div className="dashboard-page">

            {/* Recording Banner */}
            <Card className="recording-banner" style={{ marginBottom: '24px', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>

                {/* Left: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {/* Audio Player (Hidden) */}
                    <audio ref={audioPlayerRef} style={{ display: 'none' }} onEnded={() => { }} />

                    <div className="controls-container" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        {/* Upload Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isTranscribing || isRecording}
                            title="Last opp fil"
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                border: '2px solid var(--jkl-color-border-separator)',
                                background: 'white',
                                color: '#2b2b2c',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (isTranscribing || isRecording) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative' // For loader
                            }}
                        >
                            {isTranscribing ? <Loader /> : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                            )}
                        </button>

                        {/* Play/Pause Button (Left) */}
                        <button
                            onClick={handleTogglePlayback}
                            disabled={isRecording || !audioBlob}
                            title={isPlaying ? "Pause avspilling" : "Spill av opptak"}
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                border: '2px solid var(--jkl-color-border-separator)',
                                background: 'white',
                                color: '#2b2b2c',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (isRecording || !audioBlob) ? 'not-allowed' : 'pointer',
                                opacity: (isRecording || !audioBlob) ? 0.5 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            {isPlaying ? (
                                /* Pause Icon */
                                <div style={{ width: '24px', height: '24px', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                    <div style={{ width: '6px', height: '20px', background: '#2b2b2c', borderRadius: '2px' }}></div>
                                    <div style={{ width: '6px', height: '20px', background: '#2b2b2c', borderRadius: '2px' }}></div>
                                </div>
                            ) : (
                                /* Play Icon */
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>

                        {/* Record Button (Center) */}
                        <button
                            className={`record-btn-large ${isRecording ? (isPaused ? 'recording-button--paused' : 'recording-button--recording') : ''}`}
                            onClick={isRecording ? (isPaused ? resumeRecording : pauseRecording) : handleStartRecording}
                            disabled={!isRecording && audioBlob !== null}
                            title={audioBlob && !isRecording ? "Slett eksisterende opptak for å starte nytt" : (isRecording ? (isPaused ? "Fortsett opptak" : "Pause opptak") : "Start opptak")}
                            style={{ 
                                width: '80px', 
                                height: '80px',
                                opacity: (!isRecording && audioBlob) ? 0.5 : 1,
                                cursor: (!isRecording && audioBlob) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isRecording && !isPaused ? (
                                <div className="pause-icon" style={{ width: '24px', height: '24px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <div style={{ width: '8px', height: '24px', background: 'white', borderRadius: '4px' }}></div>
                                    <div style={{ width: '8px', height: '24px', background: 'white', borderRadius: '4px' }}></div>
                                </div>
                            ) : (
                                <div className="record-icon"></div>
                            )}
                        </button>

                        {/* Stop Button (Right) */}
                        <button
                            className="stop-btn-large"
                            onClick={handleStopRecording}
                            disabled={!isRecording && !isPaused}
                            title="Stopp opptak"
                            style={{
                                width: '56px',
                                height: '56px',
                                border: '2px solid rgba(43, 43, 44, 0.1)',
                                opacity: (!isRecording && !isPaused) ? 0.5 : 1,
                                cursor: (!isRecording && !isPaused) ? 'not-allowed' : 'pointer',
                                transform: 'none'
                            }}
                        >
                            <div className="stop-icon" style={{ width: '20px', height: '20px' }}></div>
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            accept="audio/*,.m4a,.wav,.mp3,.aac,.flac,.ogg,.webm"
                        />


                        {/* Timer */}
                        <div className="timer-display jkl-heading-2" style={{ margin: 0, minWidth: '80px', textAlign: 'center' }}>
                            {isPlaying ? (
                                `${Math.floor(playbackTime / 60).toString().padStart(2, '0')}:${Math.floor(playbackTime % 60).toString().padStart(2, '0')}`
                            ) : (
                                formattedTime
                            )}
                        </div>
                    </div>
                </div>



                {/* Center: Visualizer and Subtitle */}
                <div style={{ flex: 1, maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', opacity: isRecording ? 1 : 0, transition: 'opacity 0.3s' }}>
                        <AudioVisualizer stream={stream} isRecording={isRecording} height={40} width={400} />
                    </div>
                    {/* Subtitle Zone */}
                    <div style={{
                        height: '24px',
                        marginTop: '8px',
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        color: 'var(--jkl-color-text-subdued)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        opacity: isRecording && isLiveMode ? 1 : 0,
                        transition: 'opacity 0.3s'
                    }}>
                        {transcriptionText.slice(-60)}
                    </div>
                </div>

                {/* Right: Settings & Upload */}
                {/* Right: Settings (Empty/Transcribe Only) */}
                <div className="recording-settings" style={{ marginTop: 0, paddingTop: 0, width: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {audioBlob && !isRecording && (
                        <>
                            <PrimaryButton onClick={handleTranscribeFile} disabled={isTranscribing}>
                                {isTranscribing ? <Loader /> : 'Transkriber opptak'}
                            </PrimaryButton>
                            
                            <SecondaryButton 
                                onClick={handleSaveRecording} 
                                disabled={isTranscribing}
                            >
                                Lagre opptak
                            </SecondaryButton>
                            
                            <SecondaryButton 
                                onClick={handleDeleteRecording} 
                                disabled={isTranscribing}
                                style={{ 
                                    color: '#d32f2f',
                                    borderColor: '#d32f2f'
                                }}
                            >
                                Slett opptak
                            </SecondaryButton>
                        </>
                    )}
                </div>
            </Card>

            {/* Progress Bar */}
            {
                isTranscribing && (
                    <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                        <InfoMessage>Transkriberer fil... ({Math.round(transcriptionProgress)}%)</InfoMessage>
                        <div style={{
                            width: '100%',
                            height: '4px',
                            background: '#eee',
                            borderRadius: '2px',
                            marginTop: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${transcriptionProgress}%`,
                                height: '100%',
                                background: '#2b2b2c',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )
            }

            {error && <ErrorMessage className="mb-24">{error}</ErrorMessage>}
            {recordingError && <ErrorMessage className="mb-24">{recordingError}</ErrorMessage>}

            <div className="dashboard-grid">

                {/* Right Column: Transcription & Summary */}
                <section className="dashboard-section results-section">

                    {/* Transcription Area */}
                    <Card className="dashboard-card results-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div className="card-header">
                            <h2 className="jkl-heading-2">Transkripsjon</h2>
                            <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>

                                <TertiaryButton onClick={handleDownload} title="Last ned tekst">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </TertiaryButton>
                                <TertiaryButton onClick={handleCopy} title="Kopier tekst">
                                    {copySuccess ? 'Kopiert!' : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    )}
                                </TertiaryButton>
                            </div>
                        </div>

                        <TextArea
                            className="transcription-textarea"
                            value={transcriptionText}
                            onChange={(e) => setTranscriptionText(e.target.value)}
                            placeholder="Her kommer transkripsjonen av lydopptaket eller opplastet lydfil..."
                            style={{ flex: 1 }}
                        />
                    </Card>
                </section>

                {/* Third Column: AI Summary */}
                <section className="dashboard-section ai-section">
                    <Card className="dashboard-card ai-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

                        {/* Header with Title and Dropdown */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                            <h2 className="jkl-heading-2" style={{ margin: 0 }}>Prompt</h2>
                            <select
                                className="jkl-select"
                                value={selectedPromptKey}
                                onChange={handlePromptChange}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--jkl-color-border-input)',
                                    fontSize: '0.9rem',
                                    fontFamily: 'inherit',
                                    background: 'var(--jkl-color-background-input)',
                                    color: 'var(--jkl-color-text-default)',
                                    minWidth: '200px'
                                }}
                            >
                                {Object.entries(PROMPT_TEMPLATES).map(([key, template]) => (
                                    <option key={key} value={key}>{template.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Editable Prompt */}
                        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
                            <TextArea
                                className="transcription-textarea"
                                value={customPromptText}
                                onChange={(e) => setCustomPromptText(e.target.value)}
                                style={{
                                    resize: 'vertical',
                                    minHeight: '160px', // Slightly larger start
                                    border: '1px solid var(--jkl-color-border-input)',
                                    color: 'var(--jkl-color-text-subdued)',
                                    overflowY: 'auto' // Allow scrolling naturally
                                }}
                            />
                        </div>

                        {/* Action Button (Compact Play Style) */}
                        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                            <button
                                onClick={handleGenerateSummary}
                                disabled={!transcriptionText || isSummarizing}
                                title="Generer svar"
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'var(--jkl-color-background-action)',
                                    color: 'var(--jkl-color-text-on-action)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    zIndex: 10
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {isSummarizing ? <Loader variant="small" /> : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* AI Response Area */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h2 className="jkl-heading-2" style={{ margin: 0 }}>
                                    Resultat
                                </h2>
                                <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
                                    <TertiaryButton onClick={handleDownloadSummary} disabled={!summaryResult} title="Last ned sammendrag">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                    </TertiaryButton>
                                    <TertiaryButton onClick={handleCopySummary} disabled={!summaryResult} title="Kopier sammendrag">
                                        {summaryCopySuccess ? 'Kopiert!' : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        )}
                                    </TertiaryButton>
                                </div>
                            </div>
                            <TextArea
                                className="transcription-textarea"
                                value={summaryResult}
                                readOnly
                                placeholder="Her kommer resultatet av AI-sammendraget med instruksjonen fra ovenfor..."
                                style={{ flex: 1, resize: 'vertical', minHeight: '400px' }}
                            />
                        </div>
                    </Card>
                </section>
            </div>
        </div >
    )
}
