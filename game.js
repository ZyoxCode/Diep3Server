import { ImmovableObject } from './classes/gameobjects/other.js';
import { Player } from './classes/gameobjects/players.js'
import { Polygon } from './classes/gameobjects/polygons.js';
import * as mapFeatures from './classes/mapfeatures.js'
import * as physics from './utils/physics.js'
import * as lbd from './classes/leaderboard.js'

import { readFile } from 'fs/promises';
import { MockupTankoid } from './classes/gameobjects/gameobject.js';


const mapPresets = JSON.parse(
    await readFile(
        new URL('./resources/json/mapPresets.json', import.meta.url)
    )
);

const modeBehaviours = JSON.parse(
    await readFile(
        new URL('./resources/json/gameTypeAttributes.json', import.meta.url)
    )
);



export class Game { // Might actually extend this class for different game types later but orwell
    constructor(mode = 'sandbox', mapType = 'tiny') {
        this.mode = mode;
        this.modePreset = mode;
        if (!(mode in modeBehaviours)) {
            this.modePreset = 'default';
        }

        this.upgradeCurves = modeBehaviours[this.modePreset].upgradeCurves;
        this.levellingInfo = modeBehaviours[this.modePreset].levels;
        this.constants = modeBehaviours[this.modePreset].constants;


        this.mapPresetSectors = mapPresets[this.mode][mapType].sectors;
        this.mapSize = mapPresets[this.mode][mapType].size;
        this.mapSectors = [] // might change this dumb system later

        for (let sector of this.mapPresetSectors) {
            this.mapSectors.push(new mapFeatures.MapSector(...sector, this.constants.globalDefaultSpawnRate, this.constants.globalDefaultSpawnCapacity))
        }

        this.playerDict = {};
        this.lastState = {};
        this.projectileList = {};
        this.polygonList = {};
        this.immovableObjectList = [];
        this.emissions = [];
        this.chatMessagesToAdd = [];

        this.collisionEngine = new physics.Collider()
        this.lb = new lbd.Leaderboard(10, 100, 10)
        this.messagesToBroadcast = [];

        this.immovableObjectList.push(new ImmovableObject(0, 111, 0, 10, 12))
        this.immovableObjectList.push(new ImmovableObject(40, 128, 42, 8, 8))
        this.immovableObjectList.push(new ImmovableObject(-45, 122, -10, 7, 7))
        this.immovableObjectList.push(new ImmovableObject(-2, 140, -1, 9, 10))
        this.immovableObjectList.push(new ImmovableObject(-34, 137, -1, 5, 7))

        this.immovableObjectList.push(new ImmovableObject(0, -111, 0, 10, 12))
        this.immovableObjectList.push(new ImmovableObject(-40, -128, 42, 8, 8))
        this.immovableObjectList.push(new ImmovableObject(45, -122, -10, 7, 7))
        this.immovableObjectList.push(new ImmovableObject(2, -140, -1, 9, 10))
        this.immovableObjectList.push(new ImmovableObject(34, -137, -1, 5, 7))
        //this.immovableObjectList.push(new ImmovableObject(0, 50, 45, 10, 4))

    }

    addPlayer(id, x = 'random', y = 'random', name = 'Unnamed Tank') {
        let spawnX = x;
        let spawnY = y;
        if (x == 'random' && y == 'random') {
            spawnX = (Math.random() - 0.5) * (this.mapSize / 2) * 2
            spawnY = (Math.random() - 0.5) * (this.mapSize / 2) * 2
        }
        this.playerDict[id] = new Player(id, name, spawnX, spawnY, 0, 'Basic', this.upgradeCurves, this.constants.startScore);
        this.addScore(this.playerDict[id], 0)
    }

    removePlayer(id) {
        this.upgradeCull(id)
        delete this.playerDict[id]
    }

