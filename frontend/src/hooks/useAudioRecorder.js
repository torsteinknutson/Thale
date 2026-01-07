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

    const startRecording = useCallback(async (onDataAvailable) => {
        setError(null)
        setPermissionDenied(false)
        audioChunksRef.current = []
        setAudioBlob(null)

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            })

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

                // Clean up stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop())
                    streamRef.current = null
                }
            }

            // Start recording
            mediaRecorder.start(1000) // Collect data every second
            setIsRecording(true)
            setRecordingTime(0)

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)

        } catch (err) {
            console.error('Error starting recording:', err)

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setPermissionDenied(true)
                setError('Mikrofontilgang ble avvist. Vennligst gi tilgang i nettleserinnstillingene.')
            } else if (err.name === 'NotFoundError') {
                setError('Ingen mikrofon funnet. Koble til en mikrofon og prøv igjen.')
            } else {
                setError(`Kunne ikke starte opptak: ${err.message}`)
            }
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
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        clearRecording,
    }
}

export default useAudioRecorder
