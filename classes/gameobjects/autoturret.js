import { getDistance, getVectorFromTo } from "../../utils/vectors.js";

export class AutoTurret {
    constructor(args) {
        this.centerJointPath = args.centerJointPath;
        this.controlJointPaths = args.controlJointPaths;
        this.firingPointIndexes = args.firingPointIndexes;
        this.fireOrder = args.firingOrder;
        this.restrictAngle = -1;
        this.withRotation = false;

        if ('restrictAngle' in args) {
            this.restrictAngle = args.restrictAngle * (Math.PI / 180)
        }

        if ('withRotation' in args) {
            this.withRotation = args.withRotation
        }

        this.baseTargetingRange = args.baseTargetingRange;

        this.positionInFireOrder = 0;
        this.firing = true;

        this.dr = 0;
        this.movementDivision = 10;
        this.maxDr = 1.3;
    }
    targeting(centerPos, players, polygons, facing, baseRotation) {
        let targetingVector = 'None';
        let lowestDistance = this.baseTargetingRange
        for (let poly of polygons) {
            //console.log(poly.position, centerPos)
            let vectorTo = getVectorFromTo(centerPos, poly.position)
            //console.log(lowestDistance)

            if (vectorTo.modulus() < lowestDistance) {
                if (this.restrictAngle != -1) {


                    if (facing >= Math.PI) {
                        facing = -2 * Math.PI + facing
                    } else if (facing <= -Math.PI) {
                        facing = 2 * Math.PI + facing
                    }

                    let tGContribution = -vectorTo.getAngle() - Math.PI / 2

                    if (tGContribution >= Math.PI) {
                        tGContribution = -2 * Math.PI + tGContribution
                    } else if (tGContribution <= -Math.PI) {
                        tGContribution = 2 * Math.PI + tGContribution
                    }
                    let targetDifference = tGContribution - facing
                    // if (baseAngle == 0) {
                    //     
                    // }



                    if (targetDifference >= Math.PI) {
                        targetDifference = -2 * Math.PI + targetDifference
                    } else if (targetDifference <= -Math.PI) {
                        targetDifference = 2 * Math.PI + targetDifference
                    }
                    if (Math.abs(targetDifference) <= this.restrictAngle) {
                        targetingVector = vectorTo
                        lowestDistance = vectorTo.modulus()
                    }
                } else {
                    targetingVector = vectorTo
                    lowestDistance = vectorTo.modulus()
                }
            }
        }
        if (targetingVector == 'None') {
            this.firing = false;

            return facing;


        } else {
            this.firing = true;
            return (-targetingVector.getAngle() - Math.PI / 2)
        }
    }
}