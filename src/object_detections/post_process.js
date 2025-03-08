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
 * @param {number} srcW 
 * @param {number} srcH 
 */
function filterBBoxOutOfBound(predictions, srcW, srcH) {
    return predictions.filter(prediction => {
        const [x, y, w, h] = prediction.bbox;
        return (
            w > 0 &&
            h > 0 &&
            x >= 0 &&
            y >= 0 &&
            x + w <= srcW &&
            y + h <= srcH
        );
    })
}

/**
 * 
 * @param {Prediction[]} predictions 
 * @param {number} srcW 
 * @param {number} srcH 
 * @returns 
 */
function rescaleBBoxFromNormalized(predictions, srcW, srcH) {
    return predictions.map(prediction => {
        const [x, y, w, h] = prediction.bbox;
        return {
            ...prediction,
            bbox: [x * srcW, y * srcH, w * srcW, h * srcH].map(Math.floor)
        }
    })
}

module.exports = {
    filterBBoxOutOfBound,
    rescaleBBoxFromNormalized
}
