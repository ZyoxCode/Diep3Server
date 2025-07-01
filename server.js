// server.js
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { Worker } from 'worker_threads';
import { cors } from 'cors'

import * as games from './game.js'

const Game = new games.Game('sandbox', 'tiny')
const tickWorker = new Worker('./utils/tickWorker.js', { type: 'module' });


// Set up Express app
const app = express();
app.use(cors({ origin: 'https://diep3.oggyp.com' }));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://diep3.oggyp.com",
        methods: ["GET", "POST"]
    }
});

// Track connected players
let sockets = {};


const MAP_SIZE = 200;
const GRID_INTERVAL = 5;
const globalMoveSpeed = 0.02;


const STARTING_SCORE = 100;
const STARTING_SIZE = 5;


// Handle new socket connections
io.on('connection', (socket) => {

    console.log(`Player connected: ${socket.id}`);
    socket.emit('init', {
        id: socket.id,
        map_size: MAP_SIZE,
        grid_interval: GRID_INTERVAL,
        starting_score: STARTING_SCORE,
        starting_size: STARTING_SIZE,
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

    socket.on('changeTankRequest', (data) => {


        Game.playerDict[socket.id].switchPreset(data.name)
        Game.upgradeCull(socket.id);
        // if (success == false) {
        //     socket.emit('addBroadcast', { 'text': `Invalid tank name: ${data.name}` })
        // }

    });

    socket.on('setUsername', (data) => {


        Game.playerDict[socket.id].username = data.username
        // if (success == false) {
        //     socket.emit('addBroadcast', { 'text': `Invalid tank name: ${data.name}` })
        // }

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
tickWorker.on('message', (now) => {
    //console.log(Date.now() - last)
    // last = Date.now()
    Game.messagesToBroadcast = [];

    Game.sectorLoop()
    Game.playerLoop()
    Game.projectileLoop()
    Game.polyLoop()
    Game.cullObjects()
    Game.updateLeaderboard()


    for (let i in Game.emissions) {
        let emission = Game.emissions[i]
        if (emission.id in sockets) {
            //console.log(emission)
            sockets[emission.id].emit(emission.type, emission.data)

        }
        Game.emissions.splice(i, 1)

    }
    for (let message of Game.messagesToBroadcast) {
        sockets[message.id].emit('addBroadcast', { 'text': message.message })
    }

    io.emit('gameState', { 'players': Game.playerDict, 'projectiles': Game.projectileList, 'polygons': Game.polygonList, 'leaderboard': Game.lb, 'immovables': Game.immovableObjectList });

});


// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
