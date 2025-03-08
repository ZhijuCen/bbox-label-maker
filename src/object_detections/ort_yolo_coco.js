// ort_yolo_coco.js

const ort = require('onnxruntime-web');
const { Jimp, BlendMode } = require('jimp');
const ndarray = require('ndarray');

/**
 * @typedef {Object} Prediction
 * @property {number[]} bbox - 边界框坐标 [x, y, w, h]
 * @property {string} class - 类别名称
 * @property {number} score - 置信度
 */

/**
 * @typedef {Object} Gain
 * @property {number} r - 缩放比例
 * @property {number} dw - 填充宽度
 * @property {number} dh - 填充高度
 * @property {number} top - 填充高度
 * @property {number} left - 填充宽度
 */

/**
 * YOLO-COCO
 */
class OrtYoloCoco {
    constructor(modelPath) {
        this.modelPath = modelPath;
        this.session = null;
        this.inputSize = 640; // 输入图像尺寸
        this.classNames = [
            "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
            "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
            "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
            "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
            "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
            "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
            "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
            "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
            "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
            "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
        ];
    }

    /**
     * 初始化模型
     */
    async init() {
        this.session = await ort.InferenceSession.create(this.modelPath);
        return this;
    }

    /**
     * 预测函数
     * @param {Uint8Array} buffer - 图像数据
     * @returns {Promise<object[]>} - 返回检测结果
     */
    async predict(buffer) {
        if (!this.session) {
            throw new Error("Model session is not initialized. Call init() first.");
        }

        // 1. 预处理图像
        const {tensor, gain} = await this.preprocess(buffer);

        // 2. 运行推理
        const outputs = await this.session.run({ 'images': tensor });

        // 3. 后处理输出
        const results = this.postprocess(outputs, gain);

        return results;
    }

    /**
     * 预处理图像
     * @param {Uint8Array} buffer - 图像数据
     * @returns {ort.Tensor, Gain} - 返回 预处理后的张量 以及 缩放参数
     */
    async preprocess(buffer) {
        const img = await Jimp.read(buffer);
        const [wSrc, hSrc] = [img.bitmap.width, img.bitmap.height];
        const newShape = this.inputSize;


        // 1. 计算缩放比例（关键修改）
        const r = Math.min(newShape / hSrc, newShape / wSrc);
        const newUnpad = {
            width: Math.round(wSrc * r),
            height: Math.round(hSrc * r)
        };

        // 2. 计算填充量（关键修改）
        const dw = newShape - newUnpad.width;
        const dh = newShape - newUnpad.height;
        const top = Math.round(dh / 2);
        const bottom = dh - top;
        const left = Math.round(dw / 2);
        const right = dw - left;
        const gain = { r, dw, dh, top, left };

        // 3. 缩放图像到未填充尺寸（关键修改）
        const scaledImg = img.resize({w: newUnpad.width, h: newUnpad.height});

        // 4. 创建填充画布（关键修改）
        const paddedImg = new Jimp({
            width: newShape,
            height: newShape,
            color: '#727272' // 114,114,114 背景色
        });

        // 5. 将缩放后的图像居中放置（关键修改）
        paddedImg.composite(
            scaledImg,
            left,
            top,
            {
                mode: BlendMode.SRC_OVER,
                opacitySource: 1,
                opacityDest: 0
            }
        );

        const flattenArray = [];
        for (let i = 0; i < paddedImg.bitmap.data.length; i += 4) {
            const r = paddedImg.bitmap.data[i];
            const g = paddedImg.bitmap.data[i + 1];
            const b = paddedImg.bitmap.data[i + 2];
            const a = paddedImg.bitmap.data[i + 3];
            flattenArray.push(r / 255, g / 255, b / 255);
        }
        const imgArray = ndarray(flattenArray, [this.inputSize, this.inputSize, 3]).transpose(2, 0, 1);
        const imgArrayData = [];
        for (let i = 0; i < imgArray.shape[0]; i++) {
            for (let j = 0; j < imgArray.shape[1]; j++) {
                for (let k = 0; k < imgArray.shape[2]; k++) {
                    imgArrayData.push(imgArray.get(i, j, k));
                }
            }
        }

        // 转换为 ONNX Tensor
        const tensor = new ort.Tensor(
            'float32',
            Float32Array.from(imgArrayData),
            [1, 3, this.inputSize, this.inputSize]
        );

        return {tensor, gain};
    }

