import React from 'react';
import AuthPanel from './AuthPanel';

export default class LandingPage extends React.Component {
    state = {
        showAuth: false,
        stats: null
    }

    componentDidMount() {
        fetch('/api/analytics').then(r => r.json()).then(stats => this.setState({stats})).catch(() => {});
    }

    render() {
        const {stats} = this.state;
        return (
            <div className="landing-page">
                <div className="landing-hero">
                    <h1 className="landing-title">Memeopoly</h1>
                    <p className="landing-subtitle">The meme-powered multiplayer board game</p>
                    <p className="landing-desc">Roll dice. Buy meme coins. Earn $MEMO tokens. Compete on the leaderboard. Build your meme empire.</p>

                    {stats && <div className="landing-stats">
                        <div className="landing-stat"><span className="stat-num">{stats.totalAccounts || 0}</span><span className="stat-label">Players</span></div>
                        <div className="landing-stat"><span className="stat-num">{stats.todayStats.logins || 0}</span><span className="stat-label">Online Today</span></div>
                        <div className="landing-stat"><span className="stat-num">{stats.todayStats.games || 0}</span><span className="stat-label">Games Today</span></div>
                    </div>}

                    <div className="landing-cta">
                        <button className="lobby-btn primary" onClick={() => this.setState({showAuth: true})}>Create Account</button>
                        <button className="lobby-btn secondary" onClick={this.props.onSkip}>Play as Guest</button>
                    </div>
                </div>

                {this.state.showAuth && <div className="landing-auth-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) this.setState({showAuth: false});
                }}>
                    <AuthPanel onAuth={this.props.onAuth} onSkip={this.props.onSkip} />
                </div>}

                <div className="landing-features">
                    <div className="feature-card"><i className="fas fa-dice"></i><h3>Multiplayer Rooms</h3><p>Create or join rooms. Play with friends in real-time.</p></div>
                    <div className="feature-card"><i className="fas fa-coins"></i><h3>Earn $MEMO</h3><p>Daily logins, passing GO, referrals, and achievements all earn tokens.</p></div>
                    <div className="feature-card"><i className="fas fa-trophy"></i><h3>Leaderboards</h3><p>Compete globally for XP, wins, and longest streaks.</p></div>
                    <div className="feature-card"><i className="fas fa-user-friends"></i><h3>Referral System</h3><p>Invite friends, earn 10% of their rewards forever.</p></div>
                    <div className="feature-card"><i className="fas fa-paint-brush"></i><h3>Custom Skins</h3><p>Unlock skins, choose colors, or upload your own game piece.</p></div>
                    <div className="feature-card"><i className="fas fa-chart-line"></i><h3>XP &amp; Levels</h3><p>Level up, unlock achievements, and build your player profile.</p></div>
                </div>

                <div className="landing-footer">
                    <p>CA: XXXX...XXXX</p>
                    <div className="landing-links">
                        <a href="#" target="_blank">Twitter</a>
                        <a href="#" target="_blank">Pump.fun</a>
                    </div>
                </div>
            </div>
        );
    }
}
