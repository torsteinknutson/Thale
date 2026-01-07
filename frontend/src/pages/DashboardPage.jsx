import { useState, useEffect, useRef } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useWebSocket } from '../hooks/useWebSocket'
import { AudioVisualizer } from '../components/AudioVisualizer'
import { PrimaryButton, SecondaryButton, TertiaryButton } from '@fremtind/jokul/button'
import { TextArea } from '@fremtind/jokul/text-area'
import { Loader } from '@fremtind/jokul/loader'
import { SuccessMessage, ErrorMessage, InfoMessage } from '@fremtind/jokul/message'
import { Card } from '@fremtind/jokul/card'
import { Checkbox } from '@fremtind/jokul/checkbox'

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

                        {/* Settings */}
                        <div className="recording-settings">
                            <Checkbox
                                name="live-mode"
                                value="live"
                                checked={isLiveMode}
                                onChange={(e) => setIsLiveMode(e.target.checked)}
                            >
                                Sanntidstranskribering
                            </Checkbox>
                        </div>

                        {/* Post-recording actions */}
                        {audioBlob && !isRecording && !isLiveMode && (
                            <div className="post-recording-actions">
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
