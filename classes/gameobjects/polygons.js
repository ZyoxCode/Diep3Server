import { GameObject } from "./gameobject.js";
import * as shapes from '../shapes.js';
import * as vectors from '../../utils/vectors.js'
import { readFile } from 'fs/promises';


const polyPresets = JSON.parse(
    await readFile(
        new URL('../../resources/json/polygons.json', import.meta.url)
    )
);


export class Polygon extends GameObject {
    constructor(sectorId, x, y, rotation, polygonType, statSpread = {}, startDx = 0, startDy = 0, startDr = 0) {
        super(x, y, rotation * (Math.PI / 180));

        this.sectorId = sectorId;

        this.rotationalVelocity = startDr

        this.superType = 'polygon';

        this.polygonType = polygonType;

        if (Object.keys(statSpread).length == 0) {
            this.statSpread = polyPresets[polygonType].stats
        } else {
            this.statSpread = statSpread
        }

        this.maxHp = this.statSpread.maxHp;
        this.hp = this.maxHp;
        this.score = this.statSpread.score;
        this.size = this.statSpread.size;
        this.damagePerTick = this.statSpread.damagePerTick;

        this.shapes = [];
        for (let shape of polyPresets[polygonType].shapes) {
            this.shapes.push(new shapes.EqualConvexShape(...shape))
        }


        this.color = polyPresets[polygonType].color

        this.hasHitBox = true;
        if (this.shapes[0].type == 'non-circle') {
            this.hitBoxRadius = vectors.getApothem(this.shapes[0])
        } else {
            this.hitBoxRadius = this.size;
        }


        this.weightMultiplier = 1;
        this.dmg = 2;

        this.idLastHitBy = -1; // -1 means it hasnt been hit by a player

        this.flashTimer = 0;
        this.fadeTimer = 20;

    }
    tickCalc() {
        this.velocity.scalarMultiply(0.95)
        this.rotationalVelocity = this.rotationalVelocity * 0.95

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y

        this.rotation += this.rotationalVelocity

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }
        if (this.hp <= 0) {
            this.hp = 0;
        }
        if (this.hp == 0) {
            this.fadeTimer += -1
        }
    }
}