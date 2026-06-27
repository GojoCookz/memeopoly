// Headless test: simulate a full game with 1 human + 3 NPCs to completion
const {GameService} = require('./game/server/game');

// Replace setTimeout/setInterval BEFORE creating GameService
const pendingTimeouts = [];
let nextId = 1;

global.setTimeout = function(fn, delay) {
    const id = nextId++;
    pendingTimeouts.push({id, fn});
    return id;
};
global.clearTimeout = function(id) {
    const idx = pendingTimeouts.findIndex(t => t.id === id);
    if (idx !== -1) pendingTimeouts.splice(idx, 1);
};
global.setInterval = function() { return -1; };
global.clearInterval = function() {};

function drainTimeouts(maxDrain) {
    let drained = 0;
    while (pendingTimeouts.length > 0 && drained < (maxDrain || 500)) {
        const item = pendingTimeouts.shift();
        if (item && item.fn) {
            try { item.fn(); } catch(e) {
                console.log('Timer error:', e.message);
            }
        }
        drained++;
    }
    return drained;
}

const gs = new GameService();
gs.game = gs.newGame();

gs.ws = {
    broadcast: function(data) {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'gameOver') {
                console.log('>>> GAME OVER: ' + msg.winnerName + ' wins!');
            }
            if (msg.type === 'bankrupt') {
                console.log('>>> BANKRUPT: ' + msg.playerName);
            }
        } catch(e) {}
    }
};

// Add players
gs.processCommand('newPlayer', {id: 'human1', name: 'TestHuman', token: 'car', color: '#00ff00'}, 'human1');
gs.processCommand('addNPC', {difficulty: 'medium'}, 'human1');
gs.processCommand('addNPC', {difficulty: 'medium'}, 'human1');
gs.processCommand('addNPC', {difficulty: 'hard'}, 'human1');

const playerNames = gs.game.players.filter(p => p.id !== 1).map(p => p.name + (p.isNPC ? ' (NPC)' : ''));
console.log('Players:', playerNames.join(', '));

gs.game.started = true;
gs.startTurn(gs.game.turnOrder[0]);
drainTimeouts();

let turns = 0;
const maxTurns = 2000;

while (!gs.game.winner && turns < maxTurns) {
    turns++;

    const currentId = gs.game.currentTurn;
    const player = gs.getPlayerFromId(currentId);
    if (!player) { console.log('ERROR: no player for', currentId); break; }

    const phase = gs.game.turnPhase;

    if (player.bankrupt) {
        gs.endTurn();
        drainTimeouts();
        continue;
    }

    if (phase === 'pre-roll' || phase === 'rolling') {
        if (phase === 'pre-roll') gs.game.turnPhase = 'rolling';
        gs.rollDice(0, 1, currentId); // Use max=1 to skip animation
        drainTimeouts();
        continue;
    }

    if (phase === 'done') {
        gs.endTurn();
        drainTimeouts();
        continue;
    }

    // Check pending buy offer
    if (gs.pendingBuyOffer && gs.pendingBuyOffer.playerId === currentId) {
        const balance = gs.calculateNotesSum(player.notes);
        if (balance >= gs.pendingBuyOffer.deed.price) {
            gs.handleBuyProperty(currentId);
        } else {
            gs.handleDeclineProperty(currentId);
        }
        drainTimeouts();
        continue;
    }

    // Check auction
    if (gs.auctionState) {
        gs.endAuction();
        drainTimeouts();
        continue;
    }

    // Drain any pending timeouts (animation, landing, etc)
    const drained = drainTimeouts();
    if (drained === 0) {
        // Truly stuck
        console.log('STUCK at turn ' + turns + ': phase=' + phase + ', player=' + player.name + ', pos=' + player.position);
        console.log('  pendingBuyOffer:', !!gs.pendingBuyOffer, 'auctionState:', !!gs.auctionState);
        console.log('  rollingDice:', gs.game.rollingDice, 'lastRoll:', JSON.stringify(gs.game.lastRoll));
        break;
    }

    if (turns % 200 === 0) {
        const statuses = gs.game.players.filter(p => p.id !== 1).map(p => {
            const bal = gs.calculateNotesSum(p.notes);
            return p.name + ': $' + bal + (p.bankrupt ? ' [REKT]' : '');
        });
        console.log('Turn ' + turns + ' | ' + statuses.join(' | '));
    }
}

// Final report
console.log('\n========== FINAL REPORT ==========');
if (gs.game.winner) {
    const winner = gs.getPlayerFromId(gs.game.winner);
    console.log('WINNER: ' + winner.name + ' after ~' + turns + ' turns');
} else {
    console.log('No winner after ' + turns + ' turns. Phase: ' + gs.game.turnPhase);
}

gs.game.players.filter(p => p.id !== 1).forEach(p => {
    const balance = gs.calculateNotesSum(p.notes);
    const props = [...gs.game.deeds.regular, ...gs.game.deeds.trainStations, ...gs.game.deeds.utilities]
        .filter(d => d.owner === p.id).length;
    console.log('  ' + p.name + ': $' + balance + ', ' + props + ' props, pos ' + p.position
        + (p.bankrupt ? ' [BANKRUPT]' : '') + (p.inJail ? ' [JAIL]' : ''));
});
