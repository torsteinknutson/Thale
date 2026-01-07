import { useEffect, useRef } from 'react'

export function AudioVisualizer({ stream, isRecording }) {
    const canvasRef = useRef(null)
    const animationRef = useRef(null)
    const analyserRef = useRef(null)
    const sourceRef = useRef(null)
    const audioContextRef = useRef(null)

    useEffect(() => {
        if (!stream || !canvasRef.current || !isRecording) {
            // Cleanup if recording stops
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
            return
        }

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }

        const audioContext = audioContextRef.current

        // Create analyser
        if (!analyserRef.current) {
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 64 // Lower FFT size for fewer, wider bars
            analyserRef.current = analyser
        }
        const analyser = analyserRef.current

        // Create source
        if (sourceRef.current) {
            sourceRef.current.disconnect()
        }
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        sourceRef.current = source

        const canvas = canvasRef.current
        const canvasCtx = canvas.getContext('2d')
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw)
            analyser.getByteFrequencyData(dataArray)

            // Clear canvas
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

            const barWidth = (canvas.width / bufferLength) * 2.5
            let barHeight
            let x = 0

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2 // Scale down height

                // Gradient color based on height/intensity
                // Using Jøkul-like colors (blue to purple)
                const r = barHeight + 25 * (i / bufferLength)
                const g = 50
                const b = 200

                canvasCtx.fillStyle = `rgb(${r},${g},${b})`

                // Draw rounded bars? For now simple rects
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

                x += barWidth + 1
            }
        }

        draw()

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
            // Don't close audio context here as it might be reused, or close it on unmount
        }
    }, [stream, isRecording])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close()
            }
        }
    }, [])

    return <canvas ref={canvasRef} width="300" height="60" className="audio-visualizer" style={{ width: '100%', maxWidth: '300px' }} />
}