    sectorLoop() {
        let spawnResult;
        for (const [i, sector] of this.mapSectors.entries()) {

            spawnResult = sector.spawnTick();
            if (spawnResult != 'None') {
                let polygon = new Polygon(i, ...spawnResult)
                let collided = false;
                for (let immovable of this.immovableObjectList) {
                    if ((immovable.sides != 4 && this.collisionEngine.collisionCheck(immovable, polygon) == true) || (immovable.sides == 4 && this.collisionEngine.squareNonSquareCollision(immovable, polygon) == true)) {
                        collided = true;
                    }
                }
                if (collided == false) {
                    this.polygonList[Date.now().toString(36) + Math.random().toString(36).substring(2)] = polygon
                }
            }
        }
    }

    playerLoop() {
        for (const [id, player] of Object.entries(this.playerDict)) {
            player.tick()
            // player.tickCalc()
            if ((player.requestingFire == true || player.autofire == true) && player.hp > 0) {
                let newProjectiles = player.scheduleFiring()
                for (let projectile of newProjectiles) {
                    if (projectile != 'None') {

                        this.projectileList[Date.now().toString(36) + Math.random().toString(36).substring(2)] = projectile
                    }
                }
            }

            if (player.autoTurrets.length > 0) {
                player.tickAutoTurretBehaviour(this.playerDict, this.polygonList)
                let newProjectiles = player.scheduleAutoTurretFiring()
                for (let projectile of newProjectiles) {
                    if (projectile != 'None') {
                        this.projectileList[Date.now().toString(36) + Math.random().toString(36).substring(2)] = projectile
                    }

                }
            }
            this.immovableCollision(player);
            this.playerPolyCollision(player);
            this.playerProjectileCollision(player);
            this.playerPlayerCollision(id, player);

        }
    }

    immovableCollision(object) { // try an actual position correction
        for (let immovable of this.immovableObjectList) {
            let collided = this.collisionEngine.immovableCollision(immovable, object)
        }
    }

    playerPlayerCollision(id1, player1) {
        for (const [id2, player2] of Object.entries(this.playerDict)) {
            if (id1 != id2 && player1.hp > 0 && player2.hp > 0) {
                let collided = this.collisionEngine.collisionHandler(player1, player2);
                if (collided == true) {

                    if (player1.hp <= 0 || player2.hp <= 0) {
                        this.scoreTransfer(player1, player2)
                    }

                    player1.ticksSinceLastHit = 0;
                    player2.ticksSinceLastHit = 0;
                }
                // I also think the health transfer should be done outside the collider object
                // I think score transfer should be done at the end and tracked by some idLastHitBy variable or something
                // if (collided)
                // Going to leave score transfer for the moment because it should be specific to mode rules
            }

        }
    }

    playerPolyCollision(player) {
        for (const [id, poly] of Object.entries(this.polygonList)) {
            if (poly.hp > 0 && player.hp > 0) {
                let collided = this.collisionEngine.collisionHandler(player, poly)
                if (collided == true) {
                    player.ticksSinceLastHit = 0;
                    poly.idLastHitBy = player.id;
                    if (poly.hp <= 0) {
                        this.scoreTransfer(player, poly)
                    }
                }
            }
        }
    }

    playerProjectileCollision(player) {
        for (let id in this.projectileList) {
            let proj = this.projectileList[id]
            if (player.hp > 0 && proj.stats.lifespan > 0 && player.id != proj.id) {
                let collided = this.collisionEngine.collisionHandler(player, proj)
                player.ticksSinceLastHit = 0;
                if (collided == true && player.hp <= 0) {
                    this.scoreTransfer(proj, player);
                }
            }
        }
    }

    projectileLoop() {
        for (const [i, proj] of Object.entries(this.projectileList)) {
            proj.tick()
            this.immovableCollision(proj);
            this.projectilePolyCollision(proj)
            this.projectileProjectileCollision(i, proj)

            if (proj.autoTurrets.length > 0) {
                proj.tickAutoTurretBehaviour(this.playerDict, this.polygonList)
                let newProjectiles = proj.scheduleAutoTurretFiring()
                for (let projectile of newProjectiles) {

                    this.projectileList[Date.now().toString(36) + Math.random().toString(36).substring(2)] = projectile
                }
            }
            if (proj.hp > 0) {
                let newProjectiles = proj.scheduleFiring()
                for (let projectile of newProjectiles) {

                    this.projectileList[Date.now().toString(36) + Math.random().toString(36).substring(2)] = projectile
                }
            }

            if (proj.constructor.name == 'Drone') {

                if (Object.keys(this.playerDict).includes(proj.id)) {
                    proj.extras.toPos = this.playerDict[proj.id].mousePos;
                    proj.reversed = this.playerDict[proj.id].reverser;
                    proj.honing = (this.playerDict[proj.id].requestingFire || this.playerDict[proj.id].autofire);
                    proj.parentPosition = (this.playerDict[proj.id].position)
                    proj.tracker(this.polygonList, this.playerDict)
                }
            }
        }
    }

