import { useState, useEffect, useRef } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useWebSocket } from '../hooks/useWebSocket'
import { AudioVisualizer } from '../components/AudioVisualizer'
import { PrimaryButton, SecondaryButton, TertiaryButton } from '@fremtind/jokul/button'
import { TextArea } from '@fremtind/jokul/text-area'
import { Loader } from '@fremtind/jokul/loader'
import { SuccessMessage, ErrorMessage, InfoMessage } from '@fremtind/jokul/message'
import { Card } from '@fremtind/jokul/card'

const PROMPT_TEMPLATES = {
    "oppsummering_kort": {
        label: "Oppsummering (kort)",
        text: "Lag en kort og konsis oppsummering av teksten under. Maks 5 setninger.\n\nTEKST:\n{text}"
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
        text: "Lag en kort ledersammendrag (executive summary) på norsk av følgende tekst.\nSammendraget skal være 2-3 avsnitt og dekke:\n- Hovedbudskapet/konklusjonen\n- Viktigste funn eller beslutninger\n- Anbefalte neste steg\n\nTEKST:\n{text}\n\nLEDERSAMMENDRAG:"
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
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        clearRecording,
        stream,
    } = useAudioRecorder()

    // WebSocket Hook for Live Transcription
    const {
        isConnected,
        lastMessage,
        connect,
        disconnect,
        sendMessage
    } = useWebSocket()

    // State
    // State
    const [transcriptionText, setTranscriptionText] = useState('')
    const [isLiveMode, setIsLiveMode] = useState(true) // Default to live mode
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [isSummarizing, setIsSummarizing] = useState(false)

    // AI Summary State
    const [selectedPromptKey, setSelectedPromptKey] = useState('motereferat')
    const [customPromptText, setCustomPromptText] = useState(PROMPT_TEMPLATES['motereferat'].text)
    const [summaryResult, setSummaryResult] = useState('')

    const [error, setError] = useState(null)
    const [copySuccess, setCopySuccess] = useState(false)

    // Handle incoming WebSocket messages
    useEffect(() => {
        if (lastMessage && lastMessage.text) {
            // Append or replace? 
            // For simple streaming, we might just get the latest chunk or full text.
            // Our backend currently sends the *full* text of the buffer.
            setTranscriptionText(lastMessage.text)
        }
    }, [lastMessage])

    // Start Recording Handler
    const handleStartRecording = async () => {
        setError(null)
        setSummaryResult('')
        setTranscriptionText('')
        setCopySuccess(false)

        if (isLiveMode) {
            connect('/api/streaming/realtime')
        }

        await startRecording((chunk) => {
            if (isLiveMode) {
                sendMessage(chunk)
            }
        })
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
            const response = await fetch('/api/summarize', {
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

    const [transcriptionProgress, setTranscriptionProgress] = useState(0)

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

            while (true) {
                const { value, done } = await reader.read()

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
            <div className="dashboard-grid">

                {/* Left Column: Recording Controls */}
                <section className="dashboard-section recording-section">
                    <Card className="dashboard-card">
                        <h2 className="jkl-heading-2">Opptak</h2>

                        <div className="visualizer-container">
                            {/* Audio Visualizer */}
                            <AudioVisualizer stream={stream} isRecording={isRecording} />

                            {/* Timer */}
                            <div className="timer-display jkl-heading-1">
                                {formattedTime}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="controls-container">
                            {!isRecording ? (
                                <button
                                    className="record-btn-large"
                                    onClick={handleStartRecording}
                                    title="Start opptak"
                                >
                                    <div className="record-icon"></div>
                                </button>
                            ) : (
                                <div className="active-controls">
                                    <button
                                        className="stop-btn-large"
                                        onClick={handleStopRecording}
                                        title="Stopp opptak"
                                    >
                                        <div className="stop-icon"></div>
                                    </button>

                                    <div className="secondary-controls">
                                        <SecondaryButton onClick={isPaused ? resumeRecording : pauseRecording}>
                                            {isPaused ? 'Fortsett' : 'Pause'}
                                        </SecondaryButton>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Settings & Upload */}
                        <div className="recording-settings" style={{ gap: '1rem', alignItems: 'center', position: 'relative' }}>
                            <label className="custom-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={isLiveMode}
                                    onChange={(e) => setIsLiveMode(e.target.checked)}
                                />
                                <span>Sanntid</span>
                            </label>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                                accept="audio/*,.m4a,.wav,.mp3,.aac,.flac,.ogg,.webm"
                            />

                            <TertiaryButton
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isTranscribing || isRecording}
                                title="Last opp fil"
                            >
                                {isTranscribing ? <Loader /> : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                )}
                            </TertiaryButton>
                        </div>

                        {/* File Transcription Status */}
                        {isTranscribing && (
                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <InfoMessage>Transkriberer fil... ({Math.round(transcriptionProgress)}%)</InfoMessage>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    background: '#eee',
                                    borderRadius: '4px',
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
                        )}

                        {/* Post-recording actions */}
                        {audioBlob && !isRecording && (
                            <div className="post-recording-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                                <PrimaryButton onClick={handleTranscribeFile} disabled={isTranscribing}>
                                    {isTranscribing ? <Loader /> : 'Transkriber opptak'}
                                </PrimaryButton>
                            </div>
                        )}

                        {error && <ErrorMessage className="mt-4">{error}</ErrorMessage>}
                        {recordingError && <ErrorMessage className="mt-4">{recordingError}</ErrorMessage>}
                    </Card>
                </section>

                {/* Right Column: Transcription & Summary */}
                <section className="dashboard-section results-section">

                    {/* Transcription Area */}
                    <Card className="dashboard-card results-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div className="card-header">
                            <h2 className="jkl-heading-3">Transkripsjon</h2>
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
                            placeholder="Her kommer transkripsjonen..."
                            style={{ flex: 1 }}
                        />
                        <p className="jkl-small" style={{ marginTop: '8px', color: 'var(--jkl-color-text-subdued)' }}>
                            Du kan redigere teksten her før du lager sammendrag.
                        </p>
                    </Card>
                </section>

                {/* Third Column: AI Summary */}
                <section className="dashboard-section ai-section">
                    <Card className="dashboard-card ai-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

                        {/* Header with Title and Dropdown */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                            <h2 className="jkl-heading-2" style={{ margin: 0 }}>Sammendrag</h2>
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
                        <div style={{ marginBottom: '24px' }}>
                            <TextArea
                                className="transcription-textarea" // Re-use this class for consistency
                                value={customPromptText}
                                onChange={(e) => setCustomPromptText(e.target.value)}
                                rows={12}
                                style={{ fontSize: '0.9rem', fontFamily: 'monospace', resize: 'vertical', minHeight: '250px' }}
                            />
                        </div>

                        {/* Action Button */}
                        <div style={{ marginBottom: '24px' }}>
                            <PrimaryButton
                                onClick={handleGenerateSummary}
                                disabled={!transcriptionText || isSummarizing}
                                style={{ width: '100%' }}
                            >
                                {isSummarizing ? <Loader /> : '✨ Generer svar med Bedrock'}
                            </PrimaryButton>
                        </div>

                        {/* AI Response Area */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 className="jkl-heading-3" style={{ marginBottom: '12px' }}>
                                Resultat
                            </h3>
                            <TextArea
                                className="transcription-textarea" // Re-use this class for consistency
                                value={summaryResult}
                                readOnly
                                placeholder="Resultatet kommer her..."
                                style={{ flex: 1 }}
                            />
                        </div>
                    </Card>
                </section>
            </div>
        </div>
    )
}
