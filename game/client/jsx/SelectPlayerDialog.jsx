import React from 'react';
import Dialog from "./components/Dialog";
import Token from "./Token";
import {gameService} from './services/GameService';

const SKIN_CATEGORIES = {
    'Meme': [],
    'Classic': ['hat-cowboy-side', 'dog', 'cat', 'car', 'ship', 'frog'],
    'Crypto': ['gem', 'crown', 'bolt', 'rocket', 'star', 'fire'],
    'Dark': ['ghost', 'skull', 'dragon']
};

const MEME_TOKENS = [
    {id: 'meme-apple', name: 'Apple', src: './tokens/apple.avif'},
    {id: 'meme-turtle', name: 'Mister Turtle', src: './tokens/mister turtle.avif'},
    {id: 'meme-tokabu', name: 'Tokabu', src: './tokens/tokabu.avif'},
    {id: 'meme-kintara', name: 'Kintara', src: './tokens/kintara.avif'},
    {id: 'meme-triplet', name: 'TRipleT', src: './tokens/TRipleT.avif'},
    {id: 'meme-neet', name: 'Neet', src: './tokens/neet.avif'},
    {id: 'meme-troll', name: 'Troll', src: './tokens/troll.avif'},
    {id: 'meme-jotchua', name: 'Jotchua', src: './tokens/jotchua.avif'},
];

const TOKEN_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export default class SelectPlayerDialog extends React.Component {
    state = {
        newPlayer: {
            name: '',
            token: '',
            customImage: null,
            tokenColor: '#38bdf8',
            error: ''
        },
        activeCategory: 'Meme',
        useCustomImage: false
    }

    setPlayerName = (event) => {
        const player = {...this.state.newPlayer};
        player.name = event.target.value;
        this.setState({newPlayer: player});
    }

    selectToken = (token) => {
        const player = {...this.state.newPlayer};
        player.token = token;
        player.customImage = null;
        this.setState({newPlayer: player, useCustomImage: false});
    }

    selectMemeToken = (meme) => {
        const player = {...this.state.newPlayer};
        player.token = meme.id;
        player.customImage = meme.src;
        this.setState({newPlayer: player, useCustomImage: false, activeCategory: 'Meme'});
    }

    selectColor = (color) => {
        const player = {...this.state.newPlayer};
        player.tokenColor = color;
        this.setState({newPlayer: player});
    }

    handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) {
            this.setState({newPlayer: {...this.state.newPlayer, error: 'Image must be under 500KB'}});
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const player = {...this.state.newPlayer};
            player.customImage = ev.target.result;
            player.token = 'custom-' + Date.now();
            this.setState({newPlayer: player, useCustomImage: true});
        };
        reader.readAsDataURL(file);
    }

    addPlayer = () => {
        const player = this.state.newPlayer;
        if (player.name.length === 0) {
            this.setState({newPlayer: {...player, error: 'Name is empty'}});
            return;
        }
        if (!player.token && !player.customImage) {
            this.setState({newPlayer: {...player, error: 'Select a token or upload an image'}});
            return;
        }
        if (this.props.game.players.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
            this.setState({newPlayer: {...player, error: 'Player with that name already exists'}});
            return;
        }

        gameService.addNewPlayer({
            name: player.name,
            token: player.token,
            customImage: player.customImage || null,
            tokenColor: player.tokenColor
        });
    }

    selectPlayer = (player) => {
        gameService.currentPlayer = player.id;
        gameService.sendToWs('dull', 'dull');
    }

    render() {
        const availablePlayers = this.props.game.players.filter(p => p.id !== 1);
        const usedTokens = availablePlayers.map(p => p.token);
        const cat = SKIN_CATEGORIES[this.state.activeCategory] || [];
        const availableTokens = cat.filter(t => usedTokens.indexOf(t) === -1);

        return (<Dialog>
            <div className="select-player-dialog">
                {availablePlayers.length > 0 && <div className="select-player">
                    <h1>Play as</h1>
                    {availablePlayers.map(p => <div key={p.id} onClick={() => this.selectPlayer(p)} className="player">
                        <Token token={p.token} customImage={p.customImage} color={p.tokenColor}/>
                        {p.name}
                    </div>)}
                </div>}
                {!this.props.game.started && <div className="new-player">
                    {availablePlayers.length > 0 && <h3>Or create a new Player</h3>}
                    {availablePlayers.length === 0 && <h1>Create a new Player</h1>}
                    <div>
                        <input type="text" placeholder="Player name" value={this.state.newPlayer.name}
                               onChange={this.setPlayerName}/>
                    </div>

                    <div className="skin-tabs">
                        {Object.keys(SKIN_CATEGORIES).map(cat => (
                            <button key={cat}
                                className={`skin-tab ${this.state.activeCategory === cat ? 'active' : ''}`}
                                onClick={() => this.setState({activeCategory: cat, useCustomImage: false})}>
                                {cat}
                            </button>
                        ))}
                        <button
                            className={`skin-tab ${this.state.useCustomImage ? 'active' : ''}`}
                            onClick={() => this.fileInput && this.fileInput.click()}>
                            Upload
                        </button>
                    </div>

                    <input
                        ref={el => this.fileInput = el}
                        type="file"
                        accept="image/*"
                        style={{display: 'none'}}
                        onChange={this.handleImageUpload}
                    />

                    {!this.state.useCustomImage && this.state.activeCategory === 'Meme' && <div className="tokens meme-tokens">
                        {MEME_TOKENS.filter(m => usedTokens.indexOf(m.id) === -1).map(m => (
                            <span key={m.id} onClick={() => this.selectMemeToken(m)} title={m.name}>
                                <Token customImage={m.src} selected={this.state.newPlayer.token === m.id} color={this.state.newPlayer.tokenColor}/>
                            </span>
                        ))}
                    </div>}

                    {!this.state.useCustomImage && this.state.activeCategory !== 'Meme' && <div className="tokens">
                        {availableTokens.map(t => <span key={t} onClick={() => this.selectToken(t)}>
                            <Token token={t} selected={this.state.newPlayer.token === t} color={this.state.newPlayer.tokenColor}/>
                        </span>)}
                        {availableTokens.length === 0 && <p className="muted">All tokens in this category are taken</p>}
                    </div>}

                    {this.state.useCustomImage && this.state.newPlayer.customImage && (
                        <div className="tokens">
                            <Token customImage={this.state.newPlayer.customImage} selected={true} color={this.state.newPlayer.tokenColor}/>
                            <span className="muted" style={{marginLeft: 10}}>Custom image selected</span>
                        </div>
                    )}

                    <p style={{fontSize: 12, marginTop: 8}}>Token color:</p>
                    <div className="color-picker">
                        {TOKEN_COLORS.map(c => (
                            <div key={c}
                                className={`color-swatch ${this.state.newPlayer.tokenColor === c ? 'active' : ''}`}
                                style={{backgroundColor: c}}
                                onClick={() => this.selectColor(c)}
                            />
                        ))}
                    </div>

                    <button onClick={this.addPlayer}>Start</button>
                    {this.state.newPlayer.error && <span className="error-msg">&nbsp;{this.state.newPlayer.error}</span>}
                </div>}
            </div>
        </Dialog>)
    }
}
