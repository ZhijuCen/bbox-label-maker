
# Image Annotator

An Object Detection Model assisted Image Annotator on ElectronJS.

## Initial Prompt

```txt
你是一名专业的软件工程师，请以 `ElectronJS` 为基础框架，构建 `Image Annotator` 应用程序，该程序允许用户对图像进行标注，并保存标注结果。首先，以 `Bounding Box` 作为主要标注形式。

主体使用 `<canvas>` 元素进行绘制，用户可以拖动和缩放标注框。

左侧显示导入文件夹内的图像列表，用户可以点击列表中的图像进行查看。

右侧显示标注结果，用户可以查看标注结果并保存。
```

## Setup

Install [NodeJS](https://nodejs.org/en/download/) for your platform.

Install dependencies

```sh
npm install -g node-gyp
npm install
```

Copy `node_modules/@tensorflow/tfjs-node/lib/napi-v10/tensorflow.dll`
to `node_modules/@tensorflow/tfjs-node/lib/napi-v8/tensorflow.dll`
due to [Issue #8431](https://github.com/tensorflow/tfjs/issues/8431)

Place `yolo11x.onnx` and `yolov8x.onnx` in `./models`, [Details](./models/README.md)

## Run

```sh
npm run start
```
