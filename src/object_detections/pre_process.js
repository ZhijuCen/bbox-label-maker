// pre_process.js

const { Jimp, BlendMode } = require('jimp');
const ndarray = require('ndarray');

/**
 * 预处理图像
 * @param {Uint8Array} buffer - 图像数据
 * @param {number} outputSize - 输出尺寸
 * @param {boolean} [normalize=true] - 是否归一化
 * @param {boolean} [channelsFirst=true] - 是否通道在前
 * @param {string} [paddingColor='#727272'] - 填充颜色，默认适用 YOLO 填充色
 * @returns {Array, Gain} - 返回 预处理后的张量 以及 缩放参数
 */
async function preprocessFromBuffer(buffer, outputSize,
        normalize = true, channelsFirst = true, paddingColor = '#727272') {
    const img = await Jimp.read(buffer);
    const [wSrc, hSrc] = [img.bitmap.width, img.bitmap.height];
    const newShape = outputSize;


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
    const left = Math.round(dw / 2);
    const gain = { r, dw, dh, top, left, wSrc, hSrc };

    // 3. 缩放图像到未填充尺寸（关键修改）
    const scaledImg = img.resize({w: newUnpad.width, h: newUnpad.height});

    // 4. 创建填充画布（关键修改）
    const paddedImg = new Jimp({
        width: newShape,
        height: newShape,
        color: paddingColor
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
        if (normalize)
            flattenArray.push(r / 255, g / 255, b / 255);
        else
            flattenArray.push(r, g, b);
    }
    let imgArray = ndarray(flattenArray, [newShape, newShape, 3]);
    if (channelsFirst) {
        imgArray = imgArray.transpose(2, 0, 1);
    }
    const imgArrayData = [];
    for (let i = 0; i < imgArray.shape[0]; i++) {
        for (let j = 0; j < imgArray.shape[1]; j++) {
            for (let k = 0; k < imgArray.shape[2]; k++) {
                imgArrayData.push(imgArray.get(i, j, k));
            }
        }
    }

    return { imgArrayData, gain };
}

module.exports = {
    preprocessFromBuffer
}
