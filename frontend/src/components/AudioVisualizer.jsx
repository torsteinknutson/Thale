import { useEffect, useRef } from 'react'

export function AudioVisualizer({ stream, isRecording, width = 300, height = 60 }) {
    const canvasRef = useRef(null)
    const animationRef = useRef(null)
    const analyserRef = useRef(null)
    const sourceRef = useRef(null)
    const audioContextRef = useRef(null)
    const smoothedDataRef = useRef(null)

    useEffect(() => {
        if (!stream || !canvasRef.current || !isRecording) {
            // Cleanup if recording stops
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
            return
        }

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
            }
        } catch (e) {
            console.error("Failed to create AudioContext", e)
            return
        }

        const audioContext = audioContextRef.current

        // Create analyser
        if (!analyserRef.current) {
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 128 // Increased for more bars
            analyser.smoothingTimeConstant = 0.8 // Smooth out rapid changes
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
        
        // Initialize smoothed data array for interpolation
        if (!smoothedDataRef.current) {
            smoothedDataRef.current = new Array(bufferLength).fill(0)
        }
        const smoothedData = smoothedDataRef.current

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw)
            analyser.getByteFrequencyData(dataArray)

            // Clear canvas completely (transparent background)
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

            const barCount = Math.min(32, bufferLength)
            const barWidth = (canvas.width / barCount) * 0.7 // 70% width, 30% gap
            const gap = (canvas.width / barCount) * 0.3

            for (let i = 0; i < barCount; i++) {
                // Sample from lower 70% of frequency range (skip highest frequencies)
                const dataIndex = Math.floor((i / barCount) * bufferLength * 0.7)
                const rawValue = dataArray[dataIndex]
                
                // Smooth the data for fluid animation
                smoothedData[i] = smoothedData[i] * 0.7 + rawValue * 0.3
                
                const normalizedHeight = (smoothedData[i] / 255) * canvas.height * 0.9
                const barHeight = Math.max(2, normalizedHeight) // Minimum height of 2px
                
                const x = i * (barWidth + gap) + gap / 2
                const y = canvas.height - barHeight

                // Simple solid teal color - minimalistic
                canvasCtx.fillStyle = 'rgba(0, 150, 160, 0.8)'

                // Draw rounded rectangle
                const radius = Math.min(barWidth / 2, 3)
                canvasCtx.beginPath()
                canvasCtx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0])
                canvasCtx.fill()
            }
        }

        draw()

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
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

    return <canvas ref={canvasRef} width={width} height={height} className="audio-visualizer" style={{ width: '100%', maxWidth: `${width}px` }} />
}

