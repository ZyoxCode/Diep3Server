import { GameObject } from "./gameobject.js";
import * as vectors from "../../utils/vectors.js"
import { Rectangle, Circle, EqualConcaveShape, EqualConvexShape } from "../shapes.js";

export class Projectile extends GameObject {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}) {
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
    }
}

export class Bullet extends Projectile {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}) {
        super(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV, extraStats)
        this.weightMultiplier = 5;
    }
}

export class Trap extends Projectile {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}) {
        super(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV, extraStats)
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
    }
}

export class Construct extends Projectile {
    constructor(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV = 0, extraStats = {}) {
        super(x, y, direction, rotation, belongsId, startSpeed, size, stats, startingRV, extraStats)
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
    }
}

function makeProjectileShapes(size, type) {

    if (type == 'circle') {
        return [new Circle([0, 0], size, 0)]
    } else if (type == 'square') {
        return [new EqualConvexShape([0, 0], size, 45, 4)]
    } else if (type == 'triangle') {
        return [new EqualConvexShape([0, 0], size, 0, 3)]
    } else if (type == 'concave-triangle') {
        return [new EqualConcaveShape([0, 0], size, 0, 3, 2.8)]
    } else if (type == 'concave-square') {
        return [new EqualConcaveShape([0, 0], size, 0, 4, 1.6)]
    }
}