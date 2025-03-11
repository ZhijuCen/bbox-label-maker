// ort_yolo_worker.js

/**
 * @typedef {Object<string, OrtYoloCoco>} YoloModels
 */

const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { OrtYoloCoco } = require('./ort_yolo_coco');

if (!isMainThread) {
  const modelPathTmp = path.join(__dirname, '../../models/yolo${version}.onnx');
  /** @type {YoloModels} */
  const models = {};

  parentPort.on('message', async (args) => {
    try {
      if (!models[args.version]) {
        models[args.version] = new OrtYoloCoco(modelPathTmp.replace('${version}', args.version));
        await models[args.version].init();
      }
      const data = args.data;
      const buffer = Buffer.from(data, 'base64');
      const result = await models[args.version].predict(buffer);
      parentPort.postMessage({ success: true, result });
    } catch (error) {
      parentPort.postMessage({ success: false, error: error.message });
    }
  });
}