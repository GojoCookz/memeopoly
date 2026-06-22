import React from 'react';

export default class WalletConnect extends React.Component {
    state = {
        connected: false,
        address: null
    }

    connect = async () => {
        try {
            if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
                const resp = await window.solana.connect();
                const addr = resp.publicKey.toString();
                this.setState({connected: true, address: addr});
                if (this.props.onNotify) {
                    this.props.onNotify(`Wallet connected: ${addr.slice(0, 4)}...${addr.slice(-4)}`, 'success');
                }
            } else {
                window.open('https://phantom.app/', '_blank');
                if (this.props.onNotify) {
                    this.props.onNotify('Install Phantom wallet to connect', 'warning');
                }
            }
        } catch (err) {
            if (this.props.onNotify) {
                this.props.onNotify('Wallet connection failed', 'warning');
            }
        }
    }

    render() {
        const {connected, address} = this.state;
        return (
            <button className="wallet-btn" onClick={this.connect}>
                {connected ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Connect Wallet'}
            </button>
        );
    }
}
