import { useState, useEffect, useRef } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useWebSocket } from '../hooks/useWebSocket'
import { AudioVisualizer } from '../components/AudioVisualizer'
import { PrimaryButton, SecondaryButton, TertiaryButton } from '@fremtind/jokul/button'
import { TextArea } from '@fremtind/jokul/text-area'
import { Loader } from '@fremtind/jokul/loader'
import { SuccessMessage, ErrorMessage, InfoMessage } from '@fremtind/jokul/message'
import { Card } from '@fremtind/jokul/card'

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
    const [transcriptionText, setTranscriptionText] = useState('')
    const [isLiveMode, setIsLiveMode] = useState(true) // Default to live mode
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [isSummarizing, setIsSummarizing] = useState(false)
    const [summary, setSummary] = useState(null)
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
        setSummary(null)
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
    const handleSummarize = async () => {
        if (!transcriptionText) return

        setIsSummarizing(true)
        setError(null)

        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcriptionText,
                    style: 'meeting_notes' // Default style
                })
            })

            if (!response.ok) throw new Error('Oppsummering feilet')

            const result = await response.json()
            setSummary(result.summary)
        } catch (err) {
            setError(err.message)
        } finally {
            setIsSummarizing(false)
        }
    }

    // Copy Handler
    const handleCopy = () => {
        navigator.clipboard.writeText(transcriptionText)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
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
        setSummary(null)

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
                        <div className="recording-settings" style={{ gap: '1rem', alignItems: 'center' }}>
                            <label className="custom-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={isLiveMode}
                                    onChange={(e) => setIsLiveMode(e.target.checked)}
                                />
                                <span>Sanntidstranskribering</span>
                            </label>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                                accept="audio/*,.m4a,.wav,.mp3,.aac,.flac,.ogg,.webm"
                            />

                            <SecondaryButton
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isTranscribing || isRecording}
                            >
                                {isTranscribing ? <Loader /> : 'Last opp fil'}
                            </SecondaryButton>
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
                        {audioBlob && !isRecording && !isLiveMode && (
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
                    <Card className="dashboard-card results-card">
                        <div className="card-header">
                            <h2 className="jkl-heading-3">Transkripsjon</h2>
                            <div className="card-actions">
                                <TertiaryButton onClick={handleCopy}>
                                    {copySuccess ? 'Kopiert!' : 'Kopier tekst'}
                                </TertiaryButton>
                            </div>
                        </div>

                        <TextArea
                            className="transcription-textarea"
                            value={transcriptionText}
                            onChange={(e) => setTranscriptionText(e.target.value)}
                            placeholder="Her kommer teksten..."
                            rows={15}
                            autoExpand
                        />

                        <div className="action-bar">
                            <PrimaryButton
                                onClick={handleSummarize}
                                disabled={!transcriptionText || isSummarizing}
                            >
                                {isSummarizing ? 'Genererer...' : '✨ Lag AI-sammendrag'}
                            </PrimaryButton>
                        </div>
                    </Card>

                    {/* Summary Area */}
                    {summary && (
                        <Card className="dashboard-card summary-card fade-in">
                            <h2 className="jkl-heading-3">Sammendrag (Bedrock)</h2>
                            <div className="summary-content">
                                {summary.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                        </Card>
                    )}
                </section>
            </div>
        </div>
    )
}
