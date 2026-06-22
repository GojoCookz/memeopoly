import React from 'react';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faDog} from "@fortawesome/free-solid-svg-icons";

export default class FreeParking extends React.Component {

    render() {
        return (<div className={"free-parking corner-card  grid-area-20 " + this.props.boardPos}>
            <div className="container">
                <div>Free Parking</div>
                <div className="icon">
                    <FontAwesomeIcon icon={faDog}/>
                </div>
                <div>wif dog</div>
            </div>
        </div>);
    }
}
