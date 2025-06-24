import { GameObject } from "./gameobject.js";
//import { MockupAttachment } from "./attachments.js";
import { readFile } from 'fs/promises';
import { Joint } from "./joints.js";


//import * as shapes from '../shapes.js';
import * as vectors from '../../utils/vectors.js'
import { Bullet, Trap, Construct } from "./projectiles.js";
import { roundToDecimalPlaces } from "../../utils/utils.js";
import { AutoTurret } from "./autoturret.js";

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
            this.autoTurrets = [];

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

            if ('autoTurrets' in wireframes[this.tankType]) {
                for (let auto of wireframes[this.tankType].autoTurrets) {
                    this.autoTurrets.push(new AutoTurret(auto))
                }
            }


            this.updateStatsOnUpgrade()

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
    summonProjectile(firingData) {
        let path = [...firingData.jointPath]
        let pointData = this.attachedObjects[path[0]].propagate(path, this.position, this.rotation, this.size / this.attachmentReferenceSize)
        let point = pointData[0]
        let direction = pointData[1]
        let speedVar = (Math.random() - 0.5) * firingData.speedVar
        let directionVar = (Math.random() - 0.5) * firingData.spread
        let rv = 0;
        if (Object.keys(firingData).includes('spawnRV')) {
            rv = firingData.spawnRV
        }


        let extraStats = { 'toPos': { 'x': 0, 'y': 0 } }
        let speedLambda = 1;

        if (firingData.behaviour == 'construct') {
            extraStats['toPos'].x = this.mousePos.x;
            extraStats['toPos'].y = this.mousePos.y;
            if (vectors.getVectorFromTo(extraStats.toPos, point).modulus() < 20) {
                speedLambda = (vectors.getVectorFromTo(extraStats.toPos, point).modulus() / 20)
            }
        }

        let recoilVector = new vectors.Vector(0, 1)
        if (Object.keys(firingData).includes('recoilMultiplier')) {
            recoilVector.scalarMultiply(firingData.recoilMultiplier)
        }

        recoilVector.rotateAround((-direction + directionVar) + Math.PI)

        recoilVector.scalarMultiply((firingData.baseSpeed + speedVar) * 0.1)
        this.velocity = vectors.vectorAddition(this.velocity, recoilVector)


        for (let animatedPath of firingData.triggersAnimationOn) {

            let path = [...animatedPath]
            //console.log(path)
            let joint = this.attachedObjects[path[0]].propagateObject(path)
            joint.animation.currentT = 0;

        }

        return variableProjectileType(
            firingData.behaviour,
            [
                point.x,
                point.y,
                direction + directionVar,
                direction + directionVar,
                this.id,
                (firingData.speed + speedVar) * speedLambda,
                firingData.baseSize * (this.size / this.attachmentReferenceSize),
                {
                    'dmg': firingData.dmg,
                    'hp': firingData.hp,
                    'lifespan': firingData.lifespan,
                    'behaviour': firingData.behaviour,
                    'shape': firingData.shape,
                },
                rv,
                extraStats
            ]
        )

    }
    autoTurretBehaviourTick(players, polygons) {
        for (let auto of this.autoTurrets) {
            let path = [...auto.centerJointPath]
            let pointData = this.attachedObjects[path[0]].propagate(path, this.position, this.rotation, this.size / this.attachmentReferenceSize)
            path = [...auto.centerJointPath]
            let baseAngle = this.attachedObjects[path[0]].propagateObject(path).baseAngleFromLast * (Math.PI / 180)
            //console.log(baseAngle)
            // console.log(pointData[1])
            let controlJointTargetAngle = auto.targeting(pointData[0], players, polygons, pointData[1], baseAngle)




            for (let jointPath of auto.controlJointPaths) {
                let path = [...jointPath]
                let point = this.attachedObjects[path[0]].propagateObject(path)
                point.angleFromLast = point.angleFromLast % (Math.PI * 2)
                if (point.angleFromLast <= 0) {
                    point.angleFromLast = 2 * Math.PI - point.angleFromLast;
                }

                let targetDifference;
                //console.log(controlJointTargetAngle)

                if (auto.withRotation) {
                    targetDifference = controlJointTargetAngle - point.angleFromLast - pointData[1]
                } else {
                    targetDifference = controlJointTargetAngle - point.angleFromLast
                }

                //console.log(targetDifference)

                if (targetDifference >= Math.PI) {
                    targetDifference = -2 * Math.PI + targetDifference

                } else if (targetDifference <= -Math.PI) {
                    targetDifference = 2 * Math.PI + targetDifference

                }





                auto.dr = auto.maxDr * Math.tanh(targetDifference / auto.movementDivision);
                point.angleFromLast += auto.dr

            }
        }
    }
    autoTurretFireScheduler() {


        let newProjectiles = [];
        for (let auto of this.autoTurrets) {
            if (auto.positionInFireOrder == auto.fireOrder.length) {
                auto.positionInFireOrder = 0
            }
            if (auto.firing) {
                if (this.firingPoints[auto.firingPointIndexes[auto.fireOrder[auto.positionInFireOrder][0]]].cooldown == 0) {
                    let firingData;
                    for (let i in auto.fireOrder[auto.positionInFireOrder]) {
                        firingData = this.firingPoints[auto.firingPointIndexes[auto.fireOrder[auto.positionInFireOrder][i]]]
                        newProjectiles.push(this.summonProjectile(firingData))
                    }


                    if (auto.positionInFireOrder >= auto.fireOrder.length - 1) {
                        for (let j in auto.fireOrder[0]) {
                            this.firingPoints[auto.firingPointIndexes[auto.fireOrder[0][j]]].cooldown = firingData.delay;
                        }

                    } else {
                        for (let j in auto.fireOrder[auto.positionInFireOrder + 1]) {
                            this.firingPoints[auto.firingPointIndexes[auto.fireOrder[auto.positionInFireOrder + 1][j]]].cooldown = firingData.delay;
                        }
                    }
                    auto.positionInFireOrder += 1;
                }
            }


        }
        return newProjectiles
    }

    fireScheduler() {
        let newProjectiles = []
        if (this.fireOrder.length > 0) {
            if (this.positionInFireOrder == this.fireOrder.length) {
                this.positionInFireOrder = 0
            }

            if (this.firingPoints[this.fireOrder[this.positionInFireOrder][0]].cooldown == 0) {
                let firingData;
                for (let i in this.fireOrder[this.positionInFireOrder]) {
                    firingData = this.firingPoints[this.fireOrder[this.positionInFireOrder][i]]
                    newProjectiles.push(this.summonProjectile(firingData))
                }

                if (this.positionInFireOrder >= this.fireOrder.length - 1) {
                    for (let j in this.fireOrder[0]) {
                        this.firingPoints[this.fireOrder[0][j]].cooldown = firingData.delay;
                    }

                } else {
                    for (let j in this.fireOrder[this.positionInFireOrder + 1]) {
                        this.firingPoints[this.fireOrder[this.positionInFireOrder + 1][j]].cooldown = firingData.delay;
                    }
                }
                this.positionInFireOrder += 1
            }
        }
        return newProjectiles
    }

}

// export class MockupPlayer extends GameObject {
//     constructor(size, type) {
//         super(0, 0, 0)
//         this.color = 'playerBlue'
//         this.size = size;
//         this.type = type;

//         this.shapes = []
//         this.shapes.push(new shapes.Circle(new vectors.Vector(0, 0), 5, 0)) // MAGIC NUMBER ALERT

//         this.attachedObjects = [];

//         let preset = tanks[this.type].attachments;
//         this.attachedObjects = [];

//         for (let barrel of preset) {
//             this.attachedObjects.push(new MockupAttachment(barrel.x, barrel.y, barrel.r, barrel.barrelStats.shapes, barrel.rendering));
//         }
//     }
// }


function variableProjectileType(type, args) {
    if (type == 'bullet') {
        return new Bullet(...args);
    } else if (type == 'trap') {
        return new Trap(...args);
    } else if (type == 'construct') {
        return new Construct(...args);
    }
}
