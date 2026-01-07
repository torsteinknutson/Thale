import { Link } from 'react-router-dom'
import { PrimaryButton } from '@fremtind/jokul/button'

function HomePage() {
    return (
        <div>
            {/* Hero Section */}
            <section className="hero">
                <h2 className="jkl-heading-1 hero__title">
                    Transkriber møter enkelt
                </h2>
                <p className="jkl-body hero__description">
                    Last opp lydopptak eller ta opp direkte i nettleseren.
                    THALE transkriberer automatisk og kan generere AI-drevne oppsummeringer.
                </p>
                <Link to="/transcribe">
                    <PrimaryButton>
                        Start transkripsjon
                    </PrimaryButton>
                </Link>
            </section>

            {/* Feature Cards */}
            <section className="feature-cards">
                <div className="feature-card">
                    <div className="feature-card__icon">📤</div>
                    <h3 className="jkl-heading-4 feature-card__title">Last opp filer</h3>
                    <p className="jkl-body">
                        Støtter .m4a, .wav, .mp3 og flere formater. Dra og slipp eller velg fil.
                    </p>
                </div>

                <div className="feature-card">
                    <div className="feature-card__icon">🎙️</div>
                    <h3 className="jkl-heading-4 feature-card__title">Ta opp direkte</h3>
                    <p className="jkl-body">
                        Start opptak direkte i nettleseren og se transkripsjon i sanntid.
                    </p>
                </div>

                <div className="feature-card">
                    <div className="feature-card__icon">🤖</div>
                    <h3 className="jkl-heading-4 feature-card__title">AI-oppsummering</h3>
                    <p className="jkl-body">
                        Generer automatiske møtereferater og handlingspunkter med Claude AI.
                    </p>
                </div>
            </section>
        </div>
    )
}

export default HomePage
