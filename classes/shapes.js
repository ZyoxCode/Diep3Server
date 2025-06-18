import * as vectors from '../utils/vectors.js'


export class Shape {

    constructor(center, size, rotation, affectedByAnimation = false) {

        this.center = new vectors.Vector(center[0], center[1])
        this.size = size; // Can be in the form of an int (equal shape) or in the form {x: ?, y: ?}
        this.rotation = rotation * (Math.PI / 180); // Input as degrees
        this.vertices = []
        this.affectedByAnimation = affectedByAnimation;

    }
}

export class EqualConvexShape extends Shape {

    constructor(center, size, rotation, sides) {
        super(center, size, rotation);
        this.sides = sides;
        this.vertices = [];
        this.type = 'non-circle'


        for (let i = 0; i < sides; i++) {

            this.vertices.push(new vectors.Vector(0, this.size))
            this.vertices[i].rotateAround((2 * Math.PI / this.sides) * i)
            this.vertices[i].offset(this.center)

        }

    }
    updateShape(size) {
        this.size = size;

        this.vertices = [];

        for (let i = 0; i < this.sides; i++) {
            this.vertices.push(new vectors.Vector(0, this.size))
            this.vertices[i].rotateAround((2 * Math.PI / this.sides) * i)
            this.vertices[i].offset(this.center)
        }
    }
}

export class EqualConcaveShape extends Shape {
    constructor(center, size, rotation, sides, aspect) {
        super(center, size, rotation);
        //this.type = 'non-circle';
        this.sides = sides;
        this.vertices = [];
        this.type = 'non-circle'

        for (let i = 0; i < sides; i++) {

            this.vertices.push(new vectors.Vector(0, this.size))
            this.vertices[2 * i].rotateAround((2 * Math.PI / this.sides) * i - (2 * Math.PI / this.sides) / 2)
            this.vertices[2 * i].offset(this.center)

            this.vertices.push(new vectors.Vector(0, this.size * aspect))
            this.vertices[2 * i + 1].rotateAround((2 * Math.PI / this.sides) * i)
            this.vertices[2 * i + 1].offset(this.center)
        }

    }
}

export class Rectangle extends Shape {

    constructor(center, size, rotation, aspect = 1) { // aspect > 1 means it gets wider, aspect < 1 means it gets thinner
        super(center, size, rotation);
        this.type = 'non-circle';
        this.vertices = [];
        this.aspect = aspect

        this.vertices.push(new vectors.Vector(-size[0], -size[1]))
        this.vertices[0].rotateAround(this.rotation)
        this.vertices[0].offset(this.center)

        this.vertices.push(new vectors.Vector(size[0], -size[1]))
        this.vertices[1].rotateAround(this.rotation)
        this.vertices[1].offset(this.center)

        this.vertices.push(new vectors.Vector(size[0] * aspect, size[1]))
        this.vertices[2].rotateAround(this.rotation)
        this.vertices[2].offset(this.center)

        this.vertices.push(new vectors.Vector(-size[0] * aspect, size[1]))
        this.vertices[3].rotateAround(this.rotation)
        this.vertices[3].offset(this.center)

    }
}

export class Circle extends Shape {
    constructor(center, size, rotation) {
        super(center, size, rotation)
        this.type = 'circle';
    }
    updateShape(size) {
        this.size = size;
    }
}