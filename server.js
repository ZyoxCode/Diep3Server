// server.js
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
//import { Worker } from 'worker_threads';
import cors from 'cors'

import * as games from './game.js'

const Game = new games.Game('sandbox', 'tiny')
//const tickWorker = new Worker('./utils/tickWorker.js', { type: 'module' });


// Set up Express app
const app = express();
app.use(cors({
    origin: 'https://diep3.oggyp.com',
    credentials: true
}));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://diep3.oggyp.com",
        methods: ["GET", "POST"],
        credentials: true
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
// tickWorker.on('message', (now) => {

setInterval(() => {
    Game.messagesToBroadcast = [];

    Game.sectorLoop()
    Game.playerLoop()
    Game.projectileLoop()
    Game.polyLoop()
    Game.cullObjects()
    Game.updateLeaderboard()


    let transmitPlayers = {};
    for (let id in Game.playerDict) {
        let player = Game.playerDict[id]

        transmitPlayers[player.id] = { 'id': player.id, 'username': player.username, 'rotation': player.rotation, 'position': player.position, 'joints': player.joints, 'hp': player.hp, 'stats': { 'maxHp': player.maxHp }, 'upgradesTo': player.upgradesTo, 'level': player.level, 'score': player.score, 'tankoidPreset': player.tankoidPreset, 'allocatablePoints': player.allocatablePoints, 'fadeTimer': player.fadeTimer, 'flashTimer': player.flashTimer, 'size': player.size, 'allowedUpgrade': player.allowedUpgrade, 'skillUpgrades': player.skillUpgrades }

    }
    let transmitProjectiles = [];
    for (let proj of Game.projectileList) {

        transmitProjectiles.push({ 'position': proj.position, 'id': proj.id, 'rotation': proj.rotation, 'joints': proj.joints, 'tankoidPreset': proj.tankoidPreset, 'flashTimer': proj.flashTimer, 'fadeTimer': proj.fadeTimer, 'size': proj.size })
    }

    let transmitPolys = [];
    for (let poly of Game.polygonList) {
        transmitPolys.push({ 'position': poly.position, 'maxHp': poly.maxHp, 'hp': poly.hp, 'rotation': poly.rotation, 'size': poly.size, 'flashTimer': poly.flashTimer, 'fadeTimer': poly.fadeTimer, 'sides': poly.sides, 'polygonType': poly.polygonType })

    }


    io.emit('gameState', { 'players': transmitPlayers, 'projectiles': transmitProjectiles, 'polygons': transmitPolys, 'leaderboard': Game.lb, 'immovables': Game.immovableObjectList });
}, 1000 / 60);
//console.log(Date.now() - last)
// last = Date.now()


// });


// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
