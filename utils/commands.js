import { getVectorFromTo } from "./vectors.js";

export function kickHammer(Game, mousePos, sockets) {

    for (let id in Game.playerDict) {
        let distanceBetween = getVectorFromTo(mousePos, Game.playerDict[id].position).modulus()
        if (distanceBetween < Game.playerDict[id].size) {
            let username = Game.playerDict[id].username;
            sockets[id].disconnect()
            return username
        }
    }
    return false

}