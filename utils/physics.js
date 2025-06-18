import * as vectors from './vectors.js'
import * as utils from './utils.js'

export class Collider {
    constructor() {

    }
    collisionCheck(object1, object2) {
        if (vectors.getDistance(object1.position, object2.position) < object1.hitBoxRadius + object2.hitBoxRadius) {
            return true
        } else {
            return false
        }
    }
    squareNonSquareCollision(object1, object2) { // Square Walls currently treat the player as a square fix this later

        if (
            object2.position.x - object2.hitBoxRadius < object1.position.x + object1.hitBoxRadius &&
            object2.position.x + object2.hitBoxRadius > object1.position.x - object1.hitBoxRadius &&
            object2.position.y - object2.hitBoxRadius < object1.position.y + object1.hitBoxRadius &&
            object2.position.y + object2.hitBoxRadius > object1.position.y - object1.hitBoxRadius
        ) {
            return true;
        }
        return false
    }
    collisionHandler(object1, object2) {
        if (this.collisionCheck(object1, object2) == true) {
            let transferConstant = 0.3;
            //console.log()
            if (Object.getPrototypeOf(object1.constructor).name == 'Projectile' || Object.getPrototypeOf(object2.constructor).name == 'Projectile') {
                transferConstant = 0.05;
            }

            let collisionSpeed = vectors.vectorAddition(object1.velocity, object2.velocity).modulus()

            let carryWeightRatio = (object2.size * object2.weightMultiplier) / (object1.size * object1.weightMultiplier) // Very basic carry weight calculation only based on size right npow


            let normalVector = vectors.getVectorFromTo(object1.position, object2.position)
            let normalVectorModulus = utils.roundToDecimalPlaces(normalVector.modulus(), 8)

            normalVector.scalarMultiply(1 / (normalVectorModulus + 0.0001))
            normalVector.scalarMultiply((collisionSpeed * carryWeightRatio) * transferConstant)

            object1.velocity = vectors.vectorAddition(object1.velocity, normalVector)
            object1.rotationalVelocity += (Math.random() - 0.5) * (collisionSpeed * carryWeightRatio) * 0.1

            let normalVector2 = vectors.getVectorFromTo(object2.position, object1.position)
            let normalVector2Modulus = utils.roundToDecimalPlaces(normalVector2.modulus(), 8)

            normalVector2.scalarMultiply(1 / (normalVector2Modulus + 0.0001))
            normalVector2.scalarMultiply((collisionSpeed / carryWeightRatio) * transferConstant)

            object2.velocity = vectors.vectorAddition(object2.velocity, normalVector2)
            object2.rotationalVelocity += (Math.random() - 0.5) * (collisionSpeed / carryWeightRatio) * 0.1

            if (Object.getPrototypeOf(object1.constructor).name == 'Projectile' && Object.getPrototypeOf(object2.constructor).name == 'Projectile') {
                if (object1.belongsId != object2.belongsId) {
                    object1.hp += -object2.dmg // make like a handle collision or something on the object do this instead of checking supertype
                    object2.hp += -object1.dmg
                    object1.flashTimer = 20;
                    object2.flashTimer = 20;
                }
            } else {
                object1.hp += -object2.dmg
                object2.hp += -object1.dmg
                object1.flashTimer = 20;
                object2.flashTimer = 20;
            }
            return true
        }
        return false
    }
    immovableCollision(object1, object2) {
        if ((object1.type != 'square' && this.collisionCheck(object1, object2) == true) || (object1.type == 'square' && this.squareNonSquareCollision(object1, object2) == true)) {
            let collisionSpeed = vectors.vectorAddition(object1.velocity, object2.velocity).modulus()

            let normalVector = vectors.getVectorFromTo(object2.position, object1.position)
            let normalVectorModulus = utils.roundToDecimalPlaces(normalVector.modulus(), 8)
            normalVector.scalarMultiply((1 / (normalVectorModulus + 0.0001)) * (object1.hitBoxRadius + object2.hitBoxRadius))

            if (object1.type == 'square') { // DOES NOT ACCOUNT FOR ROTATED SQUARES
                if (Math.abs(normalVector.x) > Math.abs(normalVector.y)) {

                    object2.position = vectors.vectorAddition(new vectors.Vector((object1.hitBoxRadius + object2.hitBoxRadius) * (normalVector.x / Math.abs(normalVector.x)), 0), new vectors.Vector(object1.position.x, object2.position.y))
                    object2.velocity = new vectors.Vector(0, object2.velocity.y)

                } else {

                    object2.position = vectors.vectorAddition(new vectors.Vector(0, (object1.hitBoxRadius + object2.hitBoxRadius) * (normalVector.y / Math.abs(normalVector.y))), new vectors.Vector(object2.position.x, object1.position.y))
                    object2.velocity = new vectors.Vector(object2.velocity.x, 0)
                }
                object2.rotationalVelocity += (Math.random() - 0.5) * (collisionSpeed) * 0.1
            } else {

                object2.position = vectors.vectorAddition(normalVector, object1.position)
                object2.velocity.scalarMultiply(1 - collisionSpeed * 0.2) // do this properly later with a projection to find the component of the vector that was going towards center of object
                object2.rotationalVelocity += (Math.random() - 0.5) * (collisionSpeed) * 0.1
            }

        }

    }
}


