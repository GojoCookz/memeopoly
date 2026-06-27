import React from 'react';
import ReactDOM from 'react-dom';
import {gameService} from "./services/GameService";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faFaucet, faTimesCircle, faLightbulb} from "@fortawesome/free-solid-svg-icons";
import Mortgage from "./Mortgage";

export default class Utility extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            opened: false,
            sendTo: '',
        };
    }

    sendUtility = () => {
        if (this.state.sendTo.length > 0) {
            const utility = this.props.utility || gameService.getUtility(this.props.position, this.props.game);
            gameService.sendDeed(utility.title, 'utilities', this.state.sendTo);
        }
    }

    render() {
        const utility = this.props.utility || gameService.getUtility(this.props.position, this.props.game);
        const opened = this.state.opened;

        let canSend = false;
        let owner = false;
        if (opened) {
            const permissions = gameService.allowedToSendDeed(utility, this.props.game);
            canSend = permissions.canSend;
            owner = permissions.owner;
        }

        const mortgageClass = utility.mortgaged ? " mortgaged":"";

        const cardContent = (
            <div className={"utility board-card" + (opened ? " opened" : "") + " grid-area-" + this.props.position + " " + this.props.boardPos + mortgageClass}
                 onClick={() => { if (!opened) this.setState({opened: true}); }}>
                {opened && <a className="close" onClick={(e) => {
                    this.setState({opened: false});
                    e.stopPropagation();
                }}><FontAwesomeIcon icon={faTimesCircle}/></a>}
                <div className="title">{utility.title}</div>
                <div className="icon body">
                    {utility.type === 'water' && <FontAwesomeIcon icon={faFaucet}/>}
                    {utility.type === 'electricity' && <FontAwesomeIcon icon={faLightbulb}/>}
                </div>
                {opened && <div className="body">
                    {utility.description}
                    <Mortgage property={utility} isOwner={owner} game={this.props.game} type="utilities"/>
                    <div>
                        <hr/>
                        Owned by: {gameService.getPlayerFromId(utility.owner).name}
                    </div>
                    {canSend && <div className='send-street'>
                        <hr/>
                        Send to:
                        <select value={this.state.sendTo} onChange={(e) => this.setState({sendTo: e.target.value})}>
                            <option value="">Select</option>
                            {this.props.game.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        &nbsp;
                        <button onClick={this.sendUtility}>Send !</button>
                    </div>}
                </div>}
                <div className="price">${utility.price}</div>
            </div>
        );

        if (opened) {
            return (
                <React.Fragment>
                    <div className={"utility board-card grid-area-" + this.props.position + " " + this.props.boardPos + mortgageClass}
                         onClick={() => this.setState({opened: true})}>
                        <div className="title">{utility.title}</div>
                        <div className="icon body">
                            {utility.type === 'water' && <FontAwesomeIcon icon={faFaucet}/>}
                            {utility.type === 'electricity' && <FontAwesomeIcon icon={faLightbulb}/>}
                        </div>
                        <div className="price">${utility.price}</div>
                    </div>
                    {ReactDOM.createPortal(
                        <div className="tile-detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) this.setState({opened: false}); }}>
                            {cardContent}
                        </div>,
                        document.body
                    )}
                </React.Fragment>
            );
        }

        return cardContent;
    }
}
