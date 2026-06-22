import React from 'react';

export default class Notifications extends React.Component {
    render() {
        const {notifications} = this.props;
        if (!notifications || notifications.length === 0) return null;
        return (<div className="notification-container">
            {notifications.map((n, i) => (
                <div key={i} className={`notification-toast ${n.type || 'info'}`}>
                    {n.title && <div className="toast-title">{n.title}</div>}
                    <div>{n.message}</div>
                </div>
            ))}
        </div>);
    }
}
