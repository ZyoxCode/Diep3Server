import * as utils from './utils.js'

export class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    modulus() {
        return Math.sqrt((this.x) ** 2 + (this.y) ** 2)
    }
    rotateAround(angle) {
        let modulus = this.modulus()
        let currentAngle = Math.atan2(this.y, this.x)
        this.x = utils.roundToDecimalPlaces(modulus * Math.cos(angle + currentAngle), 8)
        this.y = utils.roundToDecimalPlaces(modulus * Math.sin(angle + currentAngle), 8)

    }
    offset(offset) {
        this.x = this.x + offset.x
        this.y = this.y + offset.y
    }
    getAngle() {
        return Math.atan2(this.y, this.x)
    }
    scalarMultiply(scalar) {
        this.x = this.x * scalar
        this.y = this.y * scalar
    }
    makeUnit() {
        let modulus = this.modulus();
        this.x = this.x / modulus;
        this.y = this.y / modulus;
    }
}

export function getApothem(R, n) {
    return R * Math.cos(Math.PI / n)
}

export function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y
}

export function unitVector(v) {
    m = v.modulus()
    return new Vector((1 / m) * v.x, (1 / m) * v.y)
}

export function vectorAddition(a, b) {
    return new Vector(a.x + b.x, a.y + b.y)
}

export function rotateVertice(vertice, pivot, angle) {
    let x = Math.cos(angle) * (vertice.x - pivot.y) + Math.sin(angle) * (vertice.y - pivot.y) + pivot.y
    let y = -Math.sin(angle) * (vertice.x - pivot.y) + Math.cos(angle) * (vertice.y - pivot.y) + pivot.y
    return new Vector(x, y)
}

export function rotateVertices(vertices, pivot, angle) {
    for (let i in vertices) {
        vertices[i] = rotateVertice(vertices[i], pivot, angle)
    }
    return vertices
}

export function getDistance(point1, point2) {
    let xDistance = point1.x - point2.x
    let yDistance = point1.y - point2.y
    return Math.sqrt((xDistance ** 2) + (yDistance ** 2))
}

export function getVectorFromTo(point1, point2) {
    let xDistance = point1.x - point2.x
    let yDistance = point1.y - point2.y
    return new Vector(xDistance, yDistance)
}