import React from 'react';
import {gameService} from "./services/GameService";
import Token from "./Token";
import PlayerBoard from "./PlayerBoard";

export default class Players extends React.Component {
    state = {};

    render() {
        const selected = this.state.selected;
        const players = this.props.game.players.sort((p1, p2) => {
            return gameService.scorePlayerForSorting(p1) - gameService.scorePlayerForSorting(p2);
        });
        return (<div className="player-list">
            <h3>Players</h3>
            <div className="player-tabs">
                {players.map(p => {
                    const isCurrentTurn = this.props.game.currentTurn === p.id;
                    return <div key={p.id}
                                onClick={() => this.setState({selected: p.id})}
                                className={"player " + (isCurrentTurn ? "current-turn" : "") + (p.bankrupt ? " bankrupt" : "")}>
                        {isCurrentTurn && <span className="turn-arrow">&#9658; </span>}
                        <Token token={p.token} selected={p.id === selected} customImage={p.customImage} color={p.tokenColor}/>
                        {p.name}
                        {p.bankrupt && <span className="bankrupt-badge"> REKT</span>}
                        {!p.bankrupt && p.inJail && <span className="jail-badge"> (JAIL)</span>}
                        {p.position !== undefined && p.id !== 1 && <span className="position-badge"> [{p.position}]</span>}
                    </div>
                })}
            </div>
            <PlayerBoard player={this.state.selected} game={this.props.game}/>
        </div>)
    }
}
