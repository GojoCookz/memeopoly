import React from 'react';
import FreeParking from "./FreeParking";
import Street from "./Street";
import Chance from "./Chance";
import TrainStation from "./TrainStation";
import Utility from "./Utility";
import GoToJail from "./GoToJail";
import Community from "./Community";
import SuperTax from "./SuperTax";
import Jail from "./Jail";
import Go from "./Go";
import IncomeTax from "./IncomeTax";
import Dice from "./Dice";
import {gameService} from "./services/GameService";
import Token from "./Token";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faInbox, faQuestion} from "@fortawesome/free-solid-svg-icons";

let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0, dragging = null, draggedPlayer;
let lastUpdate = 0;

// Board dimensions: 950px, 24-column grid
// Corners = 3 columns = 118.75px, regular spaces = 2 columns = 79.17px
const BOARD_SIZE = 950;
const CORNER_SIZE = (3 / 24) * BOARD_SIZE; // ~118.75px
const CARD_SIZE = (2 / 24) * BOARD_SIZE;   // ~79.17px
const TOKEN_SIZE = 40;

function getTokenPosition(boardPosition, playerIndex = 0) {
    // Returns {x (top), y (left)} pixel coordinates for a board position 0-39
    // Offsets for multiple tokens on the same space
    const offsets = [
        {dx: 0, dy: 0},
        {dx: 20, dy: 0},
        {dx: 0, dy: 20},
        {dx: 20, dy: 20},
        {dx: 10, dy: -15},
        {dx: -10, dy: 10},
    ];
    const offset = offsets[playerIndex % offsets.length];

    // Center of corner = CORNER_SIZE / 2, center of card slot
    // Token center offset to align with top-left of token div
    const halfToken = TOKEN_SIZE / 2;

    let x, y; // x = top, y = left (matching the existing convention)

    const pos = boardPosition % 40;

    if (pos === 0) {
        // GO: bottom-right corner
        x = BOARD_SIZE - CORNER_SIZE / 2 - halfToken;
        y = BOARD_SIZE - CORNER_SIZE / 2 - halfToken;
    } else if (pos >= 1 && pos <= 9) {
        // Bottom row: positions 1-9, right to left
        // pos 1 is next to GO (right side), pos 9 is next to Jail (left side)
        const slotIndex = 9 - pos; // 0=pos9 (leftmost), 8=pos1 (rightmost)
        y = CORNER_SIZE + slotIndex * CARD_SIZE + CARD_SIZE / 2 - halfToken;
        x = BOARD_SIZE - CORNER_SIZE / 2 - halfToken;
    } else if (pos === 10) {
        // Jail: bottom-left corner
        x = BOARD_SIZE - CORNER_SIZE / 2 - halfToken;
        y = CORNER_SIZE / 2 - halfToken;
    } else if (pos >= 11 && pos <= 19) {
        // Left column: positions 11-19, bottom to top
        const slotIndex = 19 - pos; // 0=pos19 (topmost), 8=pos11 (bottommost)
        x = CORNER_SIZE + slotIndex * CARD_SIZE + CARD_SIZE / 2 - halfToken;
        y = CORNER_SIZE / 2 - halfToken;
    } else if (pos === 20) {
        // Free Parking: top-left corner
        x = CORNER_SIZE / 2 - halfToken;
        y = CORNER_SIZE / 2 - halfToken;
    } else if (pos >= 21 && pos <= 29) {
        // Top row: positions 21-29, left to right
        const slotIndex = pos - 21; // 0=pos21 (leftmost), 8=pos29 (rightmost)
        y = CORNER_SIZE + slotIndex * CARD_SIZE + CARD_SIZE / 2 - halfToken;
        x = CORNER_SIZE / 2 - halfToken;
    } else if (pos === 30) {
        // Go To Jail: top-right corner
        x = CORNER_SIZE / 2 - halfToken;
        y = BOARD_SIZE - CORNER_SIZE / 2 - halfToken;
    } else if (pos >= 31 && pos <= 39) {
        // Right column: positions 31-39, top to bottom
        const slotIndex = pos - 31; // 0=pos31 (topmost), 8=pos39 (bottommost)
        x = CORNER_SIZE + slotIndex * CARD_SIZE + CARD_SIZE / 2 - halfToken;
        y = BOARD_SIZE - CORNER_SIZE / 2 - halfToken;
    } else {
        x = BOARD_SIZE / 2 - halfToken;
        y = BOARD_SIZE / 2 - halfToken;
    }

    return {
        x: Math.round(x + (offset.dx || 0)),
        y: Math.round(y + (offset.dy || 0))
    };
}

