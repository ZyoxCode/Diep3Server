import { OldGameObject } from "./gameobject.js";
import * as vectors from '../../utils/vectors.js'
//import * as shapes from '../shapes.js';

export class ImmovableObject extends OldGameObject {
    constructor(x, y, rotation, size, sides) {
        super(x, y, rotation * (Math.PI / 180));

        this.superType = 'immovable';

        this.color = 'wallGrey';
        this.size = size;
        this.sides = sides

        this.polygonType = 'immovable'

        this.fadeTimer = 20;
        this.flashTimer = 0;

        if (sides != 0) {
            //this.type = 'normalPoly';
            // this.shapes = [new shapes.EqualConvexShape([0, 0], size, rotation, type)]
            this.hitBoxRadius = vectors.getApothem(size, sides)
        } else {
            // this.shapes = [new shapes.Circle([0, 0], size, 0)]
            this.hitBoxRadius = this.size;
        }
    }
}


