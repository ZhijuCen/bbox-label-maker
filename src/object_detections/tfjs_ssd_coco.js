// tfjs_ssd_coco.js

const tf = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const { preprocessFromBuffer } = require('./pre_process');
const { rescaleBBoxFromGain, filterBBoxOutOfBound } = require('./post_process');

/**
 * TfSSDCoco class for COCO-SSD model using TensorFlow.js
 */
class TfSSDCoco {
    constructor() {
        this.model = null;
        this.inputSize = 300; // COCO-SSD 默认输入尺寸
    }

    /**
     * 初始化模型
     */
    async init() {
        this.model = await cocoSsd.load();
        return this;
    }

    /**
     * 预测函数
     * @param {Uint8Array} buffer - 图像数据
     * @param {number} srcW - 原始图像宽度
     * @param {number} srcH - 原始图像高度
     * @returns {Promise<object[]>} - 返回检测结果
     */
    async predict(buffer) {
        if (!this.model) {
            throw new Error("Model is not initialized. Call init() first.");
        }

        // 1. 预处理图像
        const { tensor, gain } = await this.preprocess(buffer);

        // 2. 运行推理
        const predictions = await this.model.detect(tensor);

        // 3. 后处理输出
        const results = this.postprocess(predictions, gain);

        return results;
    }

    /**
     * 预处理图像
     * @param {Uint8Array} buffer - 图像数据
     * @returns {ort.Tensor, Gain} - 返回 预处理后的张量 以及 缩放参数
     */
    async preprocess(buffer) {
        const { imgArrayData, gain } = await preprocessFromBuffer(buffer, this.inputSize, false, false, '#000000');

        // 转换为 Tensor
        const tensor = tf.tensor3d(imgArrayData, [this.inputSize, this.inputSize, 3], 'int32');

        return { tensor, gain };
    }

    /**
     * 后处理输出
     * @param {object[]} predictions - 模型输出
     * @param {Gain} gain - 缩放参数
     * @returns {object[]} - 返回标准化的检测结果
     */
    postprocess(predictions, gain) {

        predictions = predictions.map(prediction => {
            const [x, y, w, h] = prediction.bbox;
            return {
                bbox: [x - gain.left, y - gain.top, w, h],
                class: prediction.class,
                score: prediction.score
        }});

        // 应用尺度变换
        const scaledPredictions = rescaleBBoxFromGain(predictions, gain);

        // 过滤超出边界的框
        return filterBBoxOutOfBound(scaledPredictions, gain.wSrc, gain.hSrc);
    }
}

module.exports = {
    TfSSDCoco
};
