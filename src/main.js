
const { app, BrowserWindow, ipcMain, dialog } = require('electron/main')
const path = require('path')
const fs = require('fs/promises');

require('@tensorflow/tfjs-backend-cpu');
require('@tensorflow/tfjs-backend-webgl');
const tf = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');

const { filterBBoxOutOfBound } = require('./object_detections/post_process');
const { OrtYoloCoco } = require('./object_detections/ort_yolo_coco');
const { TfSSDCoco } = require('./object_detections/tfjs_ssd_coco')

let mainWindow = null;
/** @type {cocoSsd.ObjectDetection} */
let modelSSD = null;
let modelYolo = {};

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return canceled ? null : filePaths[0]
}

async function ensureAnnotationsDir(dirPath) {
  const annotationsDir = path.join(dirPath, '.annotations');
  try {
    await fs.mkdir(annotationsDir, { recursive: true }); // 确保目录存在
    return annotationsDir;
  } catch (error) {
    console.error('Error creating .annotations directory:', error);
    throw error;
  }
}

async function readDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath)
    return files.filter(file => /\.(png|jpg|gif|bmp)$/i.test(file))
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
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
    try {
      const dirPath = path.dirname(filePath);
      const annotationsDir = await ensureAnnotationsDir(dirPath); // 确保 .annotations 存在
      const annotationFilePath = path.join(annotationsDir, path.basename(filePath));
      await fs.writeFile(annotationFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving annotations:', error);
      throw error;
    }
  });
  ipcMain.handle('fs:loadAnnotations', async (_, filePath) => {
    try {
      const dirPath = path.dirname(filePath);
      const annotationsDir = await ensureAnnotationsDir(dirPath); // 确保 .annotations 存在
      const annotationFilePath = path.join(annotationsDir, path.basename(filePath));
      const data = await fs.readFile(annotationFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading annotations:', error);
      return null;
    }
  });

  ipcMain.handle('tfjs:detectObjectsSSD', async (_, imageData) => {
    if (!modelSSD) {
      modelSSD = new TfSSDCoco();
      await modelSSD.init();
    }
    const {data, width, height} = imageData;
    const imgBuffer = Buffer.from(data, 'base64');

    const predictions = await modelSSD.predict(imgBuffer);

    return predictions;
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

    return predictions;

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
