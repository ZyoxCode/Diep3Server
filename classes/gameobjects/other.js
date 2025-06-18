import { GameObject } from "./gameobject.js";
import * as vectors from '../../utils/vectors.js'
import * as shapes from '../shapes.js';

export class ImmovableObject extends GameObject {
    constructor(x, y, rotation, size, type) {
        super(x, y, rotation);

        this.superType = 'immovable';

        this.color = 'wallGrey';
        this.size = size;
        this.type = type;

        if (type != 'square' && type != 'circle') {
            this.type = 'normalPoly';
            this.shapes = [new shapes.EqualConvexShape([0, 0], size, rotation, type)]
            this.hitBoxRadius = vectors.getApothem(this.shapes[0])
        }
        if (this.type == 'square') {
            this.shapes = [new shapes.EqualConvexShape([0, 0], size, 45, 4)]
            this.hitBoxRadius = vectors.getApothem(this.shapes[0])

        } else if (this.type == 'circle') {
            this.shapes = [new shapes.Circle([0, 0], size, 0)]
            this.hitBoxRadius = this.size;
        }
    }
}


