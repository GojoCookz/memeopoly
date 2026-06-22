import React from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';

import {library} from '@fortawesome/fontawesome-svg-core';
import {faHatCowboySide, faDog, faCar, faCat, faShip, faDollarSign, faFrog, faGhost, faRocket, faStar, faBolt, faGem, faCrown, faFire, faSkull, faDragon} from '@fortawesome/free-solid-svg-icons';

library.add(faHatCowboySide, faDog, faCar, faCat, faShip, faDollarSign, faFrog, faGhost, faRocket, faStar, faBolt, faGem, faCrown, faFire, faSkull, faDragon);

export default class Token extends React.Component {

    render() {
        const {token, selected, customImage, color} = this.props;

        if (customImage) {
            return (<div className={"token custom-token " + (selected ? "selected" : "")} style={color ? {borderColor: color, boxShadow: `0 0 10px ${color}40`} : {}}>
                <img src={customImage} alt="token" />
            </div>);
        }

        return (<div className={"token " + (selected ? "selected" : "")} style={color ? {borderColor: color, boxShadow: `0 0 10px ${color}40`} : {}}>
            <FontAwesomeIcon icon={token}/>
        </div>);
    }
}
