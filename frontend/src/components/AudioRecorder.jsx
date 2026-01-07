import { useState, useRef, useCallback } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { PrimaryButton, SecondaryButton } from '@fremtind/jokul/button'
import { Loader } from '@fremtind/jokul/loader'
import { SuccessMessage, ErrorMessage } from '@fremtind/jokul/message'

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

    const [isTranscribing, setIsTranscribing] = useState(false)
    const [transcription, setTranscription] = useState(null)
    const [error, setError] = useState(null)

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
    }

    return (
        <div className="audio-recorder">
            {/* Recording Controls */}
            <div className="recording-controls">
                {!audioBlob && !isRecording && (
                    <>
                        <button
                            className="recording-button"
                            onClick={startRecording}
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
                            onClick={stopRecording}
                            aria-label="Stopp opptak"
                        >
                            ⏹️
                        </button>
                        <p className="jkl-heading-3 recording-time">{formattedTime}</p>
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
                            <SecondaryButton onClick={stopRecording}>
                                ⏹️ Stopp
                            </SecondaryButton>
                        </div>
                    </>
                )}

                {audioBlob && !isRecording && !transcription && (
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
            </div>

            {/* Loading State */}
            {isTranscribing && (
                <div style={{ marginTop: 'var(--jkl-spacing-32)', textAlign: 'center' }}>
                    <Loader textDescription="Transkriberer opptak..." />
                </div>
            )}

            {/* Error Messages */}
            {(recordingError || error) && (
                <div style={{ marginTop: 'var(--jkl-spacing-16)' }}>
                    <ErrorMessage>{recordingError || error}</ErrorMessage>
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

            {/* Transcription Result */}
            {transcription && (
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
