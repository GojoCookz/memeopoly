import React from 'react';
import {soundManager} from "./services/SoundManager";

const DICE_SKINS = ['classic', 'neon', 'fire', 'gold', 'phantom'];

export default class Dice extends React.Component {
    constructor(props) {
        super(props);
        this.state = {wasRolling: false};
    }

    componentDidUpdate(prevProps) {
        if (this.props.rolling && !prevProps.rolling) {
            soundManager.init();
            soundManager.play('diceRoll');
        }
        if (!this.props.rolling && prevProps.rolling) {
            soundManager.play('diceLand');
        }
    }

    getFaceRotation(value) {
        switch (value) {
            case 1: return 'rotateX(0deg) rotateY(0deg)';
            case 2: return 'rotateX(0deg) rotateY(90deg)';
            case 3: return 'rotateX(-90deg) rotateY(0deg)';
            case 4: return 'rotateX(90deg) rotateY(0deg)';
            case 5: return 'rotateX(0deg) rotateY(-90deg)';
            case 6: return 'rotateX(180deg) rotateY(0deg)';
            default: return 'rotateX(0deg) rotateY(0deg)';
        }
    }

    renderFace(value) {
        const dots = [];
        const positions = {
            1: ['center'],
            2: ['top-right', 'bottom-left'],
            3: ['top-right', 'center', 'bottom-left'],
            4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
            5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
            6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right']
        };
        (positions[value] || []).forEach((pos, i) => {
            dots.push(<div key={i} className={`dice3d-dot ${pos}`}/>);
        });
        return dots;
    }

    render() {
        const value = this.props.diceValue;
        const rolling = this.props.rolling;
        const delay = "0." + value + "s";
        const duration = (Math.random() + 1) + "s";

        const transform = rolling
            ? undefined
            : this.getFaceRotation(value);

        const skin = this.props.skin || 'neon';
        const skinClass = skin === 'neon' ? '' : `dice-skin-${skin}`;

        return (
            <div className={`dice3d-wrapper ${rolling ? "rolling" : "landed"} ${skinClass}`}>
                <div className="dice3d-cube" style={rolling ? {animationDelay: delay, animationDuration: duration} : {transform}}>
                    <div className="dice3d-face front">{this.renderFace(1)}</div>
                    <div className="dice3d-face back">{this.renderFace(6)}</div>
                    <div className="dice3d-face right">{this.renderFace(2)}</div>
                    <div className="dice3d-face left">{this.renderFace(5)}</div>
                    <div className="dice3d-face top">{this.renderFace(3)}</div>
                    <div className="dice3d-face bottom">{this.renderFace(4)}</div>
                </div>
            </div>
        );
    }
}