    /**
     * 后处理输出
     * @param {object} outputs - 模型输出
     * @param {Gain} gain - 缩放参数
     * @param {number} minScore - 置信度阈值
     * @param {number} iouThreshold - IOU阈值
     * @returns {object[]} - 返回标准化的检测结果
     */
    postprocess(outputs, gain, minScore = 0.3, iouThreshold = 0.5) {
        const outputTensor = outputs['output0'];
        const outputData = new Float32Array(outputTensor.data);

        // 1. 转置并调整形状
        const rows = outputData.length / 84; // 每行84个元素（4坐标 + 80类别）
        const outputsArr = ndarray(outputData, [84, rows]).transpose(1, 0);

        const boxesLTWH = []; // 存储LTWH格式的坐标
        const scores = [];
        const classIds = [];

        // 2. 坐标转换与筛选（关键修改）
        for (let i = 0; i < rows; i++) {
            // 提取原始坐标（中心点+宽高）
            const x = outputsArr.get(i, 0) - gain.left; // 减去填充的left
            const y = outputsArr.get(i, 1) - gain.top;  // 减去填充的top
            const w = outputsArr.get(i, 2);
            const h = outputsArr.get(i, 3);

            // 转换为LTWH格式
            const left = (x - w / 2) / gain.r;
            const top = (y - h / 2) / gain.r;
            const width = w / gain.r;
            const height = h / gain.r;

            // 提取类别分数
            const subArr = outputsArr.pick(i);
            const classScores = [];
            for (let j = 4; j < subArr.size; j++) {
                classScores.push(subArr.get(j));
            }
            const maxScore = Math.max(...classScores);
            const classId = classScores.indexOf(maxScore);

            if (maxScore > minScore) {
                boxesLTWH.push([left, top, width, height]);
                scores.push(maxScore);
                classIds.push(classId);
            }
        }

        // 3. NMS处理LTWH坐标（关键修改）
        const filteredIndices = this.nmsIndices(
            boxesLTWH, // 直接使用LTWH格式的坐标
            scores,
            minScore,
            iouThreshold
        );

        // 4. 生成最终结果
        const results = [];
        for (const idx of filteredIndices) {
            const box = boxesLTWH[idx];
            results.push({
                bbox: box.map(Math.floor), // 转换为整数坐标
                class: this.classNames[classIds[idx]],
                score: scores[idx]
            });
        }

        return results;
    }

    // 更新nmsIndices方法以直接处理LTWH坐标
    nmsIndices(boxes, scores, minScore, iouThreshold) {
        const indices = [];
        const picked = [];
        for (let i = 0; i < boxes.length; i++) {
            if (scores[i] < minScore) continue;
            let keep = true;
            for (const p of picked) {
                const iou = this.calculateIOU(boxes[i], boxes[p]);
                if (iou > iouThreshold) {
                    keep = false;
                    break;
                }
            }
            if (keep) {
                indices.push(i);
                picked.push(i);
            }
        }
        return indices;
    }

    /**
     * 
     * @param {number[]} boxA [x, y, w, h]
     * @param {number[]} boxB [x, y, w, h]
     * @returns 
     */
    calculateIOU(boxA, boxB) {
        const xA = Math.max(boxA[0], boxB[0]);
        const yA = Math.max(boxA[1], boxB[1]);
        const xB = Math.min(boxA[0] + boxA[2], boxB[0] + boxB[2]);
        const yB = Math.min(boxA[1] + boxA[3], boxB[1] + boxB[3]);
        const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
        const boxAArea = boxA[2] * boxA[3];
        const boxBArea = boxB[2] * boxB[3];
        return interArea / (boxAArea + boxBArea - interArea);
    }
}

module.exports = {
    OrtYoloCoco
}