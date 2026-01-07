import { useState, useRef } from 'react'
import { PrimaryButton, SecondaryButton } from '@fremtind/jokul/button'
import { Loader } from '@fremtind/jokul/loader'
import { SuccessMessage, ErrorMessage } from '@fremtind/jokul/message'

const ALLOWED_EXTENSIONS = ['.m4a', '.wav', '.mp3', '.aac', '.flac', '.ogg', '.webm']
const MAX_FILE_SIZE_MB = 500

function TranscribePage() {
    const [file, setFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [transcription, setTranscription] = useState(null)
    const [error, setError] = useState(null)
    const fileInputRef = useRef(null)

    const validateFile = (file) => {
        const ext = '.' + file.name.split('.').pop().toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return `Ugyldig filtype. Støttede formater: ${ALLOWED_EXTENSIONS.join(', ')}`
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return `Filen er for stor. Maks størrelse: ${MAX_FILE_SIZE_MB}MB`
        }
        return null
    }

    const handleFileSelect = (selectedFile) => {
        setError(null)
        const validationError = validateFile(selectedFile)
        if (validationError) {
            setError(validationError)
            return
        }
        setFile(selectedFile)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            handleFileSelect(droppedFile)
        }
    }

    const handleInputChange = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) {
            handleFileSelect(selectedFile)
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setIsUploading(true)
        setError(null)
        setTranscription(null)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('language', 'no')

            const response = await fetch('/api/transcription/upload', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`Feil ved opplasting: ${response.statusText}`)
            }

            const result = await response.json()
            setTranscription(result)
        } catch (err) {
            setError(err.message || 'Noe gikk galt. Prøv igjen.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleCopy = async () => {
        if (transcription?.text) {
            await navigator.clipboard.writeText(transcription.text)
            // TODO: Show toast notification
        }
    }

    const handleDownload = () => {
        if (transcription?.text) {
            const blob = new Blob([transcription.text], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `transcription-${transcription.id}.txt`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    const handleClear = () => {
        setFile(null)
        setTranscription(null)
        setError(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div>
            <h2 className="jkl-heading-2" style={{ marginBottom: 'var(--jkl-spacing-24)' }}>
                Transkriber lydfil
            </h2>

            {/* Upload Area */}
            <div
                className={`upload-area ${isDragging ? 'upload-area--active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_EXTENSIONS.join(',')}
                    onChange={handleInputChange}
                    style={{ display: 'none' }}
                />

                {file ? (
                    <>
                        <div className="upload-area__icon">📄</div>
                        <p className="jkl-body upload-area__text">
                            <strong>{file.name}</strong>
                        </p>
                        <p className="upload-area__hint">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                    </>
                ) : (
                    <>
                        <div className="upload-area__icon">📤</div>
                        <p className="jkl-body upload-area__text">
                            Dra og slipp en lydfil her, eller klikk for å velge
                        </p>
                        <p className="upload-area__hint">
                            Støttede formater: {ALLOWED_EXTENSIONS.join(', ')}
                        </p>
                    </>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div style={{ marginTop: 'var(--jkl-spacing-16)' }}>
                    <ErrorMessage>{error}</ErrorMessage>
                </div>
            )}

            {/* Action Buttons */}
            {file && !transcription && (
                <div style={{ marginTop: 'var(--jkl-spacing-24)', display: 'flex', gap: 'var(--jkl-spacing-16)' }}>
                    <PrimaryButton onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? 'Transkriberer...' : 'Start transkripsjon'}
                    </PrimaryButton>
                    <SecondaryButton onClick={handleClear} disabled={isUploading}>
                        Avbryt
                    </SecondaryButton>
                </div>
            )}

            {/* Loading State */}
            {isUploading && (
                <div style={{ marginTop: 'var(--jkl-spacing-32)', textAlign: 'center' }}>
                    <Loader textDescription="Transkriberer lydfil..." />
                </div>
            )}

            {/* Transcription Result */}
            {transcription && (
                <div className="transcription-result">
                    <div className="transcription-result__header">
                        <h3 className="jkl-heading-4">Transkripsjon</h3>
                        <div className="transcription-result__actions">
                            <SecondaryButton onClick={handleCopy}>
                                Kopier
                            </SecondaryButton>
                            <SecondaryButton onClick={handleDownload}>
                                Last ned
                            </SecondaryButton>
                            <SecondaryButton onClick={handleClear}>
                                Ny fil
                            </SecondaryButton>
                        </div>
                    </div>

                    <SuccessMessage>
                        Transkripsjon fullført! {transcription.word_count} ord på {transcription.processing_time_seconds?.toFixed(2)}s
                    </SuccessMessage>

                    <div className="transcription-result__text" style={{ marginTop: 'var(--jkl-spacing-16)' }}>
                        {transcription.text}
                    </div>
                </div>
            )}
        </div>
    )
}

export default TranscribePage
