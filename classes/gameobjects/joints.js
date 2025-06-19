import { Vector } from "../../utils/vectors.js";

function rotateVertice(vertice, pivot, angle) {
    let x = Math.cos(angle) * (vertice.x - pivot.x) + Math.sin(angle) * (vertice.y - pivot.y) + pivot.x
    let y = -Math.sin(angle) * (vertice.x - pivot.x) + Math.cos(angle) * (vertice.y - pivot.y) + pivot.y
    return new Vector(x, y)
}

export class AnimationKeyFrame {
    constructor(tOccurs, values) {
        this.tOccurs = tOccurs;
        this.valueMods = values;
    }
}

export class Animation {
    constructor(maxT, frames = [new AnimationKeyFrame(0, [1]), new AnimationKeyFrame(0.3, [0.8]), new AnimationKeyFrame(1, [1])]) {
        this.currentT = -1;
        this.maxT = maxT;
        this.frames = frames
    }
    tick(values) {
        if (this.currentT > -1) {
            if (this.currentT < this.maxT) {
                this.currentT += 1;
                return this.getFrameValues(values)

            } else {
                this.currentT = -1;
            }

        }
        return values
    }
    getFrameValues(values) {
        let percentage = this.currentT / this.maxT;
        let previousKeyFrameI = 0;

        if (this.frames[0].tOccurs < percentage) {
            while (this.frames[previousKeyFrameI].tOccurs < percentage && previousKeyFrameI < this.frames.length) {
                previousKeyFrameI++;

            }
            previousKeyFrameI += -1
        } else {
            previousKeyFrameI = 0;
        }

        let nextKeyFrame = this.frames[previousKeyFrameI + 1]
        let previousKeyFrame = this.frames[previousKeyFrameI]

        let percentThrough = ((percentage - previousKeyFrame.tOccurs) / (nextKeyFrame.tOccurs - previousKeyFrame.tOccurs))

        for (let i in values) {
            let difference = nextKeyFrame.valueMods[i] - previousKeyFrame.valueMods[i]
            values[i] = values[i] * (previousKeyFrame.valueMods[i] + difference * percentThrough)
        }

        return values
    }
}

export class Joint {
    constructor(distanceFromLast, perpendicularDistance, angleFromLast, childJoints = [], rotationBehaviour = 'inherets', animationBehaviour = {}) {
        this.distanceFromLast = distanceFromLast;
        this.baseDistanceFromLast = distanceFromLast;

        this.angleFromLast = angleFromLast * (Math.PI / 180);
        this.baseAngleFromLast = angleFromLast
        this.rotationBehaviour = rotationBehaviour
        this.perpendicularDistance = perpendicularDistance;
        this.animationBehaviour = animationBehaviour;

        this.animationMaxTimer = 20;

        if ('time' in this.animationBehaviour) {
            this.animationMaxTimer = this.animationBehaviour.time;
        }

        this.distanceToNextMultiplier = 1;

        this.animation = new Animation(this.animationMaxTimer);


        this.childJoints = [];
        for (let joint of childJoints) {

            this.childJoints.push(new Joint(...joint))
        }
    }
    recursivePos(lastCenter, lastRotation, curList) {
        let nV = new Vector(lastCenter.x + this.perpendicularDistance, lastCenter.y + this.distanceFromLast)
        let newRotation;
        if (this.rotationBehaviour == 'inherets') {
            newRotation = this.angleFromLast + lastRotation;
        } else {
            newRotation = this.angleFromLast;
        }

        let rV = rotateVertice(nV, lastCenter, newRotation); // change to Vector.rotateAround later or whatever it is
        curList.push(rV)
        for (let joint of this.childJoints) {

            joint.recursivePos(rV, newRotation, curList)
        }
    }

    propagate(path, lastCenter, lastRotation, sizeMultiplier, distanceToNextMultiplier = 1) {
        path.splice(0, 1);

        let nV = new Vector(lastCenter.x + this.perpendicularDistance * sizeMultiplier, lastCenter.y + this.distanceFromLast * sizeMultiplier * distanceToNextMultiplier)
        //console.log("NV:", nV)
        let newRotation;
        if (this.rotationBehaviour == 'inherets') {
            newRotation = (this.angleFromLast + lastRotation) % (Math.PI * 2);
        } else {
            newRotation = this.angleFromLast % (Math.PI * 2);
        }
        let rV = rotateVertice(nV, lastCenter, newRotation);

        if (path.length == 0) {
            return [rV, newRotation];
        } else {
            return this.childJoints[path[0]].propagate(path, rV, newRotation, sizeMultiplier, this.distanceToNextMultiplier)
        }
    }
    propagateObject(path) {
        path.splice(0, 1);

        if (path.length == 0) {
            return this;
        } else {
            return this.childJoints[path[0]].propagateObject(path)
        }
    }
    tickMyAnimation() {

        this.animationValues = this.animation.tick([1]) // 1 is temporary

        for (let i in this.animationBehaviour) {
            //console.log(this.animationBehaviour[i].bindsTo)
            if (this.animationBehaviour[i].bindsTo.includes('distanceMultiplier')) {
                this.distanceToNextMultiplier = this.animationValues[i]
                //console.log('triggered')
            }
        }

        //console.log(this.distanceToNextMultiplier)
    }
}
