
const { app, BrowserWindow, ipcMain, dialog } = require('electron/main')
const path = require('path')
const fs = require('fs/promises');

require('@tensorflow/tfjs-backend-cpu');
require('@tensorflow/tfjs-backend-webgl');
const tf = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');

const { padToSquareFromBuffer, toOrtTensor, resizeImage } = require('./utils/image_process');
const { filterBBoxOutOfBound, rescaleBBoxFromNormalized } = require('./object_detections/post_process');
const { OrtYoloCoco } = require('./object_detections/ort_yolo_coco');

let mainWindow = null;
let modelSSD = null;
let modelYolo = {};

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return canceled ? null : filePaths[0]
}

async function readDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath)
    return files.filter(file => /\.(png|jpg|gif|bmp)$/i.test(file))
  } catch (error) {
    console.error('Error reading directory:', error)
    return []
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))

  // 添加IPC通信处理
  ipcMain.handle('dialog:openDirectory', handleFileOpen)

  ipcMain.handle('fs:readDirectory', async (_, dirPath) => await readDirectory(dirPath))
  ipcMain.handle('fs:readImage', async (_, filePath) => {
    const buffer = await fs.readFile(filePath)
    return buffer.toString('base64')
  })
  ipcMain.handle('fs:saveAnnotations', async (_, { filePath, data }) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  })
  ipcMain.handle('fs:loadAnnotations', async (_, filePath) => {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading annotations:', error);
      return null;
    }
  });

  ipcMain.handle('tfjs:detectObjectsSSD', async (_, imageData) => {
    if (!modelSSD) {
      modelSSD = await cocoSsd.load();
    }
    const {data, width, height} = imageData;
    const imgBuffer = new Uint8Array(Buffer.from(data, 'base64'));

    const imgTensor = tf.node.decodeImage(imgBuffer, 3);
    const wPadNum = width > height ? width - height : 0;
    const hPadNum = height > width ? height - width : 0;
    const imgTensorPadded = tf.pad3d(imgTensor, [[0, hPadNum], [0, wPadNum], [0, 0]], 0);
    /** @type {object[]} */
    const predictions = await modelSSD.detect(imgTensorPadded);
    return filterBBoxOutOfBound(predictions, width, height);
  })

  ipcMain.handle('ort:detectObjectsYOLO', async (_, args) => {
    const {data, width, height, version} = args;

    if (!modelYolo[version]) {
      modelYolo[version] = new OrtYoloCoco(`models/yolo${version}.onnx`);
      await modelYolo[version].init();
    }
    const imgBuffer = Buffer.from(data, 'base64');

    // 调用模型进行推理
    const predictions = await modelYolo[version].predict(imgBuffer);

    return filterBBoxOutOfBound(predictions, width, height);

  })

}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