export default class Board extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            dragOverrides: {}, // playerId -> {x, y} for manually dragged tokens
            boardScale: 1,
            boardOffsetX: 0,
            boardOffsetY: 0,
            animatingPositions: {}, // playerId -> current animated position
        };
        this.boardRef = React.createRef();
        this.containerRef = React.createRef();
        this.animationTimers = {};
    }

    componentDidMount() {
        this.updateBoardScale();
        this.resizeObserver = new ResizeObserver(() => this.updateBoardScale());
        if (this.containerRef.current) this.resizeObserver.observe(this.containerRef.current);
        window.addEventListener('resize', this.updateBoardScale);
    }

    componentDidUpdate() {
        if (this.boardRef.current) {
            const boardRect = this.boardRef.current.getBoundingClientRect();
            const newScale = boardRect.width / BOARD_SIZE;
            if (Math.abs(newScale - this.state.boardScale) > 0.01) {
                this.updateBoardScale();
            }
        }
    }

    componentWillUnmount() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        window.removeEventListener('resize', this.updateBoardScale);
    }

    animateMove = (playerId, from, to) => {
        if (this.animationTimers[playerId]) clearTimeout(this.animationTimers[playerId]);
        const steps = [];
        if (to >= from) {
            for (let i = from + 1; i <= to; i++) steps.push(i % 40);
        } else {
            for (let i = from + 1; i <= to + 40; i++) steps.push(i % 40);
        }
        if (steps.length === 0) return;
        let stepIndex = 0;
        const doStep = () => {
            this.setState(prev => ({
                animatingPositions: {...prev.animatingPositions, [playerId]: steps[stepIndex]}
            }));
            stepIndex++;
            if (stepIndex < steps.length) {
                this.animationTimers[playerId] = setTimeout(doStep, 200);
            } else {
                this.animationTimers[playerId] = setTimeout(() => {
                    this.setState(prev => {
                        const ap = {...prev.animatingPositions};
                        delete ap[playerId];
                        return {animatingPositions: ap};
                    });
                }, 250);
            }
        };
        doStep();
    }

    updateBoardScale = () => {
        if (this.boardRef.current && this.containerRef.current) {
            const boardRect = this.boardRef.current.getBoundingClientRect();
            const containerRect = this.containerRef.current.getBoundingClientRect();
            const scale = boardRect.width / BOARD_SIZE;
            this.setState({
                boardScale: scale,
                boardOffsetX: boardRect.left - containerRect.left,
                boardOffsetY: boardRect.top - containerRect.top,
            });
        }
    }

    clearDragOverride = (playerId) => {
        this.setState(prev => {
            const overrides = {...prev.dragOverrides};
            delete overrides[playerId];
            return {dragOverrides: overrides};
        });
    }

    rollDice = () => {
        if (gameService.game && gameService.game.currentTurn && gameService.game.currentTurn !== gameService.currentPlayer) {
            return; // Not your turn
        }
        // In pre-roll phase, clicking dice sends readyToRoll (which auto-transitions to rolling on server)
        if (gameService.game && gameService.game.turnPhase === 'pre-roll') {
            gameService.readyToRoll();
            return;
        }
        gameService.rollDie();
    }

    getClientXY = (e) => {
        if (e.touches && e.touches.length > 0) return {x: e.touches[0].clientX, y: e.touches[0].clientY};
        if (e.changedTouches && e.changedTouches.length > 0) return {x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY};
        return {x: e.clientX, y: e.clientY};
    }

    dragStart = (e, player) => {
        e = e || window.event;
        e.preventDefault();
        dragging = e.currentTarget;
        draggedPlayer = player.id;
        const pt = this.getClientXY(e);
        pos3 = pt.x;
        pos4 = pt.y;
        document.onmouseup = (e) => this.dragStopped(e, player);
        document.onmousemove = (e) => this.dragging(e, player);
        document.ontouchend = (e) => this.dragStopped(e, player);
        document.ontouchmove = (e) => this.dragging(e, player);
    }
    dragging = (e, player) => {
        e = e || window.event;
        e.preventDefault();
        const pt = this.getClientXY(e);
        pos1 = pos3 - pt.x;
        pos2 = pos4 - pt.y;
        pos3 = pt.x;
        pos4 = pt.y;
        // set the element's new position:
        dragging.style.top = (dragging.offsetTop - pos2) + "px";
        dragging.style.left = (dragging.offsetLeft - pos1) + "px";

        const currentTime = Date.now();
        if (currentTime - lastUpdate > 250) {
            lastUpdate = currentTime;
            const y = ("" + dragging.style.left).replace("px", "");
            const x = (dragging.style.top).replace("px", "");
            gameService.setPlayerPosition(player.id, x, y);

        }
    }

    dragStopped = (e, player) => {
        draggedPlayer = null;
        const y = ("" + dragging.style.left).replace("px", "");
        const x = ("" + dragging.style.top).replace("px", "");
        gameService.setPlayerPosition(player.id, x, y);
        // Store drag override so the token stays where the user placed it
        this.setState(prev => ({
            dragOverrides: {
                ...prev.dragOverrides,
                [player.id]: {x: parseFloat(x), y: parseFloat(y)}
            }
        }));
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
        lastUpdate = 0;
        gameService.sendToWs('moveFinished', {target: player.name});
    }

    render() {
        if (this.props.game) {
            const game = this.props.game;
            const players = this.props.game.players.filter(p => p.id !== 1);
            // Group players by position for stacking offsets
            const positionCounts = {};
            players.forEach(p => {
                const pos = p.position != null ? p.position : 0;
                if (!positionCounts[pos]) positionCounts[pos] = [];
                positionCounts[pos].push(p.id);
            });
            const {boardScale, boardOffsetX, boardOffsetY} = this.state;
            return (<div className="board-container" ref={this.containerRef}>
                {players.map(p => {
                        let x, y;
                        if (dragging && p.id === draggedPlayer) {
                            x = dragging.style.top;
                            y = dragging.style.left;
                        } else if (this.state.dragOverrides[p.id] && p.position == null) {
                            x = this.state.dragOverrides[p.id].x + 'px';
                            y = this.state.dragOverrides[p.id].y + 'px';
                        } else {
                            const animPos = this.state.animatingPositions[p.id];
                            const pos = animPos != null ? animPos : (p.position != null ? p.position : 0);
                            const playersAtPos = positionCounts[pos] || [p.id];
                            const indexAtPos = playersAtPos.indexOf(p.id);
                            const coords = getTokenPosition(pos, indexAtPos);
                            x = Math.round(coords.x * boardScale + boardOffsetY) + 'px';
                            y = Math.round(coords.y * boardScale + boardOffsetX) + 'px';
                        }
                        const isBeingDragged = dragging && p.id === draggedPlayer;
                        return <div key={p.id}
                                    className={"board-token" + (isBeingDragged ? " dragging" : "")}
                                    onMouseDown={(e) => this.dragStart(e, p)}
                                    onTouchStart={(e) => this.dragStart(e, p)}
                                    style={{top: x, left: y}}>
                            <Token selected={p.id === gameService.currentPlayer} token={p.token} customImage={p.customImage} color={p.tokenColor}/>
                        </div>
                    }
                )}
                <div className={"dice-set" + (game.currentTurn === gameService.currentPlayer && (game.turnPhase === 'rolling' || game.turnPhase === 'pre-roll') ? " dice-your-turn" : "") + (game.currentTurn === gameService.currentPlayer && game.turnPhase === 'pre-roll' ? " dice-pre-roll" : "")} onClick={this.rollDice}>
                    {game.currentTurn === gameService.currentPlayer && game.turnPhase === 'pre-roll' && (
                        <div className="pre-roll-label">BUILD OR CLICK TO ROLL</div>
                    )}
                    <Dice diceValue={this.props.game.dice[0]} rolling={this.props.game.rollingDice} skin={this.props.diceSkin}/>
                    <Dice diceValue={this.props.game.dice[1]} rolling={this.props.game.rollingDice} skin={this.props.diceSkin}/>
                </div>
                <div className="community-stack card-stack" onClick={() => gameService.drawCard('community')}>
                    <span>Community Chest</span>
                    <div className="icon">
                        <FontAwesomeIcon icon={faInbox}/>
                    </div>
                </div>
                <div className="chance-stack card-stack" onClick={() => gameService.drawCard('chance')}>
                    <span>Chance</span>
                    <div className="icon">
                        <FontAwesomeIcon icon={faQuestion}/>
                    </div>
                </div>
                <div className="board" ref={this.boardRef}>
                    <Go/>
                    <Street position="1" boardPos="bottom" game={game}/>
                    <Community position="2" boardPos="bottom"/>
                    <Street position="3" boardPos="bottom" game={game}/>
                    <IncomeTax position="4" boardPos="bottom"/>
                    <TrainStation position="5" boardPos="bottom" game={game}/>
                    <Street position="6" boardPos="bottom" game={game}/>
                    <Chance position="7" boardPos="bottom"/>
                    <Street position="8" boardPos="bottom" game={game}/>
                    <Street position="9" boardPos="bottom" game={game}/>
                    <Jail boardPos="bottom"/>
                    <Street position="11" boardPos="left" game={game}/>
                    <Utility position="12" boardPos="left" game={game}/>
                    <Street position="13" boardPos="left" game={game}/>
                    <Street position="14" boardPos="left" game={game}/>
                    <TrainStation position="15" boardPos="left" game={game}/>
                    <Street position="16" boardPos="left" game={game}/>
                    <Community position="17" boardPos="left" game={game}/>
                    <Street position="18" boardPos="left" game={game}/>
                    <Street position="19" boardPos="left" game={game}/>
                    <FreeParking boardPos="top"/>
                    <Street position="21" boardPos="top" game={game}/>
                    <Chance position="22" boardPos="top"/>
                    <Street position="23" boardPos="top" game={game}/>
                    <Street position="24" boardPos="top" game={game}/>
                    <TrainStation position="25" boardPos="top" game={game}/>
                    <Street position="26" boardPos="top" game={game}/>
                    <Street position="27" boardPos="top" game={game}/>
                    <Utility position="28" boardPos="top" game={game}/>
                    <Street position="29" boardPos="top" game={game}/>
                    <GoToJail/>
                    <Street position="31" boardPos="right" game={game}/>
                    <Street position="32" boardPos="right" game={game}/>
                    <Community position="33" boardPos="right" game={game}/>
                    <Street position="34" boardPos="right" game={game}/>
                    <TrainStation position="35" boardPos="right" game={game}/>
                    <Chance position="36" boardPos="right"/>
                    <Street position="37" boardPos="right" game={game}/>
                    <SuperTax position="38" boardPos="right"/>
                    <Street position="39" boardPos="right" game={game}/>
                    <div style={{gridArea: 'e'}}></div>
                </div>
            </div>)
        } else {
            return (<div>Waiting for game...</div>);
        }

    }
}
