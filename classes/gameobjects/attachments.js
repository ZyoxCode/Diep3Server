import { GameObject } from "./gameobject.js";
import { Bullet, Trap, Construct } from "./projectiles.js";
import { roundToDecimalPlaces } from "../../utils/utils.js";
import { Rectangle, Circle, EqualConcaveShape, EqualConvexShape } from "../shapes.js";
//import { Joint } from "./joints.js";
import * as vectors from '../../utils/vectors.js'

export class Attachment extends GameObject { // X, Y, Rotation is relative to parent object
    constructor(x, y, rotation, barrelStats, spawnStats, rendering) {// x, y, rotation, attachmentType, summonStats, animationTime, renderBeforePlayer = true
        super(x, y, rotation * (Math.PI / 180));

        this.superType = 'attachment'; // probably isnt necessary

        this.attachmentType = barrelStats.type;
        this.spread = barrelStats.spread;

        this.spawnStats = spawnStats;
        this.baseSpawnStats = { ...spawnStats }

        this.facingRotation = 0; // For turrets

        if ('beforePlayer' in rendering) {
            this.renderBeforePlayer = rendering.beforePlayer;
        } else {
            this.renderBeforePlayer = true;
        }

        if ('color' in rendering) {
            this.color = rendering.color;
        } else {
            this.color = 'barrelGrey'
        }

        if ('animationTime' in rendering) {
            this.hasAnimationTimer = true;
            this.maxAnimationTimer = rendering.animationTime;
            this.animationTimer = 0;
        } else {
            this.hasAnimationTimer = false;
        }

        if (!('speedVar' in barrelStats)) {
            barrelStats['speedVar'] = 0;
        }
        if (!('spread' in barrelStats)) {
            barrelStats['spread'] = 0;
        }
        if (!('startingRotation' in barrelStats)) {
            barrelStats['startingRotation'] = 0;
        }
        if (!('spawnRV' in barrelStats)) {
            barrelStats['spawnRV'] = 0;
        }

        this.barrelStats = barrelStats;
        this.baseBarrelStats = { ...this.barrelStats }

        this.baseMaxCooldown = barrelStats.fireDelay;
        this.maxCooldown = barrelStats.fireDelay;
        this.cooldown = 0;

        this.shapes = []
        for (let shape of this.barrelStats.shapes) {

            this.shapes.push(getBarrelShapes(shape));
        }
    }
    updateMyStats(newStats) {

        if ('speed' in newStats) {
            this.barrelStats.spawnStartSpeed = this.baseBarrelStats.spawnStartSpeed * newStats.speed;
        }
        if ('lifespan' in newStats) {
            this.spawnStats.lifespan = this.baseSpawnStats.lifespan * newStats.lifespan;
        }
        if ('dmg' in newStats) {
            this.spawnStats.dmg = this.baseSpawnStats.dmg * newStats.dmg;
        }
        if ('hp' in newStats) {
            this.spawnStats.hp = this.baseSpawnStats.hp * newStats.hp;
        }
        if ('reload' in newStats) {

            this.barrelStats.fireDelay = roundToDecimalPlaces(this.baseMaxCooldown * newStats.reload, 0);
            this.maxCooldown = roundToDecimalPlaces(this.baseMaxCooldown * newStats.reload, 0);

        }
    }
    tickCalc() {

        if (this.cooldown > 0) {
            this.cooldown += -1
        } else if (this.cooldown > this.maxCooldown) {
            this.cooldown = this.maxCooldown;
        }

        if (this.hasAnimationTimer == true) {
            if (this.animationTimer > 0 && this.animationTimer < this.maxAnimationTimer) {
                this.animationTimer += 1;
            }

            if (this.animationTimer >= this.maxAnimationTimer) {
                this.animationTimer = 0;
            }
        }
    }
    createProjectile(player) { // currently will only account for 1 level of attachment

        if (this.hasAnimationTimer == true) {
            this.animationTimer = 1;
        }

        let rotatable = new vectors.Vector((this.position.x + this.barrelStats.spawnOffset.x) * (player.size / player.attachmentReferenceSize), (this.position.y + this.barrelStats.spawnOffset.y) * (player.size / player.attachmentReferenceSize))
        rotatable.rotateAround(-player.rotation - this.rotation)

        let rotatedAttachmentCenter = vectors.vectorAddition(rotatable, player.position)
        // rotatedAttachmentCenter.scalarMultiply(player.size / player.attachmentReferenceSize)

        let extraStats = { 'toPos': { 'x': 0, 'y': 0 } }
        let speedLambda = 1;
        if (this.spawnStats.behaviour == 'construct') {
            extraStats['toPos'].x = player.mousePos.x;
            extraStats['toPos'].y = player.mousePos.y;
            if (vectors.getVectorFromTo(extraStats.toPos, rotatedAttachmentCenter).modulus() < 20) {
                speedLambda = (vectors.getVectorFromTo(extraStats.toPos, rotatedAttachmentCenter).modulus() / 20)
            }
        }
        let recoil = new vectors.Vector(0, 1)
        recoil.rotateAround(-player.rotation - this.rotation + Math.PI)
        recoil.makeUnit()
        recoil.scalarMultiply((this.barrelStats.spawnStartSpeed + (Math.random() - 0.5) * this.barrelStats.speedVar) * speedLambda * 0.05)
        player.velocity = vectors.vectorAddition(recoil, player.velocity)

        return variableProjectileType(
            this.spawnStats.behaviour,
            [
                rotatedAttachmentCenter.x,
                rotatedAttachmentCenter.y,
                player.rotation + this.rotation + (Math.random() - 0.5) * this.spread,
                this.barrelStats.startingRotation + player.rotation + this.rotation,
                player.id,
                (this.barrelStats.spawnStartSpeed + (Math.random() - 0.5) * this.barrelStats.speedVar) * speedLambda,
                this.barrelStats.spawnBaseSize * (player.size / player.attachmentReferenceSize),
                this.spawnStats,
                this.barrelStats.spawnRV,
                extraStats,
            ]
        )
    }
}

export class MockupAttachment extends GameObject {
    constructor(x, y, r, shapes, rendering) {
        super(x, y, r * (Math.PI / 180))

        this.rendering = rendering
        this.shapes = [];
        this.facingRotation = 0;

        if ('beforePlayer' in rendering) {
            this.renderBeforePlayer = rendering.beforePlayer;
        } else {
            this.renderBeforePlayer = true;
        }

        if ('color' in rendering) {
            this.color = rendering.color;
        } else {
            this.color = 'barrelGrey'
        }

        for (let shape of shapes) {
            this.shapes.push(getBarrelShapes(shape))
        }
    }
}

function variableProjectileType(type, args) {
    if (type == 'bullet') {
        return new Bullet(...args);
    } else if (type == 'trap') {
        return new Trap(...args);
    } else if (type == 'construct') {
        return new Construct(...args);
    }
}


function getBarrelShapes(shapeInfo) {
    if (!('offset' in shapeInfo)) {
        shapeInfo['offset'] = { 'x': 0, 'y': 0 };
    }
    if (shapeInfo.type == 'rect') {
        return new Rectangle([shapeInfo.offset.x, shapeInfo.size.y + shapeInfo.offset.y], [shapeInfo.size.x, shapeInfo.size.y], shapeInfo.rotation, shapeInfo.aspect)
    } else if (shapeInfo.type == 'circle') {
        return new Circle([shapeInfo.offset.x, shapeInfo.offset.y], shapeInfo.size, shapeInfo.rotation)
    }
}

// class Attachment extends Joint {

// }
