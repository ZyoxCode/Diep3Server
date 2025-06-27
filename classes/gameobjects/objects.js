import { roundToDecimalPlaces } from "../../utils/utils.js";
import { Vector, getVectorFromTo } from "../../utils/vectors.js";
import { AutoTurret } from "./autoturret.js";
import { Joint } from "./joints.js";
import { readFile } from 'fs/promises';

const tankoids = JSON.parse(
    await readFile(
        new URL('../../resources/json/tankoidPresets.json', import.meta.url)
    )
)

const ATTACHMENT_REF_SIZE = 5;

export class GameObject {
    constructor(x, y, r, dx, dy, dr) {

        this.position = new Vector(x, y);
        this.velocity = new Vector(dx, dy);

        this.rotation = r;
        this.rotationalVelocity = dr;

        this.joints = [];

    }
}

export class Tankoid extends GameObject { // tankoid means basically anything that could fire stuff which includes projectiles
    constructor(x, y, r, dx, dy, dr, tankoidPreset) {
        super(x, y, r, dx, dy, dr);

        this.autoTurrets = [];
        this.firingPoints = [];

        this.tankoidPreset = tankoidPreset;
        this.buildTankoid(tankoidPreset);

        // ANIMATION STUFF
        this.fadeTimer = 20;
        this.flashTimer = 0;

        this.weightMultiplier = 1;

    }

    buildTankoid(tankoidPreset) {
        this.baseStats = tankoids[tankoidPreset]['Base Stats'];
        this.baseStats['maxHp'] = this.baseStats.hp
        this.stats = {};
        this.firingOrder = tankoids[tankoidPreset]['Firing Order'];
        this.positionInFiringOrder = 0;
        this.firingPoints = [];
        this.autoTurrets = [];
        this.joints = [];

        this.tankoidPreset = tankoidPreset

        for (const [stat, value] of Object.entries(tankoids[tankoidPreset]['Base Stats'])) {
            this.stats[stat] = value;
        }

        for (let joint of tankoids[tankoidPreset]['Joints']) {
            this.joints.push(new Joint(...joint))
        }


        for (let point of tankoids[tankoidPreset]['Firing Points']) {

            let newPoint = { ...point };
            if (!('Multipliers' in newPoint)) {
                newPoint['Multipliers'] = {};
            }
            if (!('Animation Joint Paths' in newPoint)) {
                newPoint['Animation Joint Paths'] = []
            }
            if (!('Delay' in newPoint) && ('baseDelay' in newPoint)) {
                newPoint.delay = newPoint['baseDelay'];
            }

            newPoint['Base Multipliers'] = { ...newPoint['Multipliers'] }

            newPoint['cooldown'] = 0;
            this.firingPoints.push(newPoint);

        }
        //console.log(Object.keys(tankoids[tankoidPreset]))
        if (Object.keys(tankoids[tankoidPreset]).includes('Auto Turrets')) {
            for (let auto of tankoids[tankoidPreset]['Auto Turrets']) {

                this.autoTurrets.push(new AutoTurret(auto))
            }
        }


        this.dmg = this.stats.dmg;
        this.hp = this.stats.hp;

    }
    updateStatsOnUpgrade() {
        // HP

        let newMaxHp = this.upgradeCurves[this.upgradePreset]['Max Health'][this.skillUpgrades['Max Health'].level];

        this.hp = this.hp * (newMaxHp / this.stats.maxHp);
        this.stats.maxHp = newMaxHp;

        for (let firingPoint of this.firingPoints) {
            if (!('speed' in firingPoint['Multipliers'])) {
                firingPoint['Multipliers'].speed = 1
            }
            if (!('speed' in firingPoint['Base Multipliers'])) {
                firingPoint['Base Multipliers'].speed = 1
            }
            if (!('dmg' in firingPoint['Multipliers'])) {
                firingPoint['Multipliers'].dmg = 1
            }
            if (!('dmg' in firingPoint['Base Multipliers'])) {
                firingPoint['Base Multipliers'].dmg = 1
            }
            firingPoint['Multipliers'].speed = roundToDecimalPlaces(this.upgradeCurves[this.upgradePreset]['Bullet Speed'][this.skillUpgrades['Bullet Speed'].level] * firingPoint['Base Multipliers'].speed, 2)
            firingPoint['Multipliers'].dmg = roundToDecimalPlaces(this.upgradeCurves[this.upgradePreset]['Bullet Damage'][this.skillUpgrades['Bullet Damage'].level] * firingPoint['Base Multipliers'].dmg, 0)
            firingPoint.delay = roundToDecimalPlaces(firingPoint.baseDelay * this.upgradeCurves[this.upgradePreset]['Reload Speed'][this.skillUpgrades['Reload Speed'].level], 0)

        }
    }

    updateCooldowns() {
        for (let point of this.firingPoints) {
            if (point.cooldown > 0) {
                point.cooldown += -1;
            }
            for (let animatedPath of point['Animation Joint Paths']) {
                let path = [...animatedPath]
                let joint = this.joints[path[0]].propagateObject(path)
                joint.tickMyAnimation()
            }

        }
    }

    updateStandardAnimations() {
        if (this.hp == 0) {
            this.fadeTimer += -1
        }
        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }
    }

    clipProperties() {
        // if (this.hp > this.maxHp) {
        //     this.hp = this.maxHp
        // }
        if (this.hp <= 0) {
            this.hp = 0;
        }
    }

    switchPreset(newPreset) {
        if (newPreset in tankoids) {
            this.buildTankoid(newPreset);
            this.allowedUpgrade = false;
            this.updateStatsOnUpgrade()
        }
    }

    summonProjectile(firingData) {

        let path = [...firingData['Joint Path']];
        let pointData = this.joints[path[0]].propagate(path, this.position, this.rotation, this.size / ATTACHMENT_REF_SIZE);
        let point = pointData[0];
        let direction = pointData[1];


        let speedVar = (Math.random() - 0.5) * firingData['Variations']['Speed']
        let directionVar = (Math.random() - 0.5) * firingData['Variations']['Angle']

        if (!('speed' in firingData['Multipliers'])) {
            firingData['Multipliers'].speed = 1;
        }

        let dx = ((1 + speedVar) * tankoids[firingData['Summons']]['Base Stats'].speed) * firingData['Multipliers'].speed * Math.sin(direction + directionVar)
        let dy = ((1 + speedVar) * tankoids[firingData['Summons']]['Base Stats'].speed) * firingData['Multipliers'].speed * Math.cos(direction + directionVar)
        let dr = 0;

        if ('Extras' in firingData) {
            if ('Spawn RV' in firingData['Extras']) {
                dr = firingData['Extras']['Spawn RV']
            }
        }

        for (let animatedPath of firingData['Animation Joint Paths']) {
            let path = [...animatedPath]
            let joint = this.joints[path[0]].propagateObject(path)
            joint.animation.currentT = 0;

        }
        let multipliers = { ...firingData['Multipliers'] }
        if (!('size' in multipliers)) {
            multipliers.size = 1;
        }
        multipliers.size *= this.size / ATTACHMENT_REF_SIZE

        let extraStats = { 'toPos': { 'x': 0, 'y': 0 } }

        if (tankoids[firingData['Summons']]['Behaviour'] == 'construct') {
            extraStats['toPos'].x = this.mousePos.x;
            extraStats['toPos'].y = this.mousePos.y;
            // if (getVectorFromTo(extraStats.toPos, point).modulus() < 20) {
            //     speedLambda = (getVectorFromTo(extraStats.toPos, point).modulus() / 20)
            // }
        }



        return getProjectile(
            tankoids[firingData['Summons']]['Behaviour'],
            [
                this.id,
                point.x,
                point.y,
                (1 + directionVar) * direction,
                dx,
                dy,
                dr,
                firingData['Summons'],
                multipliers,
                extraStats
            ]
        )
    }

    scheduleFiring() {
        let newProjectiles = []

        if (this.firingOrder.length > 0) {
            if (this.positionInFiringOrder == this.firingOrder.length) {
                this.positionInFiringOrder = 0
            }

            if (this.firingPoints[this.firingOrder[this.positionInFiringOrder][0]].cooldown == 0) {
                let firingData;
                for (let i in this.firingOrder[this.positionInFiringOrder]) {
                    firingData = this.firingPoints[this.firingOrder[this.positionInFiringOrder][i]]
                    newProjectiles.push(this.summonProjectile(firingData))
                }

                if (this.positionInFiringOrder >= this.firingOrder.length - 1) {
                    for (let j in this.firingOrder[0]) {
                        this.firingPoints[this.firingOrder[0][j]].cooldown = firingData.delay;
                    }

                } else {
                    for (let j in this.firingOrder[this.positionInFiringOrder + 1]) {
                        this.firingPoints[this.firingOrder[this.positionInFiringOrder + 1][j]].cooldown = firingData.delay;
                    }
                }
                this.positionInFiringOrder += 1
            }
        }
        return newProjectiles
    }

    scheduleAutoTurretFiring() {
        let newProjectiles = [];
        for (let auto of this.autoTurrets) {
            if (auto.positionInFiringOrder == auto.firingOrder.length) {
                auto.positionInFiringOrder = 0
            }
            if (auto.firing) {
                if (this.firingPoints[auto.firingPointIndexes[auto.firingOrder[auto.positionInFiringOrder][0]]].cooldown == 0) {
                    let firingData;
                    for (let i in auto.firingOrder[auto.positionInFiringOrder]) {
                        firingData = this.firingPoints[auto.firingPointIndexes[auto.firingOrder[auto.positionInFiringOrder][i]]]
                        newProjectiles.push(this.summonProjectile(firingData))
                    }

                    if (auto.positionInFiringOrder >= auto.firingOrder.length - 1) {
                        for (let j in auto.firingOrder[0]) {
                            this.firingPoints[auto.firingPointIndexes[auto.firingOrder[0][j]]].cooldown = firingData.delay;
                        }

                    } else {
                        for (let j in auto.firingOrder[auto.positionInFiringOrder + 1]) {
                            this.firingPoints[auto.firingPointIndexes[auto.firingOrder[auto.positionInFiringOrder + 1][j]]].cooldown = firingData.delay;
                        }
                    }
                    auto.positionInFiringOrder += 1;
                }
            }
        }
        return newProjectiles
    }
    tickAutoTurretBehaviour(players, polygons) {
        for (let auto of this.autoTurrets) {
            let path = [...auto.centerJointPath]
            let pointData = this.joints[path[0]].propagate(path, this.position, this.rotation, this.size / ATTACHMENT_REF_SIZE)
            path = [...auto.centerJointPath]
            let baseAngle = this.joints[path[0]].propagateObject(path).baseAngleFromLast * (Math.PI / 180)
            let controlJointTargetAngle = auto.targeting(pointData[0], players, polygons, pointData[1], baseAngle)

            for (let jointPath of auto.controlJointPaths) {
                let path = [...jointPath]
                let point = this.joints[path[0]].propagateObject(path)
                point.angleFromLast = point.angleFromLast % (Math.PI * 2)
                if (point.angleFromLast <= 0) {
                    point.angleFromLast = 2 * Math.PI - point.angleFromLast;
                }

                let targetDifference;

                if (auto.withRotation) {
                    targetDifference = controlJointTargetAngle - point.angleFromLast - pointData[1]
                } else {
                    targetDifference = controlJointTargetAngle - point.angleFromLast
                }

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
}

export class Player extends Tankoid {
    constructor(id, x, y, r, tankoidPreset = 'Basic', upgradeCurves = {}, score = 10000, size = 4, dx = 0, dy = 0, dr = 0) {
        super(x, y, r, dx, dy, dr, tankoidPreset);

        this.mousePos = new Vector(x, y)
        this.superType = 'player';
        this.id = id;

        // UPGRADES
        this.upgradeCurves = upgradeCurves // Move to game
        this.upgradePreset = tankoidPreset;
        if (!(this.tankoidPreset in upgradeCurves)) {
            this.upgradePreset = 'default';
        }

        this.allocatablePoints = 0;
        this.skillUpgrades = {};
        this.score = score;

        for (let skill of tankoids[tankoidPreset]['Skill Upgrades']) {
            this.skillUpgrades[skill.Name] = { 'level': 0, 'color': skill.Color }
        }

        this.level = 1;
        this.allowedUpgrade = false;

        this.tier = tankoids[tankoidPreset].tier;
        this.upgradesTo = tankoids[tankoidPreset].upgradesTo;

        // HP
        this.baseMaxHp = this.stats.hp;
        this.maxHp = this.baseMaxHp;
        this.hp = this.maxHp;

        // MOVEMENT STUFF
        this.moveReq = false;
        this.moveReqAngle = 0;

        this.requestingFire = false;
        this.autofire = false;

        // SIZE
        this.size = size;

        // HITBOX
        this.hasHitBox = true;
        this.hitBoxRadius = this.size; // fix for apothem

        this.updateStatsOnUpgrade()
    }

    tick() {

        if (this.moveReq == true) {
            this.velocity.x += Math.cos(this.moveReqAngle) * 0.02;
            this.velocity.y += Math.sin(this.moveReqAngle) * 0.02;
        }

        this.velocity.x = this.velocity.x * 0.95
        this.velocity.y = this.velocity.y * 0.95

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }

        if (this.hp == 0) {
            this.fadeTimer += -1;
        }

        this.clipProperties();
        this.updateCooldowns();

    }
}

export class Projectile extends Tankoid {
    constructor(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers) {
        super(x, y, r, dx, dy, dr, tankoidPreset);
        this.superType = 'projectile';

        this.id = id;
        this.stats = { ...tankoids[tankoidPreset]['Base Stats'] }

        for (const [stat, multiplier] of Object.entries(inheretedMultipliers)) {

            this.stats[stat] *= multiplier
        }
        // SIZE
        this.size = this.stats.size;


        // HITBOX
        this.hasHitBox = true;
        this.hitBoxRadius = this.stats.size; // fix for apothem
        //
        this.dx
    }

    tick() {

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.rotation += this.rotationalVelocity;

        if (this.stats.lifespan > 0) {
            this.stats.lifespan += -1
        }

        if (this.hp <= 0 && this.stats.lifespan > 0) {
            this.stats.lifespan = 0;
        }

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }

        if (this.stats.lifespan == 0) {
            this.fadeTimer += -1;
        }

        this.updateCooldowns()
    }
}

export class Bullet extends Projectile {
    constructor(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers, extras = {}) {
        super(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers);
    }
}

export class Trap extends Projectile {
    constructor(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers, extras = {}) {
        super(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers);
    }
    tick() {

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.rotation += this.rotationalVelocity;

        if (this.stats.lifespan > 0) {
            this.stats.lifespan += -1
        }

        if (this.hp <= 0 && this.stats.lifespan > 0) {
            this.stats.lifespan = 0;
        }

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }

        if (this.stats.lifespan == 0) {
            this.fadeTimer += -1;
        }

        if (!('deaccel' in this.stats)) {
            this.stats['deaccel'] = 0.97;
        }

        this.velocity.scalarMultiply(this.stats.deaccel)
        this.rotationalVelocity *= 0.96

        this.updateCooldowns()
    }
}

export class Construct extends Projectile {
    constructor(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers, extras = {}) {
        super(id, x, y, r, dx, dy, dr, tankoidPreset, inheretedMultipliers);
        this.extras = extras;
        this.tracking = true;
        this.stats.speed = this.velocity.modulus();
    }

    tick() {
        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
        this.rotation += this.rotationalVelocity;

        if (this.stats.lifespan > 0) {
            this.stats.lifespan += -1
        }

        if (this.hp <= 0 && this.stats.lifespan > 0) {
            this.stats.lifespan = 0;
        }

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }

        if (this.stats.lifespan == 0) {
            this.fadeTimer += -1;
        }

        if (!('deaccel' in this.stats)) {
            this.stats['deaccel'] = 0.94;
        }

        if (this.tracking == false) {
            this.velocity.scalarMultiply(this.stats.deaccel)
            this.rotationalVelocity *= 0.96

        } else {
            let newVel = getVectorFromTo(this.extras.toPos, this.position)
            newVel.makeUnit()
            newVel.scalarMultiply(this.velocity.modulus())
            this.velocity = newVel;
        }

        if (getVectorFromTo(this.position, this.extras.toPos).modulus() < 20) {
            this.tracking = false;
        }

        this.updateCooldowns();
    }
}

function getProjectile(type, args) {
    if (type == 'bullet') {
        return new Bullet(...args);
    } else if (type == 'trap') {
        return new Trap(...args);
    } else if (type == 'construct') {
        return new Construct(...args);
    }
}