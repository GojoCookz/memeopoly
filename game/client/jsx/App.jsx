import React from 'react';
import Board from "./Board";

import {gameService} from "./services/GameService";
import {soundManager} from "./services/SoundManager";
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
            showVault: false,
            // Turn system
            buyOffer: null,
            buyOfferTimer: null,
            showJailedOverlay: false,
            showNPCMenu: false,
            // Auction system
            auction: null,
            auctionTimer: null,
            sidebarTab: 'logs'
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

    componentDidUpdate(prevProps, prevState) {
        const footer = document.getElementById('memeopoly-footer');
        if (footer) footer.style.display = this.state.inRoom ? 'none' : '';
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
        } else if (data.type === 'yourTurn') {
            if (data.playerId === gameService.currentPlayer) {
                soundManager.init();
                soundManager.play('fanfare');
                this.addNotification('YOUR TURN! Click dice to roll', 'turn', 'Your Turn');
            }
        } else if (data.type === 'buyOffer') {
            soundManager.play('click');
            if (data.playerId === gameService.currentPlayer) {
                // Start 15s countdown
                let remaining = 15;
                const timer = setInterval(() => {
                    remaining--;
                    if (remaining <= 0) {
                        clearInterval(timer);
                        this.setState({buyOffer: null, buyOfferTimer: null});
                    } else {
                        this.setState(prev => {
                            if (!prev.buyOffer) { clearInterval(timer); return null; }
                            return {buyOffer: {...prev.buyOffer, remaining}};
                        });
                    }
                }, 1000);
                this.setState({
                    buyOffer: {property: data.property, price: data.price, remaining},
                    buyOfferTimer: timer
                });
            } else {
                const buyerPlayer = this.state.game ? this.state.game.players.find(p => p.id === data.playerId) : null;
                const buyerName = buyerPlayer ? buyerPlayer.name : 'A player';
                this.addNotification(buyerName + ' landed on ' + data.property, 'info');
            }
        } else if (data.type === 'buyOfferExpired') {
            if (this.state.buyOfferTimer) clearInterval(this.state.buyOfferTimer);
            this.setState({buyOffer: null, buyOfferTimer: null});
        } else if (data.type === 'propertyBought') {
            soundManager.play('buy');
            this.addNotification(data.playerName + ' bought ' + data.property + ' for $' + data.price, 'info', 'Property Sold');
        } else if (data.type === 'rentPaid') {
            if (data.fromPlayer === gameService.currentPlayer) {
                soundManager.play('rent');
                this.addNotification('Paid $' + data.amount + ' rent to ' + data.toName + ' for ' + data.property, 'warning', 'Rent Paid');
            } else if (data.toPlayer === gameService.currentPlayer) {
                soundManager.play('coin');
                this.addNotification('Received $' + data.amount + ' rent from ' + data.fromName + ' for ' + data.property, 'reward', 'Rent Received');
            }
        } else if (data.type === 'taxPaid') {
            if (data.playerId === gameService.currentPlayer) {
                soundManager.play('rent');
                this.addNotification('Paid $' + data.amount + ' ' + data.taxType, 'warning', 'Tax');
            }
        } else if (data.type === 'playerMoved') {
            if (data.passedGo) {
                soundManager.play('go');
            }
            // Clear drag override so token animates to calculated board position
            if (this.boardRef) {
                this.boardRef.clearDragOverride(data.playerId);
            }
        } else if (data.type === 'jailed') {
            soundManager.play('jail');
            if (data.playerId === gameService.currentPlayer) {
                this.setState({showJailedOverlay: true});
                setTimeout(() => this.setState({showJailedOverlay: false}), 3000);
            } else {
                this.addNotification(data.playerName + ' got sent to jail!', 'warning', 'Jailed');
            }
        } else if (data.type === 'auctionStart') {
            let remaining = 10;
            const timer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(timer);
                    this.setState({auction: null, auctionTimer: null});
                } else {
                    this.setState(prev => {
                        if (!prev.auction) { clearInterval(timer); return null; }
                        return {auction: {...prev.auction, remaining}};
                    });
                }
            }, 1000);
            this.setState({
                auction: {
                    property: data.property,
                    price: data.price,
                    currentBid: 0,
                    currentBidder: null,
                    currentBidderName: null,
                    remaining
                },
                auctionTimer: timer
            });
            this.addNotification('AUCTION: ' + data.property + ' is up for auction!', 'warning', 'Auction');
        } else if (data.type === 'auctionBid') {
            if (this.state.auctionTimer) clearInterval(this.state.auctionTimer);
            let remaining = data.timeRemaining || 10;
            const timer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(timer);
                    this.setState({auction: null, auctionTimer: null});
                } else {
                    this.setState(prev => {
                        if (!prev.auction) { clearInterval(timer); return null; }
                        return {auction: {...prev.auction, remaining}};
                    });
                }
            }, 1000);
            this.setState(prev => ({
                auction: prev.auction ? {
                    ...prev.auction,
                    currentBid: data.amount,
                    currentBidder: data.playerId,
                    currentBidderName: data.playerName,
                    remaining
                } : null,
                auctionTimer: timer
            }));
            this.addNotification(data.playerName + ' bid $' + data.amount, 'info', 'Auction Bid');
        } else if (data.type === 'auctionEnd') {
            if (this.state.auctionTimer) clearInterval(this.state.auctionTimer);
            this.setState({auction: null, auctionTimer: null});
            if (data.winnerId) {
                this.addNotification(data.winnerName + ' won ' + data.property + ' for $' + data.amount, 'reward', 'Auction Won');
            } else {
                this.addNotification('No bids for ' + data.property, 'info', 'Auction Over');
            }
        } else if (data.type === 'bankrupt') {
            soundManager.play('jail');
            this.addNotification(data.playerName + ' went BANKRUPT!', 'warning', 'Bankrupt');
        } else if (data.type === 'gameOver') {
            soundManager.play('fanfare');
            this.setState({winner: {id: data.winnerId, name: data.winnerName}});
        } else if (data.type === 'newGame') {
            gameService.currentPlayer = null;
            this.setState({winner: null});
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

    handleBuyAccept = () => {
        if (this.state.buyOfferTimer) clearInterval(this.state.buyOfferTimer);
        this.setState({buyOffer: null, buyOfferTimer: null});
        gameService.buyProperty();
    }

    handleBuyDecline = () => {
        if (this.state.buyOfferTimer) clearInterval(this.state.buyOfferTimer);
        this.setState({buyOffer: null, buyOfferTimer: null});
        gameService.declineProperty();
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
                <div className="game-toolbar">
                    <button className="gt-leave" onClick={this.leaveRoom}>Leave</button>
                    <span className="gt-room">Room: {this.state.roomId}</span>
                    <button className="gt-share" onClick={this.copyRoomLink}><i className="fas fa-share-alt"></i> Share</button>
                    <div className="gt-spacer"></div>
                    <div className="npc-menu-wrapper">
                        <button className="npc-add-btn" onClick={() => this.setState({showNPCMenu: !this.state.showNPCMenu})}>
                            + NPC
                        </button>
                        {this.state.showNPCMenu && <div className="npc-dropdown">
                            <button onClick={() => { gameService.addNPC('easy'); this.setState({showNPCMenu: false}); }}>Easy</button>
                            <button onClick={() => { gameService.addNPC('medium'); this.setState({showNPCMenu: false}); }}>Medium</button>
                            <button onClick={() => { gameService.addNPC('hard'); this.setState({showNPCMenu: false}); }}>Hard</button>
                        </div>}
                    </div>
                </div>
                <Settings game={this.state.game} logs={this.state.logs} chat={this.state.chat}
                          showHelp={this.showHelp}/>
                <div className="game">
                    <Board game={this.state.game} ref={ref => this.boardRef = ref}/>
                    <div className="game-sidebar">
                        <Players game={this.state.game}/>
                        <div className="sidebar-section sidebar-logs">
                            <div className="sidebar-tabs">
                                <button className={"stab" + (this.state.sidebarTab !== 'chat' ? " active" : "")} onClick={() => this.setState({sidebarTab: 'logs'})}>Logs</button>
                                <button className={"stab" + (this.state.sidebarTab === 'chat' ? " active" : "")} onClick={() => this.setState({sidebarTab: 'chat'})}>Chat</button>
                            </div>
                            {this.state.sidebarTab !== 'chat' ? (
                                <div className="sidebar-log-content" id="log-box">
                                    {this.state.logs.map((l, i) => <p key={i}>{l}</p>)}
                                </div>
                            ) : (
                                <div className="sidebar-chat-content">
                                    <div className="sidebar-chat-msgs" id="chat-box">
                                        {this.state.chat.map((l, i) => <p key={i}>{l}</p>)}
                                    </div>
                                    <div className="sidebar-chat-input">
                                        <input type="text" placeholder="Type..." onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { gameService.sendToWs('chat', {message: e.target.value}); e.target.value = ''; }}}/>
                                        <button onClick={(e) => { const inp = e.target.parentElement.querySelector('input'); if (inp.value) { gameService.sendToWs('chat', {message: inp.value}); inp.value = ''; }}}>Send</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
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
                {this.state.buyOffer && <div className="card-overlay">
                    <div className="buy-offer-modal">
                        <h3>Property Available!</h3>
                        <p className="buy-offer-property">{this.state.buyOffer.property}</p>
                        <p className="buy-offer-price">${this.state.buyOffer.price}</p>
                        <p className="buy-offer-timer">{this.state.buyOffer.remaining}s remaining</p>
                        <div className="buy-offer-buttons">
                            <button className="buy-btn" onClick={this.handleBuyAccept}>Buy</button>
                            <button className="decline-btn" onClick={this.handleBuyDecline}>Decline</button>
                        </div>
                    </div>
                </div>}
                {this.state.auction && <div className="card-overlay">
                    <div className="auction-modal">
                        <h3>AUCTION</h3>
                        <p className="auction-property">{this.state.auction.property}</p>
                        <p className="auction-list-price">List price: ${this.state.auction.price}</p>
                        {this.state.auction.currentBid > 0 ? (
                            <p className="auction-current-bid">
                                Current bid: ${this.state.auction.currentBid} by {this.state.auction.currentBidderName}
                            </p>
                        ) : (
                            <p className="auction-current-bid">No bids yet</p>
                        )}
                        <p className="auction-timer">{this.state.auction.remaining}s remaining</p>
                        <div className="auction-bid-buttons">
                            <button className="bid-btn" onClick={() => gameService.placeBid((this.state.auction.currentBid || 0) + 10)}>
                                +$10
                            </button>
                            <button className="bid-btn" onClick={() => gameService.placeBid((this.state.auction.currentBid || 0) + 50)}>
                                +$50
                            </button>
                            <button className="bid-btn" onClick={() => gameService.placeBid((this.state.auction.currentBid || 0) + 100)}>
                                +$100
                            </button>
                        </div>
                    </div>
                </div>}
                {this.state.showJailedOverlay && <div className="card-overlay">
                    <div className="jailed-overlay">
                        <h2>RUGGED!</h2>
                        <p>Go to Jail!</p>
                    </div>
                </div>}
                {this.state.winner && <div className="card-overlay winner-overlay">
                    <div className="winner-modal">
                        <div className="winner-crown">&#x1F451;</div>
                        <h2>GAME OVER</h2>
                        <p className="winner-name">{this.state.winner.name}</p>
                        <p className="winner-subtitle">MEME LORD SUPREME</p>
                        <button className="winner-btn" onClick={() => this.setState({winner: null})}>GG</button>
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
