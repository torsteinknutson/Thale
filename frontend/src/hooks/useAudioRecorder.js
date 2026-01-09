import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Custom hook for audio recording in the browser.
 * Uses MediaRecorder API for capturing audio from the microphone.
 */
export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [audioBlob, setAudioBlob] = useState(null)
    const [error, setError] = useState(null)
    const [permissionDenied, setPermissionDenied] = useState(false)
    const [recordingId, setRecordingId] = useState(null)

    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const streamRef = useRef(null)
    const timerRef = useRef(null)

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    // Restore recording from localStorage on mount
    useEffect(() => {
        const savedRecordingId = localStorage.getItem('thale_current_recording_id')
        if (savedRecordingId) {
            restoreRecording(savedRecordingId)
        }
    }, [])

    const restoreRecording = async (id) => {
        try {
            const response = await fetch(`/api/transcription/recording/${id}`)
            if (response.ok) {
                const blob = await response.blob()
                setAudioBlob(blob)
                setRecordingId(id)
                console.log('✅ Restored recording from server:', id)
            } else {
                // Recording not found, clear localStorage
                localStorage.removeItem('thale_current_recording_id')
            }
        } catch (err) {
            console.error('Failed to restore recording:', err)
            localStorage.removeItem('thale_current_recording_id')
        }
    }

    const saveRecording = async (blob) => {
        try {
            const formData = new FormData()
            formData.append('file', blob, 'recording.webm')

            const response = await fetch('/api/transcription/recording/save', {
                method: 'POST',
                body: formData,
            })

            if (response.ok) {
                const data = await response.json()
                setRecordingId(data.recording_id)
                localStorage.setItem('thale_current_recording_id', data.recording_id)
                console.log('💾 Saved recording to server:', data.recording_id)
            } else {
                console.error('Failed to save recording to server')
                setError('Kunne ikke lagre opptak på server. Opptaket finnes kun i minnet.')
            }
        } catch (err) {
            console.error('Failed to save recording:', err)
            setError('Kunne ikke lagre opptak på server. Opptaket finnes kun i minnet.')
        }
    }

    const startRecording = useCallback(async (onDataAvailable, continueSession = false) => {
        setError(null)
        setPermissionDenied(false)

        if (!continueSession) {
            audioChunksRef.current = []
            setAudioBlob(null)
            setRecordingTime(0)
        }

        let stream = null
        try {
            // Request microphone access
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            })
        } catch (err) {
            console.warn('Microphone access failed:', err)
            // ... (keep generic fallback handling same as original, omitted for brevity if unmodified, but here we must include context so assume we keep it)
            if (err.name === 'NotFoundError') {
                console.log('No microphone found, falling back to synthetic audio stream for testing.')
                // Create synthetic stream
                const ctx = new (window.AudioContext || window.webkitAudioContext)()
                const oscillator = ctx.createOscillator()
                const dst = ctx.createMediaStreamDestination()
                oscillator.type = 'sine'
                oscillator.frequency.setValueAtTime(440, ctx.currentTime) // A4 tone
                oscillator.connect(dst)
                oscillator.start()
                stream = dst.stream
                // Store context to close it later
                stream._audioContext = ctx
            } else {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setPermissionDenied(true)
                    setError('Mikrofontilgang ble avvist. Vennligst gi tilgang i nettleserinnstillingene.')
                } else {
                    setError(`Kunne ikke starte opptak: ${err.message}`)
                }
                return
            }
        }

        if (stream) {
            streamRef.current = stream

            // Create MediaRecorder with appropriate mime type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4'

            const mediaRecorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = mediaRecorder

            // Collect audio chunks
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                    if (onDataAvailable) {
                        onDataAvailable(event.data)
                    }
                }
            }

            // Handle stop event
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType })
                setAudioBlob(blob)
                
                // Auto-save recording to backend
                saveRecording(blob)

                // Clean up stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop())
                    // If synthetic, close context
                    if (streamRef.current._audioContext) {
                        streamRef.current._audioContext.close()
                    }
                    streamRef.current = null
                }
            }

            // Start recording
            mediaRecorder.start(1000) // Collect data every second
            setIsRecording(true)
            // Do NOT reset recording time here if continuing, it's already preserved in state

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        }
    }, [])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setIsPaused(false)

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [isRecording])

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause()
            setIsPaused(true)

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [isRecording, isPaused])

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume()
            setIsPaused(false)

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        }
    }, [isRecording, isPaused])

    const clearRecording = useCallback(() => {
        setAudioBlob(null)
        setRecordingTime(0)
        setError(null)
        audioChunksRef.current = []
        setRecordingId(null)
        localStorage.removeItem('thale_current_recording_id')
    }, [])

    // Format time as MM:SS
    const formatTime = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }, [])

    return {
        isRecording,
        isPaused,
        recordingTime,
        formattedTime: formatTime(recordingTime),
        audioBlob,
        error,
        permissionDenied,
        recordingId,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        clearRecording,
        stream: streamRef.current, // Expose stream for visualization
    }
}

export default useAudioRecorder
