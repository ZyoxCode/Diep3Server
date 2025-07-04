// server.js
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { Worker } from 'worker_threads';
//import cors from 'cors'

import * as games from './game.js'

const Game = new games.Game('sandbox', 'small')
const tickWorker = new Worker('./utils/tickWorker.js', { type: 'module' });


// Set up Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Track connected players
let sockets = {};


const MAP_SIZE = 300;
const GRID_INTERVAL = 5;


const STARTING_SCORE = 100;
const STARTING_SIZE = 5;

const adminKey = 'adminKey'; // yes i know very secure only temporary


// Handle new socket connections
io.on('connection', (socket) => {

    console.log(`Player connected: ${socket.id}`);
    socket.emit('init', {
        id: socket.id,
        map_size: MAP_SIZE,
        grid_interval: GRID_INTERVAL,
        starting_score: STARTING_SCORE,
        starting_size: STARTING_SIZE,
        'immovables': Game.immovableObjectList,
        x: 0,
        y: 0,
    });

    sockets[socket.id] = socket;
    Game.addPlayer(socket.id)

    socket.on('moveReq', (moveInfo) => { // Add movement speeds for different tanks later

        Game.playerDict[socket.id].moveReq = true;
        Game.playerDict[socket.id].moveReqAngle = moveInfo.moveReqAngle

    });

    socket.on('mouseMove', (data) => { // Add movement speeds for different tanks later

        if (Game.playerDict[socket.id].hasForcedAutoSpin == false) {
            Game.playerDict[socket.id].rotation = data.angle;
        }
        Game.playerDict[socket.id].mousePos.x = data.mousePos.x;
        Game.playerDict[socket.id].mousePos.y = data.mousePos.y;

    });

    socket.on('autoFireToggle', (data) => {

        if (Game.playerDict[socket.id].autofire == true) {
            Game.playerDict[socket.id].autofire = false;
            socket.emit('addBroadcast', { 'text': "Autofire Off" })

        } else {
            Game.playerDict[socket.id].autofire = true;
            socket.emit('addBroadcast', { 'text': "Autofire On" })
        }

    });

    socket.on('requestingFire', (data) => { // Add movement speeds for different tanks later

        Game.playerDict[socket.id].requestingFire = true;

    });
    socket.on('activateReverser', (data) => { // Add movement speeds for different tanks later

        Game.playerDict[socket.id].reverser = true;

    });

    socket.on('cancelReverser', (data) => { // Add movement speeds for different tanks later

        Game.playerDict[socket.id].reverser = false;

    });

    socket.on('requestingCeaseFire', (data) => { // Add movement speeds for different tanks later

        Game.playerDict[socket.id].requestingFire = false;

    });

    socket.on('moveStop', (moveInfo) => {

        Game.playerDict[socket.id].moveReq = false;

    });

    socket.on('setUsername', (data) => {

        Game.playerDict[socket.id].username = data.username

    });

    socket.on('sendChatMessage', (data) => {

        let message = data;
        if (message.startsWith('$')) {
            if (message.startsWith('auth', 1)) {
                if (message.startsWith(adminKey, 6)) {
                    socket.emit('addBroadcast', { 'text': 'Admin Granted' })
                    Game.playerDict[socket.id].isAdmin = true;
                } else {
                    socket.emit('addBroadcast', { 'text': 'Incorrect Authorisation Key' })
                }
            } else if (message.startsWith('change', 1)) {
                if (Game.playerDict[socket.id].isAdmin = true) {
                    Game.playerDict[socket.id].switchPreset(message.slice(8))
                    Game.upgradeCull(socket.id);
                } else {
                    socket.emit('addBroadcast', { 'text': 'Insufficient Privileges' })
                }
            }
        } else {
            Game.chatMessagesToAdd.push({ 'id': socket.id, 'message': data })
        }

    });

    socket.on('tankUpgradeRequest', (data) => {
        Game.playerDict[socket.id].switchPreset(data);
        Game.upgradeCull(socket.id);
    });

    socket.on('upgradeRequest', (data) => {

        if (data.name in Game.playerDict[socket.id].skillUpgrades) {
            let requestingLevel = data.levelRequesting;
            let currentLevel = Game.playerDict[socket.id].skillUpgrades[data.name].level;
            let allocatable = Game.playerDict[socket.id].allocatablePoints;
            let diff = requestingLevel - currentLevel;


            if (allocatable - diff >= 0) {
                Game.playerDict[socket.id].skillUpgrades[data.name].level += diff;
                Game.playerDict[socket.id].allocatablePoints += -diff;
            } else {
                Game.playerDict[socket.id].skillUpgrades[data.name].level += allocatable;
                Game.playerDict[socket.id].allocatablePoints = 0;
            }
            Game.playerDict[socket.id].updateStatsOnUpgrade()
        }


    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        Game.removePlayer(socket.id)
        delete sockets[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// let last = Date.now()
// tickWorker.on('message', (now) => {

tickWorker.on('message', (now) => {
    Game.messagesToBroadcast = [];
    Game.sectorLoop()
    Game.playerLoop()
    Game.projectileLoop()
    Game.polyLoop()
    Game.cullObjects()
    Game.restrictAllObjects()
    Game.updateLeaderboard()


    for (let i in Game.emissions) {
        let emission = Game.emissions[i]
        if (emission.id in sockets) {
            sockets[emission.id].emit(emission.type, emission.data)

        }
        Game.emissions.splice(i, 1)

    }

    for (let message of Game.messagesToBroadcast) {
        sockets[message.id].emit('addBroadcast', { 'text': message.message })
    }


    for (let idSelf in sockets) {


        let transmitProjectiles = {}
        for (let id in Game.projectileList) {
            let transmitStats = [
                'position',
                'id',
                'tankoidPreset',
                'joints',
                'rotation',
                'size',
                'flashTimer',
                'fadeTimer'
            ];

            let transmitDict = {}
            if ('projectiles' in Game.lastState && id in Game.lastState.projectiles) {


                if (Game.playerDict[idSelf].firstTransmit == true) {

                    for (let stat of transmitStats) {

                        transmitDict[stat] = Game.projectileList[id][stat];
                    }
                } else {
                    for (let stat of transmitStats) {

                        const stat1 = Game.projectileList[id][stat]
                        const stat2 = Game.lastState.projectiles[id][stat]

                        if (!(JSON.stringify(stat1) === JSON.stringify(stat2))) {
                            //console.log(stat, stat1)
                            transmitDict[stat] = stat1;

                        }
                    }
                }

            } else {
                transmitDict = Game.projectileList[id]
            }
            transmitProjectiles[id] = transmitDict
        }


        let transmitLb = {}
        for (let id in Game.lb.entries) {
            let transmitDict = {}
            if ('leaderboard' in Game.lastState && id in Game.lastState.leaderboard.entries) {
                if (Game.playerDict[idSelf].firstTransmit == true) {

                    for (let stat in Game.lb.entries[id]) {
                        //console.log(stat)
                        transmitDict[stat] = Game.lb.entries[id][stat];
                    }
                } else {
                    for (let stat in Game.lb.entries[id]) {
                        const stat1 = Game.lb.entries[id][stat]
                        const stat2 = Game.lastState.leaderboard.entries[id][stat]

                        if (!(JSON.stringify(stat1) === JSON.stringify(stat2))) {
                            //console.log(stat, stat1)
                            transmitDict[stat] = stat1;
                        }
                    }
                }

            } else {
                transmitDict = Game.lb.entries[id]
            }
            transmitLb[id] = transmitDict
        }

        let transmitPlayers = {};
        for (let id in Game.playerDict) {
            let player = Game.playerDict[id]

            let transmitStats = [];
            if (id == idSelf) {

                transmitStats = [
                    'id',
                    'username',
                    'rotation',
                    'position',
                    'joints',
                    'hp',
                    'stats',
                    'upgradesTo',
                    'level',
                    'score',
                    'tankoidPreset',
                    'allocatablePoints',
                    'fadeTimer',
                    'flashTimer',
                    'allowedUpgrade',
                    'size',
                    'skillUpgrades'
                ]
            } else {
                transmitStats = [
                    'id',
                    'username',
                    'rotation',
                    'position',
                    'joints',
                    'hp',
                    'stats',
                    'score',
                    'tankoidPreset',
                    'fadeTimer',
                    'flashTimer',
                    'size',
                ]
            }
            let transmitDict = {};
            if ('players' in Game.lastState && id in Game.lastState.players) {

                if (Game.playerDict[idSelf].firstTransmit == true) {
                    //console.log('ello')
                    for (let stat of transmitStats) {
                        transmitDict[stat] = player[stat];

                    }
                } else {
                    for (let stat of transmitStats) {

                        const stat1 = Game.playerDict[id][stat]
                        const stat2 = Game.lastState.players[id][stat]

                        if (!(JSON.stringify(stat1) === JSON.stringify(stat2))) {

                            transmitDict[stat] = player[stat];
                        }
                    }
                }


            } else {
                for (let stat of transmitStats) {
                    transmitDict[stat] = player[stat];

                }
            }


            transmitPlayers[player.id] = transmitDict


        }

        let transmitPolys = {};
        for (let id in Game.polygonList) {
            let poly = Game.polygonList[id]

            let transmitStats = [
                'position',
                'maxHp',
                'polygonType',
                'hp',
                'rotation',
                'size',
                'flashTimer',
                'fadeTimer',
                'sides'
            ];

            let transmitDict = {};


            if ('polygons' in Game.lastState && id in Game.lastState.polygons) {
                if (Game.playerDict[idSelf].firstTransmit == true) {

                    for (let stat of transmitStats) {
                        transmitDict[stat] = poly[stat];
                    }
                } else {
                    for (let stat of transmitStats) {

                        const stat1 = Game.polygonList[id][stat]
                        const stat2 = Game.lastState.polygons[id][stat]

                        if (!(JSON.stringify(stat1) === JSON.stringify(stat2))) {
                            transmitDict[stat] = poly[stat];
                        }
                    }
                }
            } else {
                for (let stat of transmitStats) {
                    transmitDict[stat] = poly[stat];
                }
            }

            transmitPolys[id] = transmitDict;

        }
        //console.log(transmitLb)

        let json = { 'players': transmitPlayers, 'projectiles': transmitProjectiles, 'polygons': transmitPolys, 'leaderboard': transmitLb, 'chatMessages': Game.chatMessagesToAdd }
        //console.log("Total bytes sent this tick:", Buffer.byteLength(JSON.stringify(json), 'utf8'))
        Game.playerDict[idSelf].firstTransmit = false;
        sockets[idSelf].emit('gameState', json);
    }
    Game.chatMessagesToAdd = [];
    let transmitPlayers = {};
    let transmitStats = [
        'id',
        'username',
        'rotation',
        'position',
        'joints',
        'hp',
        'stats',
        'upgradesTo',
        'level',
        'score',
        'tankoidPreset',
        'allocatablePoints',
        'fadeTimer',
        'flashTimer',
        'allowedUpgrade',
        'size',
        'skillUpgrades'
    ]
    for (let id in Game.playerDict) {

        //console.log(id)
        transmitPlayers[id] = {}
        for (let stat of transmitStats) {
            transmitPlayers[id][stat] = Game.playerDict[id][stat];
        }
    }

    let transmitPolys = {};
    transmitStats = [
        'position',
        'maxHp',
        'polygonType',
        'hp',
        'rotation',
        'size',
        'flashTimer',
        'fadeTimer',
        'sides'
    ];

    for (let id in Game.polygonList) {
        transmitPolys[id] = {}
        for (let stat of transmitStats) {
            transmitPolys[id][stat] = Game.polygonList[id][stat];
        }
    }

    let transmitProjectiles = {};
    transmitStats = [
        'position',
        'id',
        'tankoidPreset',
        'joints',
        'rotation',
        'size',
        'flashTimer',
        'fadeTimer'
    ];

    for (let id in Game.projectileList) {
        transmitProjectiles[id] = {}
        for (let stat of transmitStats) {
            transmitProjectiles[id][stat] = Game.projectileList[id][stat];
        }
    }
    let json = { 'players': transmitPlayers, 'projectiles': transmitProjectiles, 'polygons': transmitPolys, 'leaderboard': Game.lb }

    Game.lastState = structuredClone(json)


});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
