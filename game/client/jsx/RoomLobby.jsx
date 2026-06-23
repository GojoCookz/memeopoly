import React from 'react';
import {gameService} from './services/GameService';

export default class RoomLobby extends React.Component {
    state = {
        rooms: [],
        newRoomName: '',
        loading: true,
        turnTimer: 0
    }

    componentDidMount() {
        gameService.onRoomList = (rooms) => {
            this.setState({rooms, loading: false});
        };
        gameService.listRooms();
        this.interval = setInterval(() => gameService.listRooms(), 3000);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
        gameService.onRoomList = null;
    }

    joinRoom = (roomId) => {
        gameService.joinRoom(roomId);
    }

    createRoom = () => {
        const name = this.state.newRoomName.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
        if (!name) return;
        gameService.joinRoom(name, this.state.turnTimer);
    }

    joinQuick = () => {
        const open = this.state.rooms.find(r => r.players < 6 && !r.started);
        if (open) {
            gameService.joinRoom(open.id);
        } else {
            const id = 'game-' + Math.random().toString(36).slice(2, 8);
            gameService.joinRoom(id);
        }
    }

    render() {
        return (
            <div className="room-lobby">
                <div className="lobby-panel">
                    <h1>Memeopoly</h1>
                    <p className="lobby-subtitle">Choose a room or create your own</p>

                    <div className="lobby-actions">
                        <button className="lobby-btn primary" onClick={this.joinQuick}>Quick Play</button>
                        <div className="create-room">
                            <input
                                type="text"
                                placeholder="Room name..."
                                value={this.state.newRoomName}
                                onChange={e => this.setState({newRoomName: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && this.createRoom()}
                                maxLength={32}
                            />
                            <select className="timer-select" value={this.state.turnTimer} onChange={e => this.setState({turnTimer: parseInt(e.target.value)})}>
                                <option value="0">No Timer</option>
                                <option value="30">30s Turns</option>
                                <option value="60">60s Turns</option>
                                <option value="120">2min Turns</option>
                            </select>
                            <button className="lobby-btn secondary" onClick={this.createRoom}>Create Room</button>
                        </div>
                    </div>

                    <div className="room-list">
                        <h3>Active Rooms</h3>
                        {this.state.loading && <p className="muted">Loading rooms...</p>}
                        {!this.state.loading && this.state.rooms.length === 0 && (
                            <p className="muted">No active rooms. Create one or Quick Play!</p>
                        )}
                        {this.state.rooms.map(room => (
                            <div key={room.id} className="room-card" onClick={() => this.joinRoom(room.id)}>
                                <div className="room-info">
                                    <span className="room-name">{room.id}</span>
                                    <span className="room-meta">
                                        {room.players}/6 players | {room.online} online
                                        {room.started ? ' | In Progress' : ' | Waiting'}
                                    </span>
                                </div>
                                <button className="lobby-btn small">Join</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
}
