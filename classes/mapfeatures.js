import { readFile } from 'fs/promises';

const sectorPresets = JSON.parse(
    await readFile(
        new URL('../resources/json/mapSpawnPresets.json', import.meta.url)
    )
);


let shapeCategories = { // MOVE THIS

    'pentagon': [
        { 'name': 'Normal Pentagon', 'spawnChance': 0.8 },
        { 'name': 'Beta Pentagon', 'spawnChance': 0.15 },
        { 'name': 'Alpha Pentagon', 'spawnChance': 0.05 },
    ],
    'square': [
        { 'name': 'Normal Square', 'spawnChance': 0.8 },
        { 'name': 'Beta Square', 'spawnChance': 0.15 },
        { 'name': 'Alpha Square', 'spawnChance': 0.05 },
    ],
    'triangle': [
        { 'name': 'Normal Triangle', 'spawnChance': 0.8 },
        { 'name': 'Beta Triangle', 'spawnChance': 0.15 },
        { 'name': 'Alpha Triangle', 'spawnChance': 0.05 },
    ],
    'hexagon': [
        { 'name': 'Normal Hexagon', 'spawnChance': 1 },
    ]

}

export class MapSector { // fix spawn algorithm later
    constructor(x, y, size, preset, spawnRate, shapeCapacity) {

        this.x = x;
        this.y = y;
        this.size = size;

        this.shapeSpawnMultipliers = sectorPresets[preset]
        this.shapeCapacity = shapeCapacity;
        this.spawnChance = spawnRate;
        this.spawnCount = 0;

    }

    spawnTick() {
        let willSpawnSeed = Math.random();
        if (willSpawnSeed < this.spawnChance && this.spawnCount < this.shapeCapacity) {
            let spawnX = this.x + this.size * Math.random()
            let spawnY = this.y + this.size * Math.random()
            let spawnRotation = 360 * Math.random()
            let spawnDr = (Math.random() - 0.5) * 0.5

            let spawnTypeSeed = Math.random()
            let shapeType;
            let cumulativeChance = 0;
            for (let entry of this.shapeSpawnMultipliers) {
                if (spawnTypeSeed < cumulativeChance + entry.spawnChance) {
                    shapeType = entry.name;
                    break;
                }
                cumulativeChance += entry.spawnChance;
            }

            let subTypeSeed = Math.random();
            let shapeSubType;
            cumulativeChance = 0;

            for (let entry of shapeCategories[shapeType]) {
                if (subTypeSeed < cumulativeChance + entry.spawnChance) {
                    shapeSubType = entry.name;
                    break;
                }
                cumulativeChance += entry.spawnChance;
            }


            this.spawnCount += 1;

            return [spawnX, spawnY, spawnRotation, shapeSubType, {}, 0, 0, spawnDr]
            //polygons.push(new classes.Polygon(this.id, spawnX, spawnY, spawnRotation, shapeSubType, {}, 0, 0, spawnDr))
            // if we move the actual spawning outside of this object we wont have to have the unnecessary sector.id stuff plus we wont need to pass the polygons list
        }
        return 'None';
    }
}