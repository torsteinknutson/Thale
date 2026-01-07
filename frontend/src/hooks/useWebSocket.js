import { useState, useRef, useCallback } from 'react'

/**
 * Custom hook for managing WebSocket connections.
 * Provides connect/disconnect methods and message handling.
 */
export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const [lastMessage, setLastMessage] = useState(null)
    const [error, setError] = useState(null)
    const socketRef = useRef(null)

    const connect = useCallback((url) => {
        // Close existing connection if any
        if (socketRef.current) {
            socketRef.current.close()
        }

        try {
            // Construct absolute WS URL based on current window location
            // This works with Vite proxy in dev and Nginx in prod
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host
            const fullUrl = `${protocol}//${host}${url}`

            console.log('Connecting to WebSocket:', fullUrl)

            const socket = new WebSocket(fullUrl)
            socketRef.current = socket

            socket.onopen = () => {
                console.log('WebSocket connected')
                setIsConnected(true)
                setError(null)
            }

            socket.onclose = (event) => {
                console.log('WebSocket disconnected', event.code, event.reason)
                setIsConnected(false)
            }

            socket.onerror = (event) => {
                console.error('WebSocket error:', event)
                setError('Kunne ikke koble til serveren via WebSocket')
            }

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    setLastMessage(data)
                } catch (e) {
                    console.warn('Received non-JSON message:', event.data)
                }
            }

        } catch (err) {
            console.error('WebSocket connection failed:', err)
            setError(err.message)
        }
    }, [])

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close()
            socketRef.current = null
        }
        setIsConnected(false)
    }, [])

    const sendMessage = useCallback((data) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(data)
        } else {
            console.warn('Cannot send message: WebSocket not connected')
        }
    }, [])

    return {
        isConnected,
        lastMessage,
        error,
        connect,
        disconnect,
        sendMessage
    }
}
