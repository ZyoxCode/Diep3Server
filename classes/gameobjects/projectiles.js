import { GameObject } from "./gameobject.js";
import * as vectors from "../../utils/vectors.js"
import { Joint } from "./joints.js";
import { AutoTurret } from "./autoturret.js";
import { readFile } from 'fs/promises';

const projectileTurrets = JSON.parse(
    await readFile(
        new URL('../../resources/json/projectileTurretPresets.json', import.meta.url)
    )
);

export class Projectile extends GameObject {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}, turretPreset) {
        super(x, y, rotation);

        this.startSpeed = startSpeed;
        this.stats = stats
        this.extraStats = extraStats
        this.rotationalVelocity = startingRV;

        this.shapeType = this.stats.shape

        this.superType = 'projectile'

        this.velocity.x = startSpeed * Math.sin(direction);
        this.velocity.y = startSpeed * Math.cos(direction);

        this.belongsId = belongsId;
        this.size = size;

        //this.shapes = makeProjectileShapes(this.size, this.stats.shape);


        if (this.stats.shape == 'circle') {
            this.hitBoxRadius = this.size
        } else {
            this.hitBoxRadius = this.size // FIX THIS LATER
            //this.hitBoxRadius = vectors.getApothem(this.shapes[0])
        }

        this.hasHitBox = true;

        this.hp = stats.hp;
        this.dmg = stats.dmg;
        this.lifespan = stats.lifespan;

        this.color = 'playerBlue';

        this.flashTimer = 0;
        this.fadeTimer = 20;


        this.joints = [];
        this.firingPoints = [];
        this.autoTurrets = [];

        //console.log(turretPreset)
        if (turretPreset != 'None') {
            console.log(projectileTurrets[turretPreset])
            for (let joint of projectileTurrets[turretPreset].joints) {
                this.joints.push(new Joint(...joint));
            }

            for (let firingPoint of projectileTurrets[turretPreset].firingInfo) {
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

            if ('autoTurrets' in projectileTurrets[turretPreset]) {
                for (let auto of projectileTurrets[turretPreset].autoTurrets) {
                    this.autoTurrets.push(new AutoTurret(auto))
                }
            }
        }

    }


    tickCalc() {

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.rotation += this.rotationalVelocity;

        if (this.lifespan > 0) {
            this.lifespan += -1
        }
        if (this.hp <= 0 && this.lifespan > 0) {
            this.lifespan = 0;
        }
        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }
        if (this.lifespan == 0) {
            this.fadeTimer += -1;
        }

        for (let point of this.firingPoints) {
            if (point.cooldown > 0) {
                point.cooldown += -1;
            }
            for (let animatedPath of point.triggersAnimationOn) {
                let path = [...animatedPath]
                //console.log(path)
                //console.log(path)
                let joint = this.joints[path[0]].propagateObject(path)

                joint.tickMyAnimation()
                //console.log(joint.distanceFromLast)
            }

        }
    }

    autoTurretBehaviourTick(players, polygons) {
        for (let auto of this.autoTurrets) {
            let path = [...auto.centerJointPath]
            let pointData = this.joints[path[0]].propagate(path, this.position, this.rotation, this.size / 5)
            path = [...auto.centerJointPath]
            let baseAngle = this.joints[path[0]].propagateObject(path).baseAngleFromLast * (Math.PI / 180)
            //console.log(baseAngle)
            // console.log(pointData[1])
            let controlJointTargetAngle = auto.targeting(pointData[0], players, polygons, pointData[1], baseAngle)




            for (let jointPath of auto.controlJointPaths) {
                let path = [...jointPath]
                let point = this.joints[path[0]].propagateObject(path)
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

    summonProjectile(firingData) {
        let path = [...firingData.jointPath]
        let pointData = this.joints[path[0]].propagate(path, this.position, this.rotation, this.size / 5)
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
            let joint = this.joints[path[0]].propagateObject(path)
            joint.animation.currentT = 0;

        }

        if (!("turretPreset" in firingData)) {
            firingData['turretPreset'] = "None";
        }

        //console.log("e", firingData.turretPreset)
        return variableProjectileType(
            firingData.behaviour,
            [
                point.x,
                point.y,
                direction + directionVar,
                direction + directionVar,
                this.belongsId,
                (firingData.speed + speedVar) * speedLambda,
                firingData.baseSize * (this.size / 5),
                {
                    'dmg': firingData.dmg,
                    'hp': firingData.hp,
                    'lifespan': firingData.lifespan,
                    'behaviour': firingData.behaviour,
                    'shape': firingData.shape,
                },
                rv,
                extraStats,
                firingData.turretPreset
            ]
        )

    }
}

export class Bullet extends Projectile {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}, turretPreset = "None") {
        super(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV, extraStats, turretPreset)
        this.weightMultiplier = 5;
    }
}

export class Trap extends Projectile {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}, turretPreset = "None") {
        super(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV, extraStats, turretPreset)
        this.weightMultiplier = 2;
    }

    tickCalc() {

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.rotation += this.rotationalVelocity;

        if (this.lifespan > 0) {
            this.lifespan += -1
        }
        if (this.hp <= 0 && this.lifespan > 0) {
            this.lifespan = 0;
        }
        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }
        if (this.lifespan == 0) {
            this.fadeTimer += -1;
        }


        if (!('deaccel' in this.stats)) {
            this.stats['deaccel'] = 0.97;
        }
        this.velocity.scalarMultiply(this.stats.deaccel)
        this.rotationalVelocity *= 0.96

        for (let point of this.firingPoints) {
            if (point.cooldown > 0) {
                point.cooldown += -1;
            }
            for (let animatedPath of point.triggersAnimationOn) {
                let path = [...animatedPath]
                //console.log(path)
                //console.log(path)
                let joint = this.joints[path[0]].propagateObject(path)

                joint.tickMyAnimation()
                //console.log(joint.distanceFromLast)
            }

        }
    }
}


export class Construct extends Projectile {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}, turretPreset = "None") {
        super(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV, extraStats, turretPreset)
        this.weightMultiplier = 2;
        this.tracking = true;
    }
    tickCalc() {

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.rotation += this.rotationalVelocity;

        if (this.lifespan > 0) {
            this.lifespan += -1
        }
        if (this.hp <= 0 && this.lifespan > 0) {
            this.lifespan = 0;
        }
        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }
        if (this.lifespan == 0) {
            this.fadeTimer += -1;
        }

        if (!('deaccel' in this.stats)) {

            this.stats['deaccel'] = 0.94;

        }

        if (this.tracking == false) {

            this.velocity.scalarMultiply(this.stats.deaccel)
            this.rotationalVelocity *= 0.96

        } else {
            let newVel = vectors.getVectorFromTo(this.extraStats.toPos, this.position)
            newVel.makeUnit()
            newVel.scalarMultiply(this.startSpeed)
            this.velocity = newVel;
        }

        if (vectors.getVectorFromTo(this.position, this.extraStats.toPos).modulus() < 20) {

            this.tracking = false;
        }

        for (let point of this.firingPoints) {
            if (point.cooldown > 0) {
                point.cooldown += -1;
            }
            for (let animatedPath of point.triggersAnimationOn) {
                let path = [...animatedPath]
                //console.log(path)
                //console.log(path)
                let joint = this.joints[path[0]].propagateObject(path)

                joint.tickMyAnimation()
                //console.log(joint.distanceFromLast)
            }

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