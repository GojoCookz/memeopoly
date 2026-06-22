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
export default class Board extends React.Component {

    constructor(props) {
        super(props);
        this.state = {};
    }

    rollDice = () => {
        if (gameService.game && gameService.game.currentTurn && gameService.game.currentTurn !== gameService.currentPlayer) {
            return; // Not your turn
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
        console.log('no more dragging', draggedPlayer);
        draggedPlayer = null;
        const y = ("" + dragging.style.left).replace("px", "");
        const x = ("" + dragging.style.top).replace("px", "");
        gameService.setPlayerPosition(player.id, x, y);
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
            return (<div className="board-container">
                {players.map(p => {
                        const x = dragging && p.id === draggedPlayer ? dragging.style.top : p.x + 'px';
                        const y = dragging && p.id === draggedPlayer ? dragging.style.left : p.y + 'px';
                        return <div key={p.id} className="board-token"
                                    onMouseDown={(e) => this.dragStart(e, p)}
                                    onTouchStart={(e) => this.dragStart(e, p)}
                                    style={{top: x, left: y}}>
                            <Token selected={p.id === gameService.currentPlayer} token={p.token} customImage={p.customImage} color={p.tokenColor}/>
                        </div>
                    }
                )}
                <div className={"dice-set" + (game.currentTurn === gameService.currentPlayer && game.turnPhase === 'rolling' ? " dice-your-turn" : "")} onClick={this.rollDice}>
                    <Dice diceValue={this.props.game.dice[0]} rolling={this.props.game.rollingDice}/>
                    <Dice diceValue={this.props.game.dice[1]} rolling={this.props.game.rollingDice}/>
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
                <div className="board">
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