    projectileProjectileCollision(i1, proj1) {
        for (const [i2, proj2] of Object.entries(this.projectileList)) {
            if (i1 != i2 && proj1.stats.lifespan > 0 && proj2.stats.lifespan > 0) {
                if (proj1.id != proj2.id) {
                    let collided = this.collisionEngine.collisionHandler(proj1, proj2)
                } else if (proj1.constructor.name == proj2.constructor.name && proj1.constructor.name != 'Bullet') {
                    let collided = this.collisionEngine.collisionHandler(proj1, proj2)
                }
            }
        }
    }

    projectilePolyCollision(proj) {
        for (const [id, poly] of Object.entries(this.polygonList)) {
            if (poly.hp > 0 && proj.stats.lifespan > 0) {
                let collided = this.collisionEngine.collisionHandler(proj, poly)
                if (collided == true) {
                    poly.idLastHitBy = proj.id;
                    if (poly.hp <= 0) {
                        this.scoreTransfer(proj, poly)
                    }
                }
            }
        }
    }

    polyLoop() {
        for (const [id, poly] of Object.entries(this.polygonList)) {
            poly.tickCalc()
            this.immovableCollision(poly);
            this.polyPolyCollision(id, poly)
        }
    }

    polyPolyCollision(id1, poly1) {
        for (const [id2, poly2] of Object.entries(this.polygonList)) {
            if (id1 != id2 && poly1.hp > 0 && poly2.hp > 0) {
                let collided = this.collisionEngine.collisionHandler(poly1, poly2)
                if (collided == true) {
                    if (poly1.hp <= 0 || poly2.hp <= 0) {
                        this.scoreTransfer(poly1, poly2)
                    }
                }
            }
        }
    }
    restrictObjectToMapBoundaries(object) {

        if (object.position.x > this.mapSize / 2) {
            object.position.x = this.mapSize / 2 - 0.01
            object.velocity.x = 0;
        }
        if (object.position.x < - this.mapSize / 2) {
            object.position.x = -(this.mapSize / 2 - 0.01)
            object.velocity.x = 0;
        }
        if (object.position.y > this.mapSize / 2) {
            object.position.y = this.mapSize / 2 - 0.01
            object.velocity.y = 0;
        }
        if (object.position.y < - this.mapSize / 2) {
            object.position.y = -(this.mapSize / 2 - 0.01)
            object.velocity.y = 0;
        }


    }
    restrictAllObjects() {
        for (let [id, player] of Object.entries(this.playerDict)) {
            this.restrictObjectToMapBoundaries(player)
        }
        for (let [id, poly] of Object.entries(this.polygonList)) {
            this.restrictObjectToMapBoundaries(poly)
        }
        for (let [id, proj] of Object.entries(this.projectileList)) {
            this.restrictObjectToMapBoundaries(proj)
        }
    }
    cullObjects() {
        for (let [id, poly] of Object.entries(this.polygonList)) {

            if (poly.fadeTimer <= 0) {
                //console.log(poly.fadeTimer)
                this.mapSectors[this.polygonList[id].sectorId].spawnCount += -1;
                delete this.polygonList[id]
            }
        }

        for (let [id, proj] of Object.entries(this.projectileList)) {
            if (proj.fadeTimer <= 0) {
                if (proj.constructor.name == 'Drone') {
                    this.playerDict[proj.id].currentDrones += -1;
                }
                delete this.projectileList[id]

            }
        }

        for (let [id, player] of Object.entries(this.playerDict)) {
            if (player.fadeTimer <= 0) {
                let oldName = player.username;
                let hadAdmin = player.isAdmin;
                this.removePlayer(id)
                for (let id1 in this.projectileList) {
                    if (this.projectileList[id1].id == id) {
                        this.projectileList[id1].hp = 0;
                    }
                }
                this.addPlayer(id, 'random', 'random', oldName)
                this.playerDict[id].isAdmin = hadAdmin;
            }
        }
    }
    makePolyKillMessage(poly, id) {
        let prefix = 'a';
        if (poly.polygonType[0] == 'A') {
            prefix = 'an';
        }
        this.messagesToBroadcast.push({ 'id': id, 'message': `You killed ${prefix} ${poly.polygonType}` })
    }
    makePlayerKillMessage(id1, id2) {
        this.messagesToBroadcast.push({ 'id': id1, 'message': `You killed ${this.playerDict[id2].username}'s ${this.playerDict[id2].tankoidPreset}!` })
    }
    scoreTransfer(object1, object2) {

        if (object1.superType == 'player' && object2.superType == 'polygon') {
            this.addScore(object1, object2.score);
            if (object2.score >= 500) {
                this.makePolyKillMessage(object2, object1.id)
            }
        } else if (object1.superType == 'projectile' && object2.superType == 'polygon') {
            this.addScore(this.playerDict[object2.idLastHitBy], object2.score);


            if (object2.score >= 500) {
                this.makePolyKillMessage(object2, object1.id)
            }

        } else if (object1.superType == 'polygon' && object2.superType == 'polygon') {
            if (object1.hp <= 0 && object1.idLastHitBy != -1 && object1.idLastHitBy in this.playerDict) {
                this.addScore(this.playerDict[object1.idLastHitBy], object1.score);
            }
            if (object2.hp <= 0 && object2.idLastHitBy != -1 && object2.idLastHitBy in this.playerDict) {

                this.addScore(this.playerDict[object2.idLastHitBy], object2.score);
            }
        } else if (object1.superType == 'player' && object2.superType == 'player') {
            if (object2.hp <= 0) {
                this.addScore(object1, object2.score * this.constants.scoreTransfer);
                this.makePlayerKillMessage(object1.id, object2.id)
            }
            if (object1.hp <= 0) {
                this.addScore(object2, object1.score * this.constants.scoreTransfer);
                this.makePlayerKillMessage(object2.id, object1.id)
            }
        } else if (object1.superType == 'projectile' && object2.superType == 'player') {
            //this.playerDict[object1.belongsId].score += object2.score * this.constants.scoreTransfer;
            this.addScore(this.playerDict[object1.id], object2.score * this.constants.scoreTransfer)
            this.makePlayerKillMessage(object1.id, object2.id)
        }
    }
    addScore(player, scoreToAdd) {

        player.score += scoreToAdd;

        while (player.score > this.levellingInfo.scoreThresholds[player.level]) {

            if (this.levellingInfo.givesSkillPoint.includes(player.level)) {
                player.allocatablePoints += 1;
            }
            player.level += 1

        }
        if (player.tier - 1 <= this.levellingInfo.tierThresholds.length) {
            if (player.level >= this.levellingInfo.tierThresholds[player.tier - 1]) {

                let options = [];
                for (let upgrade of player.upgradesTo) {
                    // options.push({ 'name': upgrade, 'mockup': new MockupPlayer(1, upgrade) })

                    options.push({ 'name': upgrade, 'mockup': new MockupTankoid(upgrade, 2) })
                }
                this.emissions.push({ 'id': player.id, 'type': 'updateTankUpgrades', 'data': { 'options': options } })
                player.allowedUpgrade = true;

            }
        }

    }

    upgradeCull(id) {
        let player = this.playerDict[id];
        player.currentDrones = 0;

        for (let id1 in this.projectileList) {
            {
                if (this.projectileList[id1].id == id && this.projectileList[id1].constructor.name == 'Drone') {

                    delete this.projectileList[id1]
                }
            }
        }
    }

    updateLeaderboard() {
        this.lb.buildLeaderboard(this.playerDict)
    }
}