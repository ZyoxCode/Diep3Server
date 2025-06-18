import { GameObject } from "./gameobject.js";
import { Attachment } from "./attachments.js";
import { MockupAttachment } from "./attachments.js";
import { readFile } from 'fs/promises';
import { Joint } from "./joints.js";

import * as shapes from '../shapes.js';
import * as vectors from '../../utils/vectors.js'
import { Bullet } from "./projectiles.js";
import { roundToDecimalPlaces } from "../../utils/utils.js";

const tanks = JSON.parse(
    await readFile(
        new URL('../../resources/json/tanks.json', import.meta.url)
    )
);

const wireframes = JSON.parse(
    await readFile(
        new URL('../../resources/json/wireframes.json', import.meta.url)
    )
)

export class Player extends GameObject {
    constructor(x, y, rotation, id, score, startingSize, tankType = 'Basic', upgradeCurves = {}, attachmentReferenceSize) {
        super(x, y, rotation);

        this.superType = 'player'
        this.mousePos = new vectors.Vector(x, y)

        this.id = id;
        this.score = score;
        this.tankType = tankType;

        // Size shape and appearance //
        this.attachmentReferenceSize = attachmentReferenceSize;
        this.startingSize = startingSize;
        this.size = startingSize;
        //this.shapes.push(new shapes.Circle(new vectors.Vector(0, 0), this.attachmentReferenceSize, 0))

        this.flashTimer = 0;
        this.fadeTimer = 20;
        this.color = 'playerBlue';
        //-------------------------------//

        // Stats & Upgrades //
        this.upgradeCurves = upgradeCurves // Move to game
        this.upgradePreset = this.tankType;
        if (!(this.tankType in upgradeCurves)) {
            this.upgradePreset = 'default';
        }

        this.allocatablePoints = 0;
        this.upgrades = {
            'Max Health': { 'level': 0, 'color': 'playerBlue' },
            'Bullet Damage': { 'level': 0, 'color': 'squareYellow' },
            'Bullet Speed': { 'level': 0, 'color': 'pentagonBlue' },
            'Reload Speed': { 'level': 0, 'color': 'green1' },
        }; // Fix this stuff later
        this.maxHp = upgradeCurves[this.upgradePreset]['Max Health'][this.upgrades['Max Health'].level];
        this.hp = this.maxHp
        this.dmg = 3;

        this.level = 1;
        this.allowedUpgrade = false;

        this.tier = tanks[this.tankType].tier;
        this.upgradesTo = tanks[this.tankType].upgradesTo;

        //-------------------------------//

        // Movement & Actions //
        this.moveReq = false;
        this.moveReqAngle = 0;

        this.requestingFire = false;
        this.autofire = false;

        this.positionInFireOrder = 0;
        //---------------------------------//

        // Collision //

        this.hitBoxRadius = this.size
        this.hasHitBox = true;
        this.ticksSinceLastHit = 0;

        this.weightMultiplier = 1.5;

        //-------------------------------//



        this.buildTank(this.tankType)

    }
    buildTank(newType) {
        if (newType in wireframes) {
            this.tankType = newType;
            this.tier = wireframes[this.tankType].tier;
            this.upgradesTo = wireframes[this.tankType].upgradesTo;
            this.fireOrder = wireframes[this.tankType].firingOrder;
            this.firingInfo = wireframes[this.tankType].firingInfo;

            this.attachedObjects = [];
            this.positionInFireOrder = 0;

            this.firingPoints = [];

            for (let joint of wireframes[this.tankType].joints) {

                this.attachedObjects.push(new Joint(...joint))
            }

            this.upgradePreset = this.tankType;
            if (!(this.tankType in this.upgradeCurves)) {
                this.upgradePreset = 'default';
            }

            for (let firingPoint of this.firingInfo) {
                let newPoint = { ...firingPoint }
                if ('baseDelay' in newPoint) {
                    newPoint['delay'] = newPoint.baseDelay;
                }

                if ('baseDmg' in newPoint) {
                    newPoint['dmg'] = newPoint.baseDmg;
                }

                if ('baseHp' in newPoint) {
                    newPoint['hp'] = newPoint.baseHp;
                }

                if ('baseSpeed' in newPoint) {
                    newPoint['speed'] = newPoint.baseSpeed;
                }
                if ('baseLifespan' in newPoint) {
                    newPoint['lifespan'] = newPoint.baseLifespan;
                }

                newPoint['cooldown'] = 0;
                this.firingPoints.push(newPoint)

            }


            this.updateStatsOnUpgrade()
            console.log(this.firingPoints)

            return true;
        }
        else {
            return false;
        }


    }
    updateStatsOnUpgrade() {
        // HP
        let newMaxHp = this.upgradeCurves[this.upgradePreset]['Max Health'][this.upgrades['Max Health'].level];
        this.hp = this.hp * (newMaxHp / this.maxHp);
        this.maxHp = newMaxHp;

        for (let firingPoint of this.firingPoints) {

            firingPoint.speed = roundToDecimalPlaces(firingPoint.baseSpeed * this.upgradeCurves[this.upgradePreset]['Bullet Speed'][this.upgrades['Bullet Speed'].level], 2)
            firingPoint.dmg = roundToDecimalPlaces(firingPoint.baseDmg * this.upgradeCurves[this.upgradePreset]['Bullet Damage'][this.upgrades['Bullet Damage'].level], 0)
            firingPoint.delay = roundToDecimalPlaces(firingPoint.baseDelay * this.upgradeCurves[this.upgradePreset]['Reload Speed'][this.upgrades['Reload Speed'].level], 0)

        }
    }
    upgradeTank(newType) {
        this.buildTank(newType);
        this.allowedUpgrade = false;
    }
    tickCalc() {
        if (this.ticksSinceLastHit >= 500 && this.hp < this.maxHp) {
            this.hp += 0.1;
        } else {
            this.ticksSinceLastHit += 1;
        }

        for (let point of this.firingPoints) {
            if (point.cooldown > 0) {
                point.cooldown += -1;
            }
            for (let animatedPath of point.triggersAnimationOn) {
                let path = [...animatedPath]
                //console.log(path)
                //console.log(path)
                let joint = this.attachedObjects[path[0]].propagateObject(path)

                joint.tickMyAnimation()
                //console.log(joint.distanceFromLast)
            }

        }
        if (this.moveReq == true) {
            this.velocity.x += Math.cos(this.moveReqAngle) * 0.02
            this.velocity.y += Math.sin(this.moveReqAngle) * 0.02
        }

        this.velocity.x = this.velocity.x * 0.95
        this.velocity.y = this.velocity.y * 0.95

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }
        if (this.hp <= 0) {
            this.hp = 0;
        }
        if (this.hp > this.maxHp) {
            this.hp = this.maxHp
        }

        if (this.hp == 0) {
            this.fadeTimer += -1
        }

    }
    fireScheduler() {

        if (this.positionInFireOrder == this.fireOrder.length) {
            this.positionInFireOrder = 0
        }

        let newProjectiles = []

        if (this.firingPoints[this.fireOrder[this.positionInFireOrder][0]].cooldown == 0) {
            for (let i in this.fireOrder[this.positionInFireOrder]) {
                let index = this.fireOrder[this.positionInFireOrder][i]
                //console.log(this.firingPoints[this.fireOrder[this.positionInFireOrder][i]].jointPath)
                let path = [...this.firingPoints[index].jointPath]
                //console.log(path, this.position, this.rotation, this.size / this.attachmentReferenceSize)

                let pointData = this.attachedObjects[path[0]].propagate(path, this.position, this.rotation, this.size / this.attachmentReferenceSize) // add in sizemultiplier to thing
                let point = pointData[0]
                let direction = pointData[1]

                newProjectiles.push(new Bullet( // change to fit others soon
                    point.x,
                    point.y,
                    direction,
                    direction,
                    this.id,
                    this.firingPoints[index].baseSpeed,
                    this.firingPoints[index].baseSize * (this.size / this.attachmentReferenceSize),
                    {
                        'dmg': this.firingPoints[index].dmg,
                        'hp': this.firingPoints[index].hp,
                        'lifespan': this.firingPoints[index].lifespan,
                        'behaviour': this.firingPoints[index].behaviour,
                        'shape': this.firingPoints[index].shape,
                    }
                ))

                if (this.positionInFireOrder >= this.fireOrder.length - 1) {
                    for (let j in this.fireOrder[0]) {
                        this.firingPoints[this.fireOrder[0][j]].cooldown = this.firingPoints[index].delay
                    }

                } else {
                    for (let j in this.fireOrder[this.positionInFireOrder + 1]) {
                        this.firingPoints[this.fireOrder[this.positionInFireOrder + 1][j]].cooldown = this.firingPoints[index].delay
                    }
                }

                for (let animatedPath of this.firingPoints[index].triggersAnimationOn) {

                    let path = [...animatedPath]
                    //console.log(path)
                    let joint = this.attachedObjects[path[0]].propagateObject(path)
                    joint.animation.currentT = 0;

                }
            }
            this.positionInFireOrder += 1
        }
        return newProjectiles
    }
}

export class MockupPlayer extends GameObject {
    constructor(size, type) {
        super(0, 0, 0)
        this.color = 'playerBlue'
        this.size = size;
        this.type = type;

        this.shapes = []
        this.shapes.push(new shapes.Circle(new vectors.Vector(0, 0), 5, 0)) // MAGIC NUMBER ALERT

        this.attachedObjects = [];

        let preset = tanks[this.type].attachments;
        this.attachedObjects = [];

        for (let barrel of preset) {
            this.attachedObjects.push(new MockupAttachment(barrel.x, barrel.y, barrel.r, barrel.barrelStats.shapes, barrel.rendering));
        }
    }
}
