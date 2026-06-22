import React from 'react';
import Board from "./Board";

import {gameService} from "./services/GameService";
import Logs from "./Logs";
import Video from "./Video";
import Players from './Players';
import SelectPlayerDialog from "./SelectPlayerDialog";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faTimesCircle} from "@fortawesome/free-solid-svg-icons";
import {rtcService} from "./services/webrtc";
import Settings from "./Settings";
import HelpDialog from "./HelpDialog";
import ReferralPanel from "./ReferralPanel";
import Notifications from "./Notifications";
import WalletConnect from "./WalletConnect";
import Tutorial from "./Tutorial";
import RoomLobby from "./RoomLobby";
import LandingPage from "./LandingPage";
import Leaderboard from "./Leaderboard";
import ProfileView from "./ProfileView";
import VaultPanel from "./VaultPanel";

const MAX_LOGS = 200;

export default class App extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            logs: [],
            chat: [],
            cardToShow: null,
            showHelp: false,
            lostConnection: false,
            notifications: [],
            showTutorial: !localStorage.getItem('memeopoly_tutorial_done'),
            cpolyBalances: {},
            referralData: {},
            inRoom: false,
            roomId: null,
            connected: false,
            // Skeleton: auth state
            view: 'landing', // landing | lobby | game | profile | leaderboard
            account: null,
            authToken: null,
            showProfile: false,
            showLeaderboard: false,
            showVault: false
        };
    }

    componentDidMount() {
        const saved = localStorage.getItem('memeopoly_account');
        if (saved) {
            try {
                const account = JSON.parse(saved);
                this.setState({account, view: 'connecting'});
            } catch(e) {}
        }
        this.connectToGame();
    }

    connectToGame = () => {
        this.setState({game: null, connected: false}, () => {
            const location = window.location;
            let url = location.protocol.replace("http", "ws") + '//' + window.location.hostname + (location.port.length > 0 ? ':' + location.port : "") + location.pathname;
            const wsConnection = new WebSocket(url);

            wsConnection.onopen = () => {
                this.setState({connected: true, lostConnection: false}, () => {
                    if (this.state.view === 'connecting') {
                        this.setState({view: 'lobby'});
                    }
                    const urlParams = new URLSearchParams(window.location.search);
                    const roomFromUrl = urlParams.get('room');
                    if (roomFromUrl) {
                        gameService.joinRoom(roomFromUrl);
                    }
                });
            };

            wsConnection.onclose = () => {
                this.setState({lostConnection: true, connected: false, inRoom: false}, () => {
                    setTimeout(this.connectToGame, 1000);
                });
            }

            wsConnection.onmessage = this.updateGame;
            gameService.ws = wsConnection;
            rtcService.serverConnection = wsConnection;
        })
    }

    handleAuth = (account, token) => {
        localStorage.setItem('memeopoly_account', JSON.stringify(account));
        this.setState({account, authToken: token, view: 'lobby'});
        this.addNotification(`Welcome back, ${account.username}! Streak: ${account.stats.loginStreak} days`, 'reward', 'Login Bonus');
    }

    handleGuestPlay = () => {
        this.setState({view: 'lobby'});
    }

    handleLogout = () => {
        localStorage.removeItem('memeopoly_account');
        this.setState({account: null, authToken: null, view: 'landing', inRoom: false});
        gameService.leaveRoom();
    }

    updateGame = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'roomJoined') {
            gameService.currentRoom = data.roomId;
            this.setState({inRoom: true, roomId: data.roomId, view: 'game', showHelp: true});
        } else if (data.type === 'roomList') {
            if (gameService.onRoomList) gameService.onRoomList(data.rooms);
        } else if (data.type === 'authResult') {
            if (gameService.onAuthResult) gameService.onAuthResult(data);
        } else if (data.type === 'accountData') {
            if (data.account) {
                this.setState({account: data.account});
                localStorage.setItem('memeopoly_account', JSON.stringify(data.account));
            }
        } else if (data.type === 'leaderboard') {
            gameService.leaderboardData = data;
            this.forceUpdate();
        } else if (data.type === 'vaultState') {
            if (gameService.onVaultState) gameService.onVaultState(data.vault);
        } else if (data.type === 'tokenBalance') {
            if (gameService.onTokenBalance) gameService.onTokenBalance(data);
        } else if (data.type === 'game') {
            const game = data.game;
            gameService.game = game;
            this.setState({game: game});
        } else if (data.type === 'log') {
            this.setState({logs: data.message});
        } else if (data.type === 'chat') {
            this.setState({chat: data.message});
        } else if (data.type === 'cardDrawn') {
            this.setState({
                cardToShow: {
                    card: data.card,
                    player: data.player,
                    type: data.cardType,
                }
            });
            this.addNotification(`${data.player.name} drew a ${data.cardType} card`, 'info', 'Card Drawn');
        } else if (data.type === 'cpoly') {
            this.setState({cpolyBalances: data.balances || {}, referralData: data.referrals || {}});
            const myId = gameService.currentPlayer;
            if (myId && data.balances && data.balances[myId] !== undefined) {
                const prev = this.state.cpolyBalances[myId] || 0;
                const now = data.balances[myId];
                if (now > prev) {
                    this.addNotification('+' + (now - prev) + ' $MEMO earned!', 'reward', 'Token Reward');
                }
            }
        } else if (data.type === 'newGame') {
            gameService.currentPlayer = null;
        } else {
            rtcService.gotMessageFromServer(message);
        }
    }

    showHelp = () => this.setState({showHelp: true});
    hideHelp = () => this.setState({showHelp: false, showTutorial: !localStorage.getItem('memeopoly_tutorial_done')});
    closeTutorial = () => this.setState({showTutorial: false});

    leaveRoom = () => {
        gameService.leaveRoom();
        this.setState({inRoom: false, roomId: null, game: null, logs: [], chat: [], view: 'lobby'});
    }

    addNotification = (message, type = 'info', title = null) => {
        const notification = {message, type, title};
        this.setState(prev => ({notifications: [...prev.notifications, notification]}));
        setTimeout(() => {
            this.setState(prev => ({notifications: prev.notifications.filter(n => n !== notification)}));
        }, 4000);
    }

    getPlayerName = () => {
        if (!gameService.currentPlayer || !this.state.game) return null;
        const p = this.state.game.players.find(p => p.id === gameService.currentPlayer);
        return p ? p.name : null;
    }

    copyRoomLink = () => {
        const url = window.location.origin + '/share/room/' + this.state.roomId;
        navigator.clipboard.writeText(url).catch(() => {});
        this.addNotification('Room link copied!', 'info');
    }

    refreshAccount = () => {
        if (this.state.account && this.state.account.id && gameService.ws && gameService.ws.readyState === 1) {
            gameService.ws.send(JSON.stringify({type: 'wsGetAccount', userId: this.state.account.id}));
        }
    }

    render() {
        const {view, account, connected, lostConnection} = this.state;

        // --- SKULL: Landing page ---
        if (view === 'landing') {
            return (<div>
                <Notifications notifications={this.state.notifications}/>
                <LandingPage onAuth={this.handleAuth} onSkip={this.handleGuestPlay} />
            </div>);
        }

        if (view === 'connecting' || !connected) {
            return (<div className="game-loading">
                {lostConnection && <span>Lost connection to server, reconnecting...</span>}
                {!lostConnection && <span>Connecting...</span>}
            </div>);
        }

        // --- SPINE: Top nav bar (always shown when logged in) ---
        const topNav = (
            <div className="top-nav">
                <span className="nav-brand" onClick={() => this.setState({view: 'lobby', inRoom: false})}>Memeopoly</span>
                {account && <div className="nav-user">
                    <span className="nav-level">Lv.{account.level}</span>
                    <span className="nav-cpoly">{account.cpolyBalance} $MEMO</span>
                    <button className="nav-btn" onClick={() => { this.refreshAccount(); this.setState({showProfile: !this.state.showProfile, showLeaderboard: false}); }}>
                        <i className="fas fa-user"></i>
                    </button>
                    <button className="nav-btn" onClick={() => this.setState({showLeaderboard: !this.state.showLeaderboard, showProfile: false, showVault: false})}>
                        <i className="fas fa-trophy"></i>
                    </button>
                    <button className="nav-btn" onClick={() => this.setState({showVault: !this.state.showVault, showProfile: false, showLeaderboard: false})}>
                        <i className="fas fa-coins"></i>
                    </button>
                    <button className="nav-btn nav-logout" onClick={this.handleLogout}>
                        <i className="fas fa-sign-out-alt"></i>
                    </button>
                </div>}
                {!account && <button className="nav-btn" onClick={() => this.setState({view: 'landing'})}>Login</button>}
            </div>
        );

        // Slide-out panels
        const panels = (
            <div>
                {this.state.showProfile && account && <div className="slide-panel">
                    <button className="slide-close" onClick={() => this.setState({showProfile: false})}><i className="fas fa-times"></i></button>
                    <ProfileView account={account} />
                </div>}
                {this.state.showLeaderboard && <div className="slide-panel">
                    <button className="slide-close" onClick={() => this.setState({showLeaderboard: false})}><i className="fas fa-times"></i></button>
                    <Leaderboard />
                </div>}
                {this.state.showVault && <div className="slide-panel">
                    <button className="slide-close" onClick={() => this.setState({showVault: false})}><i className="fas fa-times"></i></button>
                    <VaultPanel accountId={account ? account.id : null} />
                </div>}
            </div>
        );

        // --- Room lobby ---
        if (view === 'lobby' || !this.state.inRoom) {
            return (<div>
                {topNav}
                {panels}
                <Notifications notifications={this.state.notifications}/>
                <RoomLobby />
            </div>);
        }

        // --- Game view ---
        if (this.state.game) {
            const showPlayerDialog = gameService.currentPlayer === null && !this.state.showHelp;
            const card = this.state.cardToShow;
            return (<div>
                {topNav}
                {panels}
                <ReferralPanel
                    playerName={this.getPlayerName()}
                    onNotify={this.addNotification}
                    cpolyBalance={this.state.cpolyBalances[gameService.currentPlayer] || 0}
                    referralData={this.state.referralData[gameService.currentPlayer] || {count: 0, earnings: 0}}
                />
                <WalletConnect onNotify={this.addNotification}/>
                <Notifications notifications={this.state.notifications}/>
                <button className="leave-room-btn" onClick={this.leaveRoom}>Leave Room</button>
                <span className="room-badge">Room: {this.state.roomId}</span>
                <button className="share-room-btn" onClick={this.copyRoomLink}><i className="fas fa-share-alt"></i> Share</button>
                <Settings game={this.state.game} logs={this.state.logs} chat={this.state.chat}
                          showHelp={this.showHelp}/>
                <div className="game">
                    <Board game={this.state.game}/>
                    <Logs logs={this.state.logs}/>
                    <Video game={this.state.game} chat={this.state.chat}/>
                    <Players game={this.state.game}/>
                </div>
                {this.state.showHelp && <HelpDialog dismiss={this.hideHelp}/>}
                {!this.state.showHelp && this.state.showTutorial && <Tutorial onClose={this.closeTutorial}/>}
                {showPlayerDialog && !this.state.showTutorial && <SelectPlayerDialog game={this.state.game}/>}
                {card && <div className="card-overlay">
                    <div className={"card-picked " + card.type}>
                        {<a className="close" onClick={(e) => {
                            this.setState({cardToShow: null});
                        }}><FontAwesomeIcon icon={faTimesCircle}/></a>}
                        <span className="card-type">{card.type}</span>
                        <span className="card-text">{card.card}</span>
                        <span className="card-player">TO: {card.player.name}</span>
                    </div>
                </div>}
            </div>);
        } else {
            return (<div className="game-loading">
                {topNav}
                <span>Loading game...</span>
            </div>);
        }
    }

}
