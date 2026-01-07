import AudioRecorder from '../components/AudioRecorder'

function RecordPage() {
    const handleTranscriptionComplete = (result) => {
        console.log('Transcription complete:', result)
        // Could navigate to results page or show toast notification
    }

    return (
        <div>
            <h2 className="jkl-heading-2" style={{ marginBottom: 'var(--jkl-spacing-16)' }}>
                Ta opp og transkriber
            </h2>

            <p className="jkl-body" style={{ marginBottom: 'var(--jkl-spacing-32)', color: 'var(--jkl-color-text-subdued)' }}>
                Ta opp lyd direkte i nettleseren. Opptaket blir transkribert når du stopper.
            </p>

            <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
        </div>
    )
}

export default RecordPage
