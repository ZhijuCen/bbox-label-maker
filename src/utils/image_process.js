// image_process.js

const { Jimp, JimpInstance } = require('jimp');
const tf = require('@tensorflow/tfjs-node');
const ort = require('onnxruntime-web');

/**
 * 
 * @param {Uint8Array} buffer 
 */
async function padToSquareFromBuffer(buffer) {
    const img = await Jimp.read(buffer);
    const { width, height } = img.bitmap;
    const size = Math.max(width, height);

    // 创建一个新的正方形图像，背景为黑色
    const squareImg = new Jimp(size, size, 0x000000FF);

    // 将原始图像复制到新的正方形图像中
    squareImg.composite(img);

    return squareImg;
}

/**
 * 
 * @param {JimpInstance} image 
 * @param {number} width 
 * @param {number?} height
 * @returns 
 */
function resizeImage(image, w = 640, h = null) {
    return image.resize({w, h: h || w});
}

/**
 * 
 * @param {JimpInstance} image 
 * @returns 
 */
function toTFTensor(image) {
    const tensor = tf.tensor3d(image.bitmap.data, [image.bitmap.height, image.bitmap.width, 3])
    const fTensor = tensor.cast('float32').div(tf.tensor(255.0)).expandDims(0);
    return fTensor;
}

/**
 * 
 * @param {JimpInstance} image 
 * @returns 
 */
function toOrtTensor(image) {
    const tensor = new ort.Tensor('float32', image.bitmap.data, [1, 3, image.bitmap.height, image.bitmap.width])
    return tensor;
}

module.exports = { padToSquareFromBuffer, toTFTensor, toOrtTensor, resizeImage }
