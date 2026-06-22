const fs = require('fs');

const OUT_OF_JAIL = "Get out of jail free. This card may be kept until needed, traded or sold.";

function shuffle(array) {
    let counter = array.length;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

class GameService {
    logs = [];
    chat = [];
    referrals = {};
    cpolyBalances = {};
    dailyLogins = {};
    colorSetBonusClaimed = {};

    awardCpoly = (playerId, amount, reason) => {
        if (!this.cpolyBalances[playerId]) this.cpolyBalances[playerId] = 0;
        this.cpolyBalances[playerId] += amount;

        const referrerId = this.getReferrer(playerId);
        if (referrerId && referrerId !== playerId) {
            const bonus = Math.floor(amount * 0.1);
            if (!this.cpolyBalances[referrerId]) this.cpolyBalances[referrerId] = 0;
            this.cpolyBalances[referrerId] += bonus;
        }

        const player = this.getPlayerFromId(playerId);
        const name = player ? player.name : playerId;
        this.sendLog(name + ' earned ' + amount + ' $MEMO: ' + reason);
        this.broadcastCpoly();
    }

    broadcastCpoly = () => {
        try {
            this.ws.broadcast(JSON.stringify({
                type: 'cpoly',
                balances: this.cpolyBalances,
                referrals: this.referrals
            }));
        } catch(e) {}
    }

    registerReferral = (playerId, referrerCode) => {
        if (!referrerCode || !playerId) return;
        const referrerPlayer = this.game.players.find(p => {
            let hash = 0;
            for (let i = 0; i < p.name.length; i++)
                hash = ((hash << 5) - hash + p.name.charCodeAt(i)) | 0;
            const code = p.name.slice(0, 4).toUpperCase() + Math.abs(hash).toString(36).slice(0, 4).toUpperCase();
            return code === referrerCode;
        });
        if (!referrerPlayer || referrerPlayer.id === playerId) return;

        if (!this.referrals[referrerPlayer.id]) this.referrals[referrerPlayer.id] = { count: 0, referred: [], earnings: 0 };
        if (this.referrals[referrerPlayer.id].referred.indexOf(playerId) !== -1) return;

        this.referrals[referrerPlayer.id].count++;
        this.referrals[referrerPlayer.id].referred.push(playerId);

        const milestones = { 5: 500, 10: 1500, 25: 5000 };
        const count = this.referrals[referrerPlayer.id].count;
        if (milestones[count]) {
            this.awardCpoly(referrerPlayer.id, milestones[count], count + ' referral milestone');
            this.referrals[referrerPlayer.id].earnings += milestones[count];
        }

        this.sendLog(referrerPlayer.name + ' got a new referral! Total: ' + count);
        this.broadcastCpoly();
    }

    getReferrer = (playerId) => {
        for (const rid of Object.keys(this.referrals)) {
            if (this.referrals[rid].referred.indexOf(playerId) !== -1) return rid;
        }
        return null;
    }

    handleDailyLogin = (playerId) => {
        const today = new Date().toISOString().slice(0, 10);
        if (!this.dailyLogins[playerId]) this.dailyLogins[playerId] = { lastDate: null, streak: 0 };
        const dl = this.dailyLogins[playerId];
        if (dl.lastDate === today) return;

        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        dl.streak = (dl.lastDate === yesterday) ? dl.streak + 1 : 1;
        dl.lastDate = today;
        this.awardCpoly(playerId, 25 * dl.streak, 'daily login streak x' + dl.streak);
    }

    checkColorSetBonus = (playerId) => {
        const colors = {};
        this.game.deeds.regular.forEach(d => {
            if (!colors[d.color]) colors[d.color] = { total: 0, owned: 0 };
            colors[d.color].total++;
            if (d.owner == playerId) colors[d.color].owned++;
        });
        for (const color of Object.keys(colors)) {
            if (colors[color].owned === colors[color].total && colors[color].total > 0) {
                const key = playerId + '_' + color;
                if (!this.colorSetBonusClaimed[key]) {
                    this.colorSetBonusClaimed[key] = true;
                    this.awardCpoly(playerId, 200, 'completed color set');
                }
            }
        }
    }
    newGame = () => {
        fs.writeFileSync(this.logFile, '');
        fs.writeFileSync(this.chatFile, '');
        return {
            dice: [3, 6],
            rollingDice: false,
            started: false,
            currentTurn: null,
            turnOrder: [],
            turnPhase: 'waiting',
            doublesCount: 0,
            lastRoll: null,
            players: [{
                id: 1,
                name: 'Bank',
                token: 'dollar-sign',
                notes: {
                    500: 30,
                    100: 30,
                    50: 30,
                    20: 30,
                    10: 30,
                    5: 30,
                    1: 30
                },
                housing: {
                    hotels: 12,
                    houses: 32
                },
            }],
            deeds: {
                utilities: [
                    {
                        position: 12,
                        owner: "1",
                        title: "Fartcoin HQ",
                        type: "electricity",
                        description: "If one Utility is owned, rent is 4 times the amount shown on dice. If both Utilities are owned rent is 10 times amount shown on dice.",
                        price: 150,
                        mortgaged: false
                    },
                    {
                        position: 28,
                        owner: "1",
                        type: "water",
                        title: "Popcat Server",
                        description: "If one Utility is owned, rent is 4 times the amount shown on dice. If both Utilities are owned rent is 10 times amount shown on dice.",
                        price: 150,
                        mortgaged: false
                    }
                ],
                trainStations: [
                    {
                        position: 5,
                        owner: "1",
                        title: "Pump.fun Station",
                        rent: {
                            "Rent": '$25',
                            "If 2 Stations are Owned": "$50",
                            "If 3 Stations are Owned": "$100",
                            "If 4 Stations are Owned": "$200",
                        },
                        price: 200,
                        mortgaged: false
                    },
                    {
                        position: 15,
                        owner: "1",
                        title: "Raydium Terminal",
                        rent: {
                            "Rent": '$25',
                            "If 2 Stations are Owned": "$50",
                            "If 3 Stations are Owned": "$100",
                            "If 4 Stations are Owned": "$200",
                        },
                        price: 200,
                        mortgaged: false
                    },
                    {
                        position: 25,
                        owner: "1",
                        title: "Jupiter Hub",
                        rent: {
                            "Rent": '$25',
                            "If 2 Stations are Owned": "$50",
                            "If 3 Stations are Owned": "$100",
                            "If 4 Stations are Owned": "$200",
                        },
                        price: 200,
                        mortgaged: false
                    },
                    {
                        position: 35,
                        owner: "1",
                        title: "DexScreener Depot",
                        rent: {
                            "Rent": '$25',
                            "If 2 Stations are Owned": "$50",
                            "If 3 Stations are Owned": "$100",
                            "If 4 Stations are Owned": "$200",
                        },
                        price: 200,
                        mortgaged: false
                    },
                ],
                regular: [
                    {
                        position: 37,
                        owner: "1",
                        title: "$WIF Skyway",
                        color: "#1a2596",
                        rent: {
                            "Rent": "$35",
                            "With colour set": "$70",
                            "With 1 House": "$175",
                            "With 2 House": "$500",
                            "With 3 House": "$1100",
                            "With 4 House": "$1300",
                            "With Hotel": "$1500",
                        },
                        cost: {
                            "House": "$200 each",
                            "Hotel": "$200 each"
                        },
                        houses: 0,
                        hotel: 0,
                        price: 350,
                        mortgaged: false
                    },
                    {
                        position: 39,
                        owner: "1",
                        title: "$MEMO Palace",
                        color: "#1a2596",
                        rent: {
                            "Rent": "$50",
                            "With colour set": "$100",
                            "With 1 House": "$200",
                            "With 2 House": "$600",
                            "With 3 House": "$1400",
                            "With 4 House": "$1700",
                            "With Hotel": "$2000",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$200 each",
                            "Hotel": "$200 each"
                        },
                        price: 400,
                        mortgaged: false
                    },
                    {
                        position: 31,
                        owner: "1",
                        title: "$PEPE Street",
                        color: "#008e04",
                        rent: {
                            "Rent": "$26",
                            "With colour set": "$52",
                            "With 1 House": "$130",
                            "With 2 House": "$390",
                            "With 3 House": "$900",
                            "With 4 House": "$1100",
                            "With Hotel": "$1275",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$200 each",
                            "Hotel": "$200 each"
                        },
                        price: 300,
                        mortgaged: false
                    },
                    {
                        position: 34,
                        owner: "1",
                        title: "$SHIB Station",
                        color: "#008e04",
                        rent: {
                            "Rent": "$28",
                            "With colour set": "$56",
                            "With 1 House": "$150",
                            "With 2 House": "$450",
                            "With 3 House": "$1000",
                            "With 4 House": "$1200",
                            "With Hotel": "$1400",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$200 each",
                            "Hotel": "$200 each"
                        },
                        price: 320,
                        mortgaged: false
                    },
                    {
                        position: 32,
                        owner: "1",
                        title: "$FLOKI Highway",
                        color: "#008e04",
                        rent: {
                            "Rent": "$26",
                            "With colour set": "$52",
                            "With 1 House": "$130",
                            "With 2 House": "$390",
                            "With 3 House": "$900",
                            "With 4 House": "$1100",
                            "With Hotel": "$1275",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$200 each",
                            "Hotel": "$200 each"
                        },
                        price: 300,
                        mortgaged: false
                    },
                    {
                        position: 26,
                        owner: "1",
                        title: "$BONK Station",
                        color: "#d6d105",
                        rent: {
                            "Rent": "$22",
                            "With colour set": "$44",
                            "With 1 House": "$110",
                            "With 2 House": "$330",
                            "With 3 House": "$800",
                            "With 4 House": "$975",
                            "With Hotel": "$1150",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$150 each",
                            "Hotel": "$150 each"
                        },
                        price: 260,
                        mortgaged: false
                    },
                    {
                        position: 27,
                        owner: "1",
                        title: "$DOGE Market",
                        color: "#d6d105",
                        rent: {
                            "Rent": "$22",
                            "With colour set": "$44",
                            "With 1 House": "$110",
                            "With 2 House": "$330",
                            "With 3 House": "$800",
                            "With 4 House": "$975",
                            "With Hotel": "$1150",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$150 each",
                            "Hotel": "$150 each"
                        },
                        price: 260,
                        mortgaged: false
                    },
                    {
                        position: 29,
                        owner: "1",
                        title: "$WIF Plaza",
                        color: "#d6d105",
                        rent: {
                            "Rent": "$24",
                            "With colour set": "$48",
                            "With 1 House": "$120",
                            "With 2 House": "$360",
                            "With 3 House": "$850",
                            "With 4 House": "$1025",
                            "With Hotel": "$1200",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$150 each",
                            "Hotel": "$150 each"
                        },
                        price: 280,
                        mortgaged: false
                    },
                    {
                        position: 23,
                        owner: "1",
                        title: "$FARTCOIN Blvd",
                        color: "#9f0108",
                        rent: {
                            "Rent": "$18",
                            "With colour set": "$36",
                            "With 1 House": "$90",
                            "With 2 House": "$250",
                            "With 3 House": "$700",
                            "With 4 House": "$875",
                            "With Hotel": "$1050",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$150 each",
                            "Hotel": "$150 each"
                        },
                        price: 220,
                        mortgaged: false
                    },
                    {
                        position: 21,
                        owner: "1",
                        title: "$BONK Exchange",
                        color: "#9f0108",
                        rent: {
                            "Rent": "$18",
                            "With colour set": "$36",
                            "With 1 House": "$90",
                            "With 2 House": "$250",
                            "With 3 House": "$700",
                            "With 4 House": "$875",
                            "With Hotel": "$1050",
                        },
                        cost: {
                            "House": "$150 each",
                            "Hotel": "$150 each"
                        },
                        houses: 0,
                        hotel: 0,
                        price: 220,
                        mortgaged: false
                    },
                    {
                        position: 24,
                        owner: "1",
                        title: "$PIPPIN Square",
                        color: "#9f0108",
                        rent: {
                            "Rent": "$20",
                            "With colour set": "$40",
                            "With 1 House": "$100",
                            "With 2 House": "$300",
                            "With 3 House": "$750",
                            "With 4 House": "$925",
                            "With Hotel": "$1100",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$150 each",
                            "Hotel": "$150 each"
                        },
                        price: 240,
                        mortgaged: false
                    },
                    {
                        position: 16,
                        title: "$GOAT Gallery",
                        color: "#d68000",
                        owner: "1",
                        rent: {
                            "Rent": "$14",
                            "With colour set": "$28",
                            "With 1 House": "$70",
                            "With 2 House": "$200",
                            "With 3 House": "$550",
                            "With 4 House": "$750",
                            "With Hotel": "$950",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$100 each",
                            "Hotel": "$100 each"
                        },
                        price: 180,
                        mortgaged: false
                    },
                    {
                        position: 18,
                        title: "$BOME Mall",
                        color: "#d68000",
                        owner: "1",
                        rent: {
                            "Rent": "$14",
                            "With colour set": "$28",
                            "With 1 House": "$70",
                            "With 2 House": "$200",
                            "With 3 House": "$550",
                            "With 4 House": "$750",
                            "With Hotel": "$950",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$100 each",
                            "Hotel": "$100 each"
                        },
                        price: 180,
                        mortgaged: false
                    },
                    {
                        position: 19,
                        title: "$AI16Z Bridge",
                        color: "#d68000",
                        owner: "1",
                        rent: {
                            "Rent": "$16",
                            "With colour set": "$32",
                            "With 1 House": "$80",
                            "With 2 House": "$220",
                            "With 3 House": "$600",
                            "With 4 House": "$800",
                            "With Hotel": "$1000",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$100 each",
                            "Hotel": "$100 each"
                        },
                        price: 200,
                        mortgaged: false
                    },
                    {
                        position: 13,
                        title: "$MEW Road",
                        color: "#930086",
                        owner: "1",
                        rent: {
                            "Rent": "$10",
                            "With colour set": "$20",
                            "With 1 House": "$50",
                            "With 2 House": "$150",
                            "With 3 House": "$450",
                            "With 4 House": "$625",
                            "With Hotel": "$750",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$100 each",
                            "Hotel": "$100 each"
                        },
                        price: 140,
                        mortgaged: false
                    },
                    {
                        position: 11,
                        title: "$POPCAT Blvd",
                        color: "#930086",
                        owner: "1",
                        rent: {
                            "Rent": "$10",
                            "With colour set": "$20",
                            "With 1 House": "$50",
                            "With 2 House": "$150",
                            "With 3 House": "$450",
                            "With 4 House": "$625",
                            "With Hotel": "$750",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$100 each",
                            "Hotel": "$100 each"
                        },
                        price: 140,
                        mortgaged: false
                    },
                    {
                        position: 14,
                        title: "$PENGU Place",
                        color: "#930086",
                        owner: "1",
                        rent: {
                            "Rent": "$12",
                            "With colour set": "$24",
                            "With 1 House": "$60",
                            "With 2 House": "$180",
                            "With 3 House": "$500",
                            "With 4 House": "$700",
                            "With Hotel": "$900",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$100 each",
                            "Hotel": "$100 each"
                        },
                        price: 160,
                        mortgaged: false
                    },
                    {
                        position: 6,
                        title: "$PNUT Park",
                        color: "#6ba9a5",
                        owner: "1",
                        rent: {
                            "Rent": "$6",
                            "With colour set": "$12",
                            "With 1 House": "$30",
                            "With 2 House": "$90",
                            "With 3 House": "$270",
                            "With 4 House": "$400",
                            "With Hotel": "$550",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$50 each",
                            "Hotel": "$50 each"
                        },
                        price: 100,
                        mortgaged: false
                    },
                    {
                        position: 8,
                        title: "$CHILLGUY St",
                        color: "#6ba9a5",
                        owner: "1",
                        rent: {
                            "Rent": "$6",
                            "With colour set": "$12",
                            "With 1 House": "$30",
                            "With 2 House": "$90",
                            "With 3 House": "$270",
                            "With 4 House": "$400",
                            "With Hotel": "$550",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$50 each",
                            "Hotel": "$50 each"
                        },
                        price: 100,
                        mortgaged: false
                    },
                    {
                        position: 9,
                        title: "$TROLL Lane",
                        color: "#6ba9a5",
                        owner: "1",
                        rent: {
                            "Rent": "$8",
                            "With colour set": "$16",
                            "With 1 House": "$40",
                            "With 2 House": "$100",
                            "With 3 House": "$300",
                            "With 4 House": "$450",
                            "With Hotel": "$600",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$50 each",
                            "Hotel": "$50 each"
                        },
                        price: 120,
                        mortgaged: false
                    },
                    {
                        position: 1,
                        title: "$USELESS Ave",
                        color: "#614901",
                        owner: "1",
                        rent: {
                            "Rent": "$2",
                            "With colour set": "$4",
                            "With 1 House": "$10",
                            "With 2 House": "$30",
                            "With 3 House": "$90",
                            "With 4 House": "$160",
                            "With Hotel": "$250",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$50 each",
                            "Hotel": "$50 each"
                        },
                        price: 60,
                        mortgaged: false
                    },
                    {
                        position: 3,
                        title: "$67 Boulevard",
                        color: "#614901",
                        owner: "1",
                        rent: {
                            "Rent": "$4",
                            "With colour set": "$8",
                            "With 1 House": "$20",
                            "With 2 House": "$60",
                            "With 3 House": "$180",
                            "With 4 House": "$320",
                            "With Hotel": "$450",
                        },
                        houses: 0,
                        hotel: 0,
                        cost: {
                            "House": "$50 each",
                            "Hotel": "$50 each"
                        },
                        price: 60,
                        mortgaged: false
                    },
                ],
            },
            cards: {
                chance: {
                    available: shuffle([
                        "MASSIVE AIRDROP! Collect $200 in $MEMO tokens",
                        "Your bag pumped 1000x! Collect $100",
                        "RUGGED! Go directly to jail. Do not pass GO. Do not collect $200",
                        "Staking rewards hit different. Collect $100",
                        "Tax loss harvesting season. Collect $20",
                        "Solana gas fees lmao. Pay $50",
                        "Impermanent loss hit you. Pay $100",
                        "KOL shilled you a 100x. Collect $25",
                        OUT_OF_JAIL,
                        "MEV bot in your favour! Collect $200",
                        "You launched a coin on pump.fun! Collect $10 from each player",
                        "Diamond hands paid off. Collect $100",
                        "Liquidation cascade profits. Collect $50",
                        "Fartcoin transaction fee. Pay $50 (worth it)"
                    ]),
                    used: [],
                },
                community: {
                    available: shuffle([
                        OUT_OF_JAIL,
                        "RUGGED by dev! Go directly to jail. Do not pass GO. Do not collect $200",
                        "Advance to the next station. If UNOWNED, you may buy it from the bank. If OWNED, pay the owner twice the rent",
                        "Advance to $MEMO Palace",
                        "Advance to the next station. If UNOWNED, you may buy it from the bank. If OWNED, pay the owner twice the rent",
                        "Elected DAO chairman! Pay each player $50",
                        "Advance to $PIPPIN Square. If you pass GO collect $200",
                        "Your DeFi yield matures. Collect $150",
                        "Advance to GO, collect $200 in $MEMO tokens",
                        "Take a trip to Pump.fun Station, if you pass GO collect $200",
                        "Slippage on Jupiter. Pay $15",
                        "Advance to the nearest utility. If UNOWNED, you may buy it from the bank. If OWNED, roll the dice and pay 10x your roll",
                        "Maintenance on all your degens: For each house pay $25, for each hotel pay $100",
                        "Paper hands! Go back 3 spaces",
                        "Advance to $POPCAT Blvd, if you pass GO collect $200"
                    ]),
                    used: []

                }

            }
        }
    }

    processCommand = (command, params, from) => {
        const player = this.getPlayerFromId(from);
        switch (command) {
            case 'rollDice':
                this.rollDice(0, this.randomInt(10) + 5, from);
                break;
            case 'newPlayer':
                this.addNewPlayer(params);
                break;
            case 'sendMoney':
                this.transferNotes(params.from, params.to, params.notes);
                break;
            case 'movePlayer':
                this.movePlayer(params.id, params.x, params.y);
                break;
            case 'moveFinished':
                this.sendLog(this.getPlayerFromId(from).name + " moved player " + params.target);
                break;
            case 'sendDeed':
                this.transferDeed(params.street, params.type, params.to, from);
                break;
            case 'addHouse':
                this.addHouse(params.streetTitle, player);
                break;
            case 'removeHouse':
                this.removeHouse(params.streetTitle, player);
                break;
            case 'addHotel':
                this.addHotel(params.streetTitle, player);
                break;
            case 'removeHotel':
                this.removeHotel(params.streetTitle, player);
                break;
            case 'drawCard':
                this.drawCard(params.type, player);
                break;
            case 'loadGame':
                this.loadGame(params.game, player);
                break;
            case 'chat':
                this.addToChat(params.message, player);
                break;
            case 'mortgage':
                this.toggleMortgageDeed(params.title, params.type, player);
                break;
            case 'useOutOfJailCard':
                this.useOutOfJailCard(player);
                break;
            case 'transferOutOfJailCard':
                this.transferOutOfJailCard(player, params.to);
                break;
            case 'registerReferral':
                this.registerReferral(from, params.referrerCode);
                break;
            case 'claimDailyLogin':
                this.handleDailyLogin(from);
                break;
            case 'passedGo':
                this.awardCpoly(from, 50, 'passed GO');
                break;
            case 'getCpolyState':
                this.broadcastCpoly();
                break;
            case 'buyProperty':
                this.handleBuyProperty(from);
                break;
            case 'declineProperty':
                this.handleDeclineProperty(from);
                break;
            case 'endTurn':
                this.endTurn();
                break;
            case 'payJailFine':
                this.payJailFine(from);
                break;
        }

        return {type: 'game', game: this.game};
    }

    transferOutOfJailCard = (player, to) => {
        const toPlayer = this.getPlayerFromId(to);
        if (!toPlayer) {
            this.sendLog(to + " player doesn't exist");
            return;
        }

        if (player.outOfJail.community > 0) {
            player.outOfJail.community--;
            toPlayer.outOfJail.community++;
            this.sendLog(player.name + " sent a 'Get out of jail' card to " + toPlayer.name);
        } else if (player.outOfJail.chance > 0) {
            player.outOfJail.chance--;
            toPlayer.outOfJail.chance++;
            this.sendLog(player.name + " sent a 'Get out of jail' card to " + toPlayer.name);
        } else {
            this.sendLog(player.name + " doesn't have an 'Get out of jail' card");
        }

    }

    useOutOfJailCard = (player) => {
        if (player.outOfJail.community > 0) {
            player.outOfJail.community--;
            this.game.cards.community.used.push(OUT_OF_JAIL);
            this.sendLog(player.name + " has used a 'Get out of jail' card");
        } else if (player.outOfJail.chance > 0) {
            player.outOfJail.chance--;
            this.game.cards.chance.used.push(OUT_OF_JAIL);
            this.sendLog(player.name + " has used a 'Get out of jail' card");
        } else {
            this.sendLog(player.name + " doesn't have an 'Get out of jail' card");
        }
    }

    loadGame = (game, player) => {
        //removing keys that are not supposed to exist
        this.sendLog(player.name + ' is loading a saved game');
        Object.keys(game.game).forEach(k => {
            if (!this.game[k]) {
                delete game.game[k];
            }
        });

        this.game = {...this.newGame(), ...game.game};
        this.logs = game.logs || [];
        this.chat = game.chat || [];
        this.ws.broadcast(JSON.stringify({type: 'newGame', game: this.game}));
    }

    toggleMortgageDeed = (title, type, from) => {
        const deed = this.game.deeds[type].find(s => s.title === title);

        let canMortgage = this.canMortgage(deed, from);
        console.log('Can mortgage?', canMortgage);
        if (canMortgage) {
            deed.mortgaged = !deed.mortgaged;
            this.sendLog(from.name + " " + (deed.mortgaged ? "" : "un") + "mortgaged " + deed.title);
        } else {
            this.sendLog(from.name + " can't mortgage this property, either not the owner or other properties from the same color still have houses");
        }

    }

    canMortgage = (deed, user) => {
        console.log('can mortgage', deed, user);
        if (deed.owner !== user.id) {
            return false;
        }

        // it's a street, we need to check if there any houses left on the street of the same colors
        if (deed.color) {
            return this.game.deeds.regular.filter(d => d.color === deed.color)
                .every(d => d.houses === 0 && d.hotel === 0);
        } else {
            return true;
        }

    }

    drawCard = (type, player) => {
        const cards = this.game.cards[type];

        if (cards.available.length === 0) {
            cards.available = shuffle(cards.used);
            cards.used = [];
            this.sendLog("No more " + type + " cards, shuffling the old ones");
        }

        const picked = cards.available.pop();

        if (picked === OUT_OF_JAIL) {
            player.outOfJail[type]++;
        } else {
            cards.used.push(picked);
        }

        this.sendLog(player.name + " draw  " + type + " card \"" + picked + "\"");
        this.ws.broadcast(JSON.stringify({type: 'cardDrawn', card: picked, cardType: type, player: player}));

    }

    canBuyHouse = (street, player) => {
        // get total of house of same color
        return this.game.deeds.regular.filter(s => street.color === s.color)
            .every(s => s.owner == player.id);

    }

    addHouse = (title, player) => {

        const street = this.game.deeds.regular.find(s => s.title === title);
        let bank = this.game.players.find(p => p.id == 1);
        const availableHouses = bank.housing.houses;

        if (!this.canBuyHouse(street, player)) {
            this.sendLog(player.name + " is not allowed to add houses to " + street.title);
            return;
        }

        if (player.id != street.owner) {
            this.sendLog(player.name + " is not the owner of " + street.title);
            return;
        }
        if (street.hotel === 1) {
            this.sendLog(street.title + " already has a hotel");
            return;
        }

        if (street.houses === 4) {
            this.sendLog(street.title + " already has 4 houses");
            return;
        }

        if (availableHouses > 0) {
            street.houses++;
            bank.housing.houses--;
            this.sendLog(player.name + " added one house to " + title);
            this.sendLog("Bank balance: Houses: " + bank.housing.houses + ", Hotels: " + bank.housing.hotels);
        } else {
            this.sendLog("No more houses in the bank");
        }

    }

    removeHouse = (title, player) => {

        const street = this.game.deeds.regular.find(s => s.title === title);
        let bank = this.game.players.find(p => p.id == 1);
        const availableHouses = bank.housing.houses;
        if (!this.canBuyHouse(street, player)) {
            this.sendLog(player.name + " is not allowed to add houses to " + street.title);
            return;
        }

        if (player.id != street.owner) {
            this.sendLog(player.name + " is not the owner of " + street.title);
            return;
        }

        if (street.houses === 0) {
            this.sendLog(street.title + " as no more houses to remove");
            return;
        }

        street.houses--;
        bank.housing.houses++;
        this.sendLog(player.name + " removed one house from " + title);
        this.sendLog("Bank balance: Houses: " + bank.housing.houses + ", Hotels: " + bank.housing.hotels);

    }

    addHotel = (title, player) => {

        const street = this.game.deeds.regular.find(s => s.title === title);
        let bank = this.game.players.find(p => p.id == 1);
        const availableHotels = bank.housing.hotels;
        if (!this.canBuyHouse(street, player)) {
            this.sendLog(player.name + " is not allowed to add houses to " + street.title);
            return;
        }

        if (player.id != street.owner) {
            this.sendLog(player.name + " is not the owner of " + street.title);
            return;
        }

        if (street.houses < 4) {
            this.sendLog(street.title + " needs 4 houses to buy a hotel");
            return;
        }

        if (availableHotels > 0) {
            bank.housing.houses += street.houses;
            bank.housing.hotels--;
            street.hotel++;
            street.houses = 0;
            this.sendLog(player.name + " added one hotel to " + title);
            this.sendLog("Bank balance: Houses: " + bank.housing.houses + ", Hotels: " + bank.housing.hotels);
        } else {
            this.sendLog("No more hotels in the bank");
        }

    }

    removeHotel = (title, player) => {

        const street = this.game.deeds.regular.find(s => s.title === title);
        let bank = this.game.players.find(p => p.id == 1);
        const availableHotels = bank.housing.hotels;
        if (!this.canBuyHouse(street, player)) {
            this.sendLog(player.name + " is not allowed to add houses to " + street.title);
            return;
        }

        if (player.id != street.owner) {
            this.sendLog(player.name + " is not the owner of " + street.title);
            return;
        }

        if (street.hotel === 0) {
            this.sendLog(street.title + " as no more hotel to remove");
            return;
        }

        street.hotel--;
        bank.housing.hotels++;
        this.sendLog(player.name + " removed one hotel from " + title);
        this.sendLog("Bank balance: Houses: " + bank.housing.houses + ", Hotels: " + bank.housing.hotels);

    }

    transferDeed = (title, type, to, from) => {
        const owner = this.getPlayerFromId(this.game.deeds[type].find(s => s.title === title).owner);
        const toUser = this.getPlayerFromId(to);
        const deed = this.game.deeds[type].find(s => s.title === title);
        console.log('transfer deed:', deed);
        if (owner.id !== toUser.id) {

            // sending back to the bank, we give back the houses to the bank
            if (toUser.id === 1) {
                const houses = deed.houses;
                const hotel = deed.hotel;
                toUser.housing.hotels = toUser.housing.hotels + hotel;
                toUser.housing.houses = toUser.housing.houses + houses;
                deed.hotel = 0;
                deed.houses = 0;
                deed.mortgaged = false;
            }

            deed.owner = toUser.id;

            this.game.deeds[type].sort((s1, s2) => s2.position - s1.position);

            this.sendLog(this.getPlayerFromId(from).name + " transferred " + title + " from " + owner.name + " to " + toUser.name);

            if (toUser.id !== 1) this.checkColorSetBonus(toUser.id);

        } else {
            this.sendLog(title + " can't be sent to its current owner");
        }
    }

    movePlayer = (playerId, x, y) => {
        const player = this.getPlayerFromId(playerId);
        player.x = x;
        player.y = y;
    }

    addNewPlayer = (player) => {
        player.notes = {
            500: 0,
            100: 0,
            50: 0,
            20: 0,
            10: 0,
            5: 0,
            1: 0
        };
        player.x = 200 + 40 * this.game.players.length;
        player.y = 200;
        player.outOfJail = {
            chance: 0,
            community: 0,
        }
        player.position = 0;
        player.inJail = false;
        player.jailTurns = 0;

        this.game.players.push(player);
        this.handleDailyLogin(player.id);

        this.transferNotes(1, player.id, {
            1: 5,
            5: 1,
            10: 2,
            20: 1,
            50: 1,
            100: 4,
            500: 2,
        });

        // Add to turn order and start turns
        this.game.turnOrder.push(player.id);
        if (this.game.turnOrder.length >= 1 && !this.game.currentTurn) {
            this.startTurn(this.game.turnOrder[0]);
        }
    }

    getPlayerFromId = (id) => {
        return this.game.players.find(p => p.id == id);
    }

    calculateNotesSum = (notes) => {
        let sum = 0;

        Object.keys(notes).forEach(k => {
            sum += k * notes[k];
        });

        return sum;
    }

    transferNotes(from, to, notes) {
        const fromPlayer = this.getPlayerFromId(from);
        const toPlayer = this.getPlayerFromId(to);

        Object.keys(notes).forEach(k => {
            fromPlayer.notes[k] = fromPlayer.notes[k] - notes[k];
            toPlayer.notes[k] = toPlayer.notes[k] + notes[k];
        });

        const sum = this.calculateNotesSum(notes);
        const fromNewSum = this.calculateNotesSum(fromPlayer.notes);
        const toNewSum = this.calculateNotesSum(toPlayer.notes);

        const logLine = fromPlayer.name + " sent $" + sum + " to " + toPlayer.name;
        this.sendLog(logLine);
        this.sendLog(fromPlayer.name + " new balance: $" + fromNewSum);
        this.sendLog(toPlayer.name + " new balance: $" + toNewSum);
    }

    randomInt = (max) => {
        return Math.floor(Math.random() * Math.floor(max));
    }

    sendToWs = () => {
        this.ws.broadcast(JSON.stringify({type: 'game', game: this.game}));
    }

    sendLog = (message) => {
        const date = new Date();
        message = "[" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "] " + message;
        this.logs.push(message);
        fs.appendFileSync(this.logFile, message + '\n', 'utf8');

        if (this.logs.length > 200) {
            this.logs.shift();
        }

        this.ws.broadcast(JSON.stringify({type: 'log', message: this.logs}));
    }

    addToChat = (message, player) => {
        const date = new Date();
        message = "[" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "] " + player.name + ": " + message;
        message.replace('<', '&lt;').replace('>', '&gt;');
        fs.appendFileSync(this.chatFile, message + '\n', 'utf8');
        this.chat.push(message);

        if (this.chat.length > 200) {
            this.chat.shift();
        }

        this.ws.broadcast(JSON.stringify({type: 'chat', message: this.chat}));
    }

    rollDice = (times, max, from) => {
        const playerObj = this.getPlayerFromId(from);
        const player = playerObj ? playerObj.name : from;

        // Turn enforcement: only current turn player can roll, and only during rolling phase
        if (times === 0 && this.game.currentTurn && this.game.currentTurn !== from) {
            this.sendLog(player + " tried to roll but it's not their turn!");
            return;
        }
        if (times === 0 && this.game.turnPhase !== 'rolling') {
            return;
        }

        if (times === 0 && this.game.rollingDice === true) {
            return;
        }
        if (times === 0) {
            this.game.rollingDice = true;
            this.game.turnPhase = 'moving';
            this.sendToWs();
            this.sendLog(player + ' rolled the dice !');
        }

        this.game.dice[0] = this.randomInt(6) + 1;
        this.game.dice[1] = this.randomInt(6) + 1;

        this.sendToWs();

        if (times < max) {

            setTimeout(() => this.rollDice(times + 1, max, from)
                , Math.floor(Math.random() * Math.floor(250)) + 50)
        } else {
            this.game.rollingDice = false;

            const dice1 = this.game.dice[0];
            const dice2 = this.game.dice[1];
            const total = dice1 + dice2;
            const isDoubles = dice1 === dice2;

            this.game.lastRoll = {dice1, dice2, total, isDoubles};
            this.sendLog(player + ' rolled ' + dice1 + " and " + dice2 + "!" + (isDoubles ? " DOUBLES!" : ""));

            if (isDoubles) {
                this.game.doublesCount++;
            }

            // Handle jail roll
            if (playerObj && playerObj.inJail) {
                if (isDoubles) {
                    playerObj.inJail = false;
                    playerObj.jailTurns = 0;
                    this.sendLog(player + " rolled doubles and is free from jail!");
                } else {
                    playerObj.jailTurns++;
                    if (playerObj.jailTurns >= 3) {
                        this.autoTransferMoney(playerObj.id, 1, 50);
                        playerObj.inJail = false;
                        playerObj.jailTurns = 0;
                        this.sendLog(player + " failed to roll doubles 3 times. Paid $50 fine.");
                    } else {
                        this.sendLog(player + " is still in jail (" + playerObj.jailTurns + "/3 attempts)");
                        this.game.turnPhase = 'done';
                        this.sendToWs();
                        this.endTurn();
                        return;
                    }
                }
            }

            // Triple doubles = jail
            if (this.game.doublesCount >= 3 && playerObj) {
                this.sendLog(player + " rolled doubles 3 times in a row! Go to jail!");
                this.sendToJail(playerObj);
                return;
            }

            // Move player
            if (playerObj) {
                const oldPosition = playerObj.position || 0;
                const newPosition = (oldPosition + total) % 40;
                const passedGo = newPosition < oldPosition;

                playerObj.position = newPosition;
                this.game.turnPhase = 'action';

                if (passedGo && newPosition !== 0) {
                    this.autoTransferMoney(1, playerObj.id, 200);
                    this.sendLog(player + " passed GO and collected $200");
                    this.awardCpoly(playerObj.id, 50, 'passed GO');
                }

                this.sendLog(player + " moved to position " + newPosition);
                this.ws.broadcast(JSON.stringify({
                    type: 'playerMoved',
                    playerId: playerObj.id,
                    from: oldPosition,
                    to: newPosition,
                    passedGo: passedGo
                }));

                this.sendToWs();

                // Handle landing after a short delay for animation
                setTimeout(() => {
                    this.handleLanding(playerObj, newPosition);
                }, 500);
            } else {
                this.sendToWs();
            }
        }

    }

    // ========== TURN SYSTEM ==========

    startTurn = (playerId) => {
        this.game.currentTurn = playerId;
        this.game.turnPhase = 'rolling';
        this.game.doublesCount = 0;
        const player = this.getPlayerFromId(playerId);
        this.sendLog("It's " + player.name + "'s turn!");
        this.ws.broadcast(JSON.stringify({type: 'yourTurn', playerId: playerId}));
        this.sendToWs();
    }

    endTurn = () => {
        const lastRoll = this.game.lastRoll;
        // If doubles were rolled and not going to jail, same player goes again
        if (lastRoll && lastRoll.isDoubles && this.game.doublesCount < 3) {
            this.game.turnPhase = 'rolling';
            const player = this.getPlayerFromId(this.game.currentTurn);
            this.sendLog(player.name + " rolled doubles! Rolling again...");
            this.ws.broadcast(JSON.stringify({type: 'yourTurn', playerId: this.game.currentTurn}));
            this.sendToWs();
            return;
        }

        // Advance to next player
        const currentIndex = this.game.turnOrder.indexOf(this.game.currentTurn);
        const nextIndex = (currentIndex + 1) % this.game.turnOrder.length;
        this.game.doublesCount = 0;
        this.game.lastRoll = null;
        this.startTurn(this.game.turnOrder[nextIndex]);
    }

    // ========== AUTOMATED BANKER ==========

    pendingBuyOffer = null;
    buyOfferTimeout = null;

    handleLanding = (player, position) => {
        // Check all deed types
        const regularDeed = this.game.deeds.regular.find(d => d.position === position);
        const stationDeed = this.game.deeds.trainStations.find(d => d.position === position);
        const utilityDeed = this.game.deeds.utilities.find(d => d.position === position);
        const deed = regularDeed || stationDeed || utilityDeed;
        const deedType = regularDeed ? 'regular' : stationDeed ? 'trainStations' : utilityDeed ? 'utilities' : null;

        if (deed) {
            if (deed.owner === "1") {
                // Unowned - offer to buy
                this.pendingBuyOffer = {playerId: player.id, deed: deed, deedType: deedType};
                this.ws.broadcast(JSON.stringify({
                    type: 'buyOffer',
                    playerId: player.id,
                    property: deed.title,
                    price: deed.price,
                    position: deed.position
                }));
                this.sendLog(deed.title + " is available for $" + deed.price);
                // 15 second timeout
                this.buyOfferTimeout = setTimeout(() => {
                    if (this.pendingBuyOffer && this.pendingBuyOffer.playerId === player.id) {
                        this.sendLog(player.name + " didn't decide in time. " + deed.title + " stays with the bank.");
                        this.pendingBuyOffer = null;
                        this.game.turnPhase = 'done';
                        this.sendToWs();
                        this.ws.broadcast(JSON.stringify({type: 'buyOfferExpired'}));
                        this.endTurn();
                    }
                }, 15000);
                return; // Don't end turn yet - waiting for buy decision
            } else if (deed.owner != player.id && !deed.mortgaged) {
                // Owned by another player - pay rent
                const owner = this.getPlayerFromId(deed.owner);
                const rent = this.calculateRent(deed, deedType);
                if (rent > 0) {
                    this.autoTransferMoney(player.id, deed.owner, rent);
                    this.sendLog(player.name + " paid $" + rent + " rent to " + owner.name + " for " + deed.title);
                    this.ws.broadcast(JSON.stringify({
                        type: 'rentPaid',
                        fromPlayer: player.id,
                        fromName: player.name,
                        toPlayer: deed.owner,
                        toName: owner.name,
                        amount: rent,
                        property: deed.title
                    }));
                }
            }
            // Owned by self or mortgaged - nothing
        } else if (position === 4) {
            // Income Tax
            this.autoTransferMoney(player.id, 1, 200);
            this.sendLog(player.name + " paid $200 Income Tax");
            this.ws.broadcast(JSON.stringify({type: 'taxPaid', playerId: player.id, amount: 200, taxType: 'Income Tax'}));
        } else if (position === 38) {
            // Super Tax
            this.autoTransferMoney(player.id, 1, 100);
            this.sendLog(player.name + " paid $100 Super Tax");
            this.ws.broadcast(JSON.stringify({type: 'taxPaid', playerId: player.id, amount: 100, taxType: 'Super Tax'}));
        } else if (position === 30) {
            // Go To Jail
            this.sendToJail(player);
            return;
        } else if (position === 2 || position === 17 || position === 33) {
            // Community Chest
            this.autoDrawCard('community', player);
            return; // Card handling manages turn end
        } else if (position === 7 || position === 22 || position === 36) {
            // Chance
            this.autoDrawCard('chance', player);
            return; // Card handling manages turn end
        }
        // Position 0 (GO) and 10 (Jail/Just Visiting) - nothing extra

        this.game.turnPhase = 'done';
        this.sendToWs();
        this.endTurn();
    }

    calculateRent = (deed, deedType) => {
        if (deed.mortgaged) return 0;

        if (deedType === 'regular') {
            if (deed.hotel > 0) {
                return this.parseRentValue(deed.rent["With Hotel"]);
            }
            if (deed.houses > 0) {
                return this.parseRentValue(deed.rent["With " + deed.houses + " House"]);
            }
            // Check if owner has color set
            const ownerHasSet = this.game.deeds.regular
                .filter(d => d.color === deed.color)
                .every(d => d.owner === deed.owner);
            if (ownerHasSet) {
                return this.parseRentValue(deed.rent["With colour set"]);
            }
            return this.parseRentValue(deed.rent["Rent"]);
        } else if (deedType === 'trainStations') {
            const stationsOwned = this.game.deeds.trainStations.filter(s => s.owner === deed.owner).length;
            const rentMap = {1: 25, 2: 50, 3: 100, 4: 200};
            return rentMap[stationsOwned] || 25;
        } else if (deedType === 'utilities') {
            const utilitiesOwned = this.game.deeds.utilities.filter(u => u.owner === deed.owner).length;
            const diceTotal = (this.game.lastRoll && this.game.lastRoll.total) || (this.game.dice[0] + this.game.dice[1]);
            return utilitiesOwned >= 2 ? diceTotal * 10 : diceTotal * 4;
        }
        return 0;
    }

    parseRentValue = (rentStr) => {
        if (!rentStr) return 0;
        return parseInt(("" + rentStr).replace('$', '').replace(',', ''), 10) || 0;
    }

    autoTransferMoney = (fromId, toId, amount) => {
        // Transfer using $100 bills from bank's infinite supply conceptually
        // Break amount into note denominations
        const fromPlayer = this.getPlayerFromId(fromId);
        const toPlayer = this.getPlayerFromId(toId);
        if (!fromPlayer || !toPlayer) return;

        // Simple approach: deduct from total, add to recipient using available denominations
        const denominations = [500, 100, 50, 20, 10, 5, 1];
        let remaining = amount;
        const notes = {500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0};

        // Take from payer's notes
        for (const denom of denominations) {
            while (remaining >= denom && fromPlayer.notes[denom] > 0) {
                fromPlayer.notes[denom]--;
                notes[denom]++;
                remaining -= denom;
            }
        }

        // If player doesn't have exact change, still process (they owe)
        if (remaining > 0) {
            // Take larger bills and give change
            for (const denom of denominations) {
                if (fromPlayer.notes[denom] > 0 && denom >= remaining) {
                    fromPlayer.notes[denom]--;
                    const change = denom - remaining;
                    // Give change back from bank
                    let changeLeft = change;
                    for (const cd of denominations) {
                        while (changeLeft >= cd) {
                            fromPlayer.notes[cd]++;
                            const bank = this.getPlayerFromId(1);
                            if (bank.notes[cd] > 0) bank.notes[cd]--;
                            changeLeft -= cd;
                        }
                    }
                    notes[denom]++;
                    remaining = 0;
                    break;
                }
            }
        }

        // Add to payee
        for (const denom of denominations) {
            toPlayer.notes[denom] += notes[denom];
        }

        const fromSum = this.calculateNotesSum(fromPlayer.notes);
        const toSum = this.calculateNotesSum(toPlayer.notes);
        this.sendLog(fromPlayer.name + " new balance: $" + fromSum);
        this.sendLog(toPlayer.name + " new balance: $" + toSum);
    }

    handleBuyProperty = (playerId) => {
        if (!this.pendingBuyOffer || this.pendingBuyOffer.playerId !== playerId) return;
        clearTimeout(this.buyOfferTimeout);

        const {deed, deedType} = this.pendingBuyOffer;
        const player = this.getPlayerFromId(playerId);
        const balance = this.calculateNotesSum(player.notes);

        if (balance < deed.price) {
            this.sendLog(player.name + " can't afford " + deed.title + " ($" + deed.price + ")");
            this.pendingBuyOffer = null;
            this.game.turnPhase = 'done';
            this.sendToWs();
            this.endTurn();
            return;
        }

        this.autoTransferMoney(playerId, 1, deed.price);
        deed.owner = playerId;
        this.sendLog(player.name + " bought " + deed.title + " for $" + deed.price);
        this.ws.broadcast(JSON.stringify({
            type: 'propertyBought',
            playerId: playerId,
            playerName: player.name,
            property: deed.title,
            price: deed.price
        }));

        if (deedType === 'regular') this.checkColorSetBonus(playerId);

        this.pendingBuyOffer = null;
        this.game.turnPhase = 'done';
        this.sendToWs();
        this.endTurn();
    }

    handleDeclineProperty = (playerId) => {
        if (!this.pendingBuyOffer || this.pendingBuyOffer.playerId !== playerId) return;
        clearTimeout(this.buyOfferTimeout);

        const player = this.getPlayerFromId(playerId);
        this.sendLog(player.name + " declined to buy " + this.pendingBuyOffer.deed.title);
        this.pendingBuyOffer = null;
        this.game.turnPhase = 'done';
        this.sendToWs();
        this.endTurn();
    }

    // ========== JAIL ==========

    sendToJail = (player) => {
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        this.sendLog(player.name + " has been sent to jail!");
        this.ws.broadcast(JSON.stringify({
            type: 'jailed',
            playerId: player.id,
            playerName: player.name
        }));
        this.game.turnPhase = 'done';
        this.sendToWs();
        this.endTurn();
    }

    payJailFine = (playerId) => {
        const player = this.getPlayerFromId(playerId);
        if (!player || !player.inJail) return;

        const balance = this.calculateNotesSum(player.notes);
        if (balance < 50) {
            this.sendLog(player.name + " can't afford the $50 jail fine");
            return;
        }

        this.autoTransferMoney(playerId, 1, 50);
        player.inJail = false;
        player.jailTurns = 0;
        this.sendLog(player.name + " paid $50 to get out of jail");
        this.sendToWs();
    }

    // ========== AUTO CARD DRAW ==========

    autoDrawCard = (type, player) => {
        const cards = this.game.cards[type];

        if (cards.available.length === 0) {
            cards.available = shuffle(cards.used);
            cards.used = [];
            this.sendLog("No more " + type + " cards, shuffling the old ones");
        }

        const picked = cards.available.pop();

        if (picked === OUT_OF_JAIL) {
            player.outOfJail[type]++;
            this.sendLog(player.name + " drew: " + picked);
            this.ws.broadcast(JSON.stringify({type: 'cardDrawn', card: picked, cardType: type, player: player}));
            this.game.turnPhase = 'done';
            this.sendToWs();
            this.endTurn();
            return;
        }

        cards.used.push(picked);
        this.sendLog(player.name + " drew " + type + " card: \"" + picked + "\"");
        this.ws.broadcast(JSON.stringify({type: 'cardDrawn', card: picked, cardType: type, player: player}));

        // Execute card effects
        this.executeCardEffect(picked, player);
    }

    executeCardEffect = (card, player) => {
        const text = card.toLowerCase();

        if (text.includes('go directly to jail')) {
            this.sendToJail(player);
            return;
        }
        if (text.includes('advance to go') || text === 'advance to go, collect $200 in $memo tokens') {
            player.position = 0;
            this.autoTransferMoney(1, player.id, 200);
            this.sendLog(player.name + " advanced to GO and collected $200");
        } else if (text.includes('go back 3 spaces') || text.includes('paper hands')) {
            const oldPos = player.position;
            player.position = (player.position - 3 + 40) % 40;
            this.sendLog(player.name + " went back 3 spaces to position " + player.position);
            this.ws.broadcast(JSON.stringify({type: 'playerMoved', playerId: player.id, from: oldPos, to: player.position, passedGo: false}));
            this.handleLanding(player, player.position);
            return;
        } else if (text.includes('collect $') && text.includes('from each player')) {
            // "Collect $X from each player"
            const match = card.match(/\$(\d+)/);
            const amount = match ? parseInt(match[1], 10) : 10;
            const nonBankPlayers = this.game.players.filter(p => p.id !== 1 && p.id !== player.id);
            nonBankPlayers.forEach(p => {
                this.autoTransferMoney(p.id, player.id, amount);
            });
            this.sendLog(player.name + " collected $" + amount + " from each player");
        } else if (text.includes('pay each player $')) {
            const match = card.match(/pay each player \$(\d+)/i);
            const amount = match ? parseInt(match[1], 10) : 50;
            const nonBankPlayers = this.game.players.filter(p => p.id !== 1 && p.id !== player.id);
            nonBankPlayers.forEach(p => {
                this.autoTransferMoney(player.id, p.id, amount);
            });
            this.sendLog(player.name + " paid $" + amount + " to each player");
        } else if (text.includes('for each house pay') || text.includes('maintenance')) {
            const houseMatch = card.match(/house pay \$(\d+)/i);
            const hotelMatch = card.match(/hotel pay \$(\d+)/i);
            const houseCost = houseMatch ? parseInt(houseMatch[1], 10) : 25;
            const hotelCost = hotelMatch ? parseInt(hotelMatch[1], 10) : 100;
            let totalHouses = 0, totalHotels = 0;
            this.game.deeds.regular.forEach(d => {
                if (d.owner == player.id) {
                    totalHouses += d.houses;
                    totalHotels += d.hotel;
                }
            });
            const total = totalHouses * houseCost + totalHotels * hotelCost;
            if (total > 0) {
                this.autoTransferMoney(player.id, 1, total);
                this.sendLog(player.name + " paid $" + total + " for maintenance (" + totalHouses + " houses, " + totalHotels + " hotels)");
            }
        } else if (text.includes('advance to') && !text.includes('go')) {
            // Advance to a specific property
            this.handleAdvanceCard(card, player);
            return;
        } else if (text.includes('take a trip to')) {
            this.handleAdvanceCard(card, player);
            return;
        } else if (text.includes('collect $')) {
            const match = card.match(/\$(\d+)/);
            const amount = match ? parseInt(match[1], 10) : 0;
            if (amount > 0) {
                this.autoTransferMoney(1, player.id, amount);
                this.sendLog(player.name + " collected $" + amount);
            }
        } else if (text.includes('pay $')) {
            const match = card.match(/\$(\d+)/);
            const amount = match ? parseInt(match[1], 10) : 0;
            if (amount > 0) {
                this.autoTransferMoney(player.id, 1, amount);
                this.sendLog(player.name + " paid $" + amount);
            }
        } else if (text.includes('advance to the next station') || text.includes('advance to the nearest utility')) {
            this.handleAdvanceToNearest(card, player);
            return;
        }

        this.game.turnPhase = 'done';
        this.sendToWs();
        this.endTurn();
    }

    handleAdvanceCard = (card, player) => {
        const oldPos = player.position;

        // Find the target property by name
        const allDeeds = [
            ...this.game.deeds.regular,
            ...this.game.deeds.trainStations,
            ...this.game.deeds.utilities
        ];

        let target = null;
        for (const deed of allDeeds) {
            if (card.includes(deed.title)) {
                target = deed;
                break;
            }
        }

        if (target) {
            player.position = target.position;
            const passedGo = target.position < oldPos;
            if (passedGo) {
                this.autoTransferMoney(1, player.id, 200);
                this.sendLog(player.name + " passed GO and collected $200");
            }
            this.sendLog(player.name + " advanced to " + target.title);
            this.ws.broadcast(JSON.stringify({type: 'playerMoved', playerId: player.id, from: oldPos, to: player.position, passedGo: passedGo}));
            this.handleLanding(player, player.position);
        } else {
            this.game.turnPhase = 'done';
            this.sendToWs();
            this.endTurn();
        }
    }

    handleAdvanceToNearest = (card, player) => {
        const oldPos = player.position;
        const text = card.toLowerCase();
        let positions;
        let doubleRent = false;

        if (text.includes('station')) {
            positions = this.game.deeds.trainStations.map(s => s.position);
            doubleRent = text.includes('twice the rent');
        } else {
            positions = this.game.deeds.utilities.map(u => u.position);
        }

        // Find nearest ahead
        let nearest = null;
        let minDist = 41;
        for (const pos of positions) {
            const dist = (pos - oldPos + 40) % 40;
            if (dist > 0 && dist < minDist) {
                minDist = dist;
                nearest = pos;
            }
        }

        if (nearest !== null) {
            player.position = nearest;
            const passedGo = nearest < oldPos;
            if (passedGo) {
                this.autoTransferMoney(1, player.id, 200);
                this.sendLog(player.name + " passed GO and collected $200");
            }

            const deed = [...this.game.deeds.trainStations, ...this.game.deeds.utilities].find(d => d.position === nearest);
            this.sendLog(player.name + " advanced to " + (deed ? deed.title : "position " + nearest));
            this.ws.broadcast(JSON.stringify({type: 'playerMoved', playerId: player.id, from: oldPos, to: player.position, passedGo: passedGo}));

            // If owned by another and double rent from community card
            if (deed && deed.owner !== "1" && deed.owner != player.id && !deed.mortgaged && doubleRent) {
                const deedType = this.game.deeds.trainStations.find(d => d.position === nearest) ? 'trainStations' : 'utilities';
                const rent = this.calculateRent(deed, deedType) * 2;
                const owner = this.getPlayerFromId(deed.owner);
                this.autoTransferMoney(player.id, deed.owner, rent);
                this.sendLog(player.name + " paid $" + rent + " (double rent) to " + owner.name);
                this.ws.broadcast(JSON.stringify({type: 'rentPaid', fromPlayer: player.id, fromName: player.name, toPlayer: deed.owner, toName: owner.name, amount: rent, property: deed.title}));
                this.game.turnPhase = 'done';
                this.sendToWs();
                this.endTurn();
            } else if (deed && deed.owner !== "1" && deed.owner != player.id && text.includes('10x')) {
                // Utility: pay 10x dice
                const diceTotal = this.game.dice[0] + this.game.dice[1];
                const rent = diceTotal * 10;
                const owner = this.getPlayerFromId(deed.owner);
                this.autoTransferMoney(player.id, deed.owner, rent);
                this.sendLog(player.name + " paid $" + rent + " to " + owner.name);
                this.game.turnPhase = 'done';
                this.sendToWs();
                this.endTurn();
            } else {
                this.handleLanding(player, player.position);
            }
        } else {
            this.game.turnPhase = 'done';
            this.sendToWs();
            this.endTurn();
        }
    }

    logFile = require('path').join(__dirname, '..', 'static', 'logs.txt');
    chatFile = require('path').join(__dirname, '..', 'static', 'chat.txt');
    game = this.newGame();
    ws = undefined;

}

exports.GameService = GameService;
exports.gameService = new GameService();
