import React from 'react';
import {gameService} from './services/GameService';

export default class AuthPanel extends React.Component {
    state = {
        mode: 'login',
        username: '',
        password: '',
        email: '',
        error: '',
        loading: false
    }

    submit = () => {
        const {mode, username, password, email} = this.state;
        if (!username || !password) {
            this.setState({error: 'Username and password required'});
            return;
        }
        this.setState({loading: true, error: ''});

        if (mode === 'signup') {
            const ref = localStorage.getItem('memeopoly_referred_by') || null;
            gameService.ws.send(JSON.stringify({type: 'wsSignup', username, password, email, referredBy: ref}));
        } else {
            gameService.ws.send(JSON.stringify({type: 'wsLogin', username, password}));
        }
    }

    componentDidMount() {
        gameService.onAuthResult = (data) => {
            this.setState({loading: false});
            if (data.error) {
                this.setState({error: data.error});
            } else if (data.success) {
                if (this.props.onAuth) this.props.onAuth(data.account, data.token);
            }
        };
    }

    componentWillUnmount() {
        gameService.onAuthResult = null;
    }

    render() {
        const {mode, error, loading} = this.state;
        return (
            <div className="auth-panel">
                <div className="auth-tabs">
                    <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => this.setState({mode: 'login', error: ''})}>Login</button>
                    <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => this.setState({mode: 'signup', error: ''})}>Sign Up</button>
                </div>

                <input type="text" placeholder="Username" value={this.state.username}
                    onChange={e => this.setState({username: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && this.submit()} />

                <input type="password" placeholder="Password" value={this.state.password}
                    onChange={e => this.setState({password: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && this.submit()} />

                {mode === 'signup' && <input type="email" placeholder="Email (optional, for rewards)"
                    value={this.state.email}
                    onChange={e => this.setState({email: e.target.value})} />}

                {error && <div className="auth-error">{error}</div>}

                <button className="lobby-btn primary" onClick={this.submit} disabled={loading}>
                    {loading ? 'Loading...' : (mode === 'login' ? 'Login' : 'Create Account')}
                </button>

                {this.props.onSkip && <button className="auth-skip" onClick={this.props.onSkip}>Play as guest</button>}
            </div>
        );
    }
}
