import { MockupTankoid } from "./gameobjects/gameobject.js";

export class LeaderboardEntry {
    constructor(name, score, tank, rank) {
        this.rank = rank;
        this.name = name;
        this.score = score;
        this.tank = tank;
        this.mockup = new MockupTankoid(tank, 0.6)
    }
}
export class Leaderboard {
    constructor(topN, entryMaxWidth, entryMaxHeight) {
        this.topN = topN
        this.entryMaxWidth = entryMaxWidth;
        this.entryMaxHeight = entryMaxHeight;
        this.entries = []
    }
    buildLeaderboard(players) {
        this.scoreToId = []
        for (let id in players) {
            this.scoreToId.push({ 'id': id, 'score': players[id].score })
        }
        this.scoreToId.sort((a, b) => b.score - a.score);
        this.entries = {}
        for (let i in this.scoreToId) {
            this.entries[this.scoreToId[i].id] = new LeaderboardEntry(players[this.scoreToId[i].id].username, players[this.scoreToId[i].id].score, players[this.scoreToId[i].id].tankoidPreset, parseInt(i))
        }

    }
}