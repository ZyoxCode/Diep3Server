import { Tankoid } from "./gameobject.js";
import { readFile } from 'fs/promises';
import { Vector } from "../../utils/vectors.js";


const tankoids = JSON.parse(
    await readFile(
        new URL('../../resources/json/tankoidPresets.json', import.meta.url)
    )
)

const FORCED_AUTOSPIN_SPEED = -0.01;


export class Player extends Tankoid {
    constructor(id, x, y, r, tankoidPreset = 'Basic', upgradeCurves = {}, score = 10000, size = 4, dx = 0, dy = 0, dr = 0) {
        super(x, y, r, dx, dy, dr, tankoidPreset);


        this.mousePos = new Vector(x, y)
        this.superType = 'player';
        this.id = id;

        // UPGRADES
        this.upgradeCurves = upgradeCurves // Move to game
        this.upgradePreset = tankoidPreset;
        if (!(this.tankoidPreset in upgradeCurves)) {
            this.upgradePreset = 'default';
        }

        this.allocatablePoints = 0;
        this.skillUpgrades = {};
        this.score = score;

        for (let skill of tankoids[tankoidPreset]['Skill Upgrades']) {
            this.skillUpgrades[skill.Name] = { 'level': 0, 'color': skill.Color }
        }

        this.level = 1;
        this.allowedUpgrade = false;

        this.tier = tankoids[tankoidPreset].tier;
        this.upgradesTo = tankoids[tankoidPreset].upgradesTo;

        // HP
        this.baseMaxHp = this.stats.hp;
        this.maxHp = this.baseMaxHp;
        this.hp = this.maxHp;

        // MOVEMENT STUFF
        this.moveReq = false;
        this.moveReqAngle = 0;

        this.requestingFire = false;
        this.autofire = false;

        // SIZE
        this.size = size;

        // HITBOX
        this.hasHitBox = true;
        this.hitBoxRadius = this.size; // fix for apothem



        this.updateStatsOnUpgrade()

    }

    tick() {

        if (this.hasForcedAutoSpin == true) {
            this.rotation += FORCED_AUTOSPIN_SPEED
        }

        if (this.moveReq == true) {
            this.velocity.x += Math.cos(this.moveReqAngle) * 0.02;
            this.velocity.y += Math.sin(this.moveReqAngle) * 0.02;
        }

        this.velocity.x = this.velocity.x * 0.95
        this.velocity.y = this.velocity.y * 0.95

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y

        if (this.flashTimer > 0) {
            this.flashTimer += -1
        }

        if (this.hp == 0) {
            this.fadeTimer += -1;
        }

        this.clipProperties();
        this.updateCooldowns();

    }
}