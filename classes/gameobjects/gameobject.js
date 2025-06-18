import * as utils from '../../utils/utils.js'
import * as vectors from '../../utils/vectors.js'
import * as physics from '../../utils/physics.js'
import * as shapes from '../shapes.js'







export class GameObject {
    constructor(x, y, rotation) {

        this.position = new vectors.Vector(x, y)
        this.rotation = rotation

        this.velocity = new vectors.Vector(0, 0)
        this.rotationalVelocity = 0;
        this.hasHitBox = false;

        this.shapes = []
        this.attachedObjects = [];

        this.hasAnimationTimer = false;

    }
}
