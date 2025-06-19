export function roundToDecimalPlaces(number, decimalPlaces) {
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.round(number * multiplier) / multiplier;
}

export function returnSmaller(a, b) {
    if (a <= b) {
        return a
    } else {
        return b
    }
}