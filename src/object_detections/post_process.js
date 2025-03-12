// post_process.js


/**
 * @typedef {Object} Prediction
 * @property {Array<number>} bbox
 * @property {string} class
 * @property {number} score
 */

/**
 * 
 * @param {Prediction[]} predictions
 * @param {number} wSrc 
 * @param {number} hSrc 
 */
function filterBBoxOutOfBound(predictions, wSrc, hSrc) {
    return predictions.filter(prediction => {
        const [x, y, w, h] = prediction.bbox;
        return (
            w > 0 &&
            h > 0 &&
            x >= 0 &&
            y >= 0 &&
            x + w <= wSrc &&
            y + h <= hSrc
        );
    })
}

/**
 * 
 * @param {Prediction[]} predictions 
 * @param {Gain} gain
 * @returns 
 */
function rescaleBBoxFromGain(predictions, gain) {
    return predictions.map(prediction => {
        const [x, y, w, h] = prediction.bbox;
        return {
            ...prediction,
            bbox: [x / gain.r, y / gain.r, w / gain.r, h / gain.r].map(Math.floor)
        }
    })
}

module.exports = {
    filterBBoxOutOfBound,
    rescaleBBoxFromGain
}
