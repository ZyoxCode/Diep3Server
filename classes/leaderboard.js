//import { MockupPlayer } from "./gameobjects/players.js";

export class LeaderboardEntry {
    constructor(id, name, score, tank) {
        this.id = id;
        this.name = name;
        this.score = score;
        this.tank = tank;
        //this.mockup = new MockupPlayer(0.8, tank);
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
        this.entries = []
        for (let i in players) {
            this.entries.push(new LeaderboardEntry(players[i].id, players[i].id, players[i].score, players[i].tankoidPreset)) // temporarily the id is the same as the name
        }
        this.entries.sort((a, b) => b.score - a.score);
    }
}