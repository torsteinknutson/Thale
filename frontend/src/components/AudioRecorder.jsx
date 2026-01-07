import { useState, useEffect } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useWebSocket } from '../hooks/useWebSocket'
import { PrimaryButton, SecondaryButton } from '@fremtind/jokul/button'
import { Loader } from '@fremtind/jokul/loader'
import { SuccessMessage, ErrorMessage } from '@fremtind/jokul/message'
import { Checkbox } from '@fremtind/jokul/checkbox'

/**
 * Audio recorder component with real-time recording and transcription.
 */
function AudioRecorder({ onTranscriptionComplete }) {
    const {
        isRecording,
        isPaused,
        formattedTime,
        audioBlob,
        error: recordingError,
        permissionDenied,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        clearRecording,
    } = useAudioRecorder()

    const {
        isConnected,
        lastMessage,
        error: wsError,
        connect,
        disconnect,
        sendMessage
    } = useWebSocket()

    const [isTranscribing, setIsTranscribing] = useState(false)
    const [transcription, setTranscription] = useState(null)
    const [error, setError] = useState(null)
    const [isLiveMode, setIsLiveMode] = useState(false)
    const [liveText, setLiveText] = useState('')

    // Handle incoming WebSocket messages
    useEffect(() => {
        if (lastMessage && lastMessage.text) {
            setLiveText(lastMessage.text)
        }
    }, [lastMessage])

    const handleStartRecording = async () => {
        setError(null)
        setLiveText('')

        if (isLiveMode) {
            connect('/api/streaming/realtime')
        }

        await startRecording((chunk) => {
            if (isLiveMode) {
                // Send chunk if connected, otherwise it might be dropped (acceptable for MVP)
                // Ideally we'd buffer until connected
                sendMessage(chunk)
            }
        })
    }

    const handleStopRecording = () => {
        stopRecording()
        if (isLiveMode) {
            // Give a moment for final chunks to be sent/processed
            setTimeout(() => disconnect(), 1000)
        }
    }

    const handleTranscribe = async () => {
        if (!audioBlob) return

        setIsTranscribing(true)
        setError(null)
        setTranscription(null)

        try {
            const formData = new FormData()
            formData.append('file', audioBlob, 'recording.webm')
            formData.append('language', 'no')

            const response = await fetch('/api/transcription/upload', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Feil: ${response.statusText}`)
            }

            const result = await response.json()
            setTranscription(result)

            if (onTranscriptionComplete) {
                onTranscriptionComplete(result)
            }
        } catch (err) {
            setError(err.message || 'Noe gikk galt. Prøv igjen.')
        } finally {
            setIsTranscribing(false)
        }
    }

    const handleNewRecording = () => {
        clearRecording()
        setTranscription(null)
        setError(null)
        setLiveText('')
        if (isConnected) disconnect()
    }

    return (
        <div className="audio-recorder">
            {/* Recording Controls */}
            <div className="recording-controls">
                {!audioBlob && !isRecording && (
                    <>
                        <div style={{ marginBottom: 'var(--jkl-spacing-24)' }}>
                            <Checkbox
                                name="live-mode"
                                value="live"
                                checked={isLiveMode}
                                onChange={(e) => setIsLiveMode(e.target.checked)}
                            >
                                Sanntidstranskribering (Beta)
                            </Checkbox>
                        </div>

                        <button
                            className="recording-button"
                            onClick={handleStartRecording}
                            aria-label="Start opptak"
                        >
                            🎙️
                        </button>
                        <p className="jkl-body">Klikk for å starte opptak</p>
                    </>
                )}

                {isRecording && (
                    <>
                        <button
                            className={`recording-button recording-button--recording ${isPaused ? 'recording-button--paused' : ''}`}
                            onClick={handleStopRecording}
                            aria-label="Stopp opptak"
                        >
                            ⏹️
                        </button>
                        <p className="jkl-heading-3 recording-time">{formattedTime}</p>

                        {isLiveMode && (
                            <div style={{ marginTop: 'var(--jkl-spacing-16)', color: isConnected ? 'var(--jkl-color-success)' : 'var(--jkl-color-text-subdued)' }}>
                                {isConnected ? '🟢 Tilkoblet' : '⚪ Kobler til...'}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--jkl-spacing-8)' }}>
                            {isPaused ? (
                                <SecondaryButton onClick={resumeRecording}>
                                    ▶️ Fortsett
                                </SecondaryButton>
                            ) : (
                                <SecondaryButton onClick={pauseRecording}>
                                    ⏸️ Pause
                                </SecondaryButton>
                            )}
                            <SecondaryButton onClick={handleStopRecording}>
                                ⏹️ Stopp
                            </SecondaryButton>
                        </div>
                    </>
                )}

                {/* Live Transcription Display */}
                {isLiveMode && (isRecording || liveText) && (
                    <div className="transcription-result" style={{ marginTop: 'var(--jkl-spacing-24)', width: '100%', textAlign: 'left' }}>
                        <p className="jkl-small" style={{ marginBottom: 'var(--jkl-spacing-8)', color: 'var(--jkl-color-text-subdued)' }}>
                            Sanntidstranskripsjon:
                        </p>
                        <div className="transcription-result__text" style={{ minHeight: '100px', fontStyle: 'italic' }}>
                            {liveText || 'Snakk nå...'}
                        </div>
                    </div>
                )}

                {audioBlob && !isRecording && !transcription && !isLiveMode && (
                    <>
                        <div className="recording-preview">
                            <p className="jkl-body">🎵 Opptak klart ({formattedTime})</p>
                            <audio
                                src={URL.createObjectURL(audioBlob)}
                                controls
                                style={{ marginTop: 'var(--jkl-spacing-16)', width: '100%', maxWidth: '400px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--jkl-spacing-16)', marginTop: 'var(--jkl-spacing-24)' }}>
                            <PrimaryButton onClick={handleTranscribe} disabled={isTranscribing}>
                                {isTranscribing ? 'Transkriberer...' : 'Transkriber opptak'}
                            </PrimaryButton>
                            <SecondaryButton onClick={handleNewRecording} disabled={isTranscribing}>
                                Nytt opptak
                            </SecondaryButton>
                        </div>
                    </>
                )}

                {/* If live mode finished, show buttons to start new or save */}
                {audioBlob && !isRecording && isLiveMode && (
                    <div style={{ display: 'flex', gap: 'var(--jkl-spacing-16)', marginTop: 'var(--jkl-spacing-24)' }}>
                        <SecondaryButton onClick={handleNewRecording}>
                            Nytt opptak
                        </SecondaryButton>
                    </div>
                )}
            </div>

            {/* Loading State */}
            {isTranscribing && (
                <div style={{ marginTop: 'var(--jkl-spacing-32)', textAlign: 'center' }}>
                    <Loader textDescription="Transkriberer opptak..." />
                </div>
            )}

            {/* Error Messages */}
            {(recordingError || error || wsError) && (
                <div style={{ marginTop: 'var(--jkl-spacing-16)' }}>
                    <ErrorMessage>{recordingError || error || wsError}</ErrorMessage>
                </div>
            )}

            {/* Permission Denied Help */}
            {permissionDenied && (
                <div style={{ marginTop: 'var(--jkl-spacing-16)', padding: 'var(--jkl-spacing-16)', background: 'var(--jkl-color-background-container-high)', borderRadius: 'var(--jkl-spacing-8)' }}>
                    <p className="jkl-body"><strong>Slik gir du mikrofontilgang:</strong></p>
                    <ol style={{ marginTop: 'var(--jkl-spacing-8)', paddingLeft: 'var(--jkl-spacing-24)' }}>
                        <li>Klikk på hengelås-ikonet i adressefeltet</li>
                        <li>Finn "Mikrofon" i listen</li>
                        <li>Velg "Tillat"</li>
                        <li>Last inn siden på nytt</li>
                    </ol>
                </div>
            )}

            {/* Transcription Result (for non-live mode) */}
            {transcription && !isLiveMode && (
                <div className="transcription-result" style={{ marginTop: 'var(--jkl-spacing-32)' }}>
                    <div className="transcription-result__header">
                        <h3 className="jkl-heading-4">Transkripsjon</h3>
                        <SecondaryButton onClick={handleNewRecording}>
                            Nytt opptak
                        </SecondaryButton>
                    </div>

                    <SuccessMessage>
                        Transkripsjon fullført! {transcription.word_count} ord
                    </SuccessMessage>

                    <div className="transcription-result__text" style={{ marginTop: 'var(--jkl-spacing-16)' }}>
                        {transcription.text}
                    </div>
                </div>
            )}
        </div>
    )
}

export default AudioRecorder
