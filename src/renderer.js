// renderer.js

import { switchLanguage, translate } from "./i18n.js";

const imageList = document.getElementById('image-list');
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('annotation-canvas');
const ctx = canvas.getContext('2d');
const annotationList = document.getElementById('annotation-list');

let currentImage = null;
/** @type {object[]} */
let annotations = [];
let isDrawing = false;
let startPos = { x: 0, y: 0 };
let currentBox = null;
let scale = 1;

// 初始化界面
document.getElementById('open-dir').addEventListener('click', async () => {
  const dirPath = await window.electronAPI.openDirectory();
  if (!dirPath) return;

  const files = await window.electronAPI.readDirectory(dirPath);
  imageList.innerHTML = ( await Promise.all(files.map(async file => `
    <div class="image-item" data-path="${window.nodeAPI.joinPath(dirPath, file)}">
      <img src="data:image/png;base64,${await window.electronAPI.loadImage(window.nodeAPI.joinPath(dirPath, file))}">
      <span>${window.nodeAPI.basename(file)}</span>
    </div>
  `)) ).join('');

  // 添加图片点击事件
  document.querySelectorAll('.image-item').forEach(item => {
    item.addEventListener('click', async () => {
        /** @type {string} */
        const filePath = item.dataset.path;
        const imgExt = filePath.split('.').pop();
        document.querySelectorAll('.image-item.selected').forEach(other => {
            other.classList.remove('selected');
        });
        item.classList.add('selected');
        currentImage = new Image();
        currentImage.src = `data:image/${imgExt};base64,${await window.electronAPI.loadImage(filePath)}`;

        currentImage.onload = async () => {
            canvas.width = currentImage.width;
            canvas.height = currentImage.height;
            ctx.drawImage(currentImage, 0, 0);
            await loadAnnotations(filePath);
      };
    });
  });
});

// 初始化语言切换
document.getElementById("language-switcher").addEventListener("change", (e) => {
  const selectedLang = e.target.value;
  switchLanguage(selectedLang);
  updateAnnotationList();
});

// 主题切换初始化
const themeToggleBtn = document.getElementById('theme-toggle');
let isDarkMode = false;

// 检查系统默认主题
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-theme', 'dark');
  isDarkMode = true;
  themeToggleBtn.textContent = '☀️';
}

// 添加主题切换事件
themeToggleBtn.addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  if (isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.textContent = '☀️'; // 太阳表示可以切换到白天模式
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggleBtn.textContent = '🌙'; // 月亮表示可以切换到黑夜模式
  }
});

// Canvas 交互逻辑
canvas.addEventListener('mousedown', (e) => {
  if (!currentImage)
    return ;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;

  // 检查是否点击了现有标注框的边框（允许3像素误差）
  const selected = annotations.find(a => {
    const [ax, ay, aw, ah] = a.bbox;
    const isNearLeftBorder = Math.abs(x - ax) <= 3;
    const isNearRightBorder = Math.abs(x - (ax + aw)) <= 3;
    const isNearTopBorder = Math.abs(y - ay) <= 3;
    const isNearBottomBorder = Math.abs(y - (ay + ah)) <= 3;

    return (isNearLeftBorder || isNearRightBorder) && y >= ay && y <= ay + ah ||
           (isNearTopBorder || isNearBottomBorder) && x >= ax && x <= ax + aw;
  });

  if (selected) {
    currentBox = selected;
    isDrawing = false;
  } else {
    if (!selectedClass) {
      alert('请先在类别管理下选择一个类别，再创建 BBox。');
      return ;
    }
    isDrawing = true;
    startPos = { x, y };
    currentBox = {
      bbox: [x, y, 0, 0],
      class: selectedClass ? selectedClass.name : (categories[0] ? categories[0].name : null),
      score: 1
    };

    annotations.push(currentBox);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if ((!isDrawing && !currentBox) || !currentImage) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) / scale;
  const mouseY = (e.clientY - rect.top) / scale;

  if (isDrawing) {
    // 计算矩形的起点和宽高
    const startX = Math.min(startPos.x, mouseX);
    const startY = Math.min(startPos.y, mouseY);
    const width = Math.abs(mouseX - startPos.x);
    const height = Math.abs(mouseY - startPos.y);

    // 更新当前矩形的位置和大小
    currentBox.bbox = [startX, startY, width, height];
  } else if (currentBox) {
    // 移动矩形
    currentBox.bbox[0] += mouseX - currentBox.bbox[0];
    currentBox.bbox[1] += mouseY - currentBox.bbox[1];
  }

  drawCanvas();
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;

  if (currentBox) {
    currentBox = null;

    drawCanvas();
    updateAnnotationList();
  }
});

/**
 * 绘制 Canvas 内容
 * @param {number} [highlightIndex=-1] - 需要高亮的标注索引，默认为 -1（无高亮）
 */
function drawCanvas(highlightIndex = -1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (currentImage) {
    ctx.drawImage(currentImage, 0, 0);
  }

  annotations.forEach((box, index) => {
    const category = categories.find(cat => cat.name === box.class);
    const isHighlighted = index === highlightIndex;

    // 使用 bbox 数据绘制矩形
    const [x, y, width, height] = box.bbox;
    ctx.strokeStyle = category ? category.color : '#ff0000';
    ctx.lineWidth = 2;
    ctx.shadowColor = isHighlighted ? '#ffff00' : '';
    ctx.shadowBlur = isHighlighted ? 5 : 0;
    ctx.strokeRect(x, y, width, height);

    // 绘制类别名称
    ctx.textBaseline = 'top';
    ctx.fillStyle = category ? category.color : '#ff0000';
    ctx.font = '12px sans-serif';
    ctx.fillText(box.class, x, y - 12);
  });
}

/**
 * 更新标注列表
 */
function updateAnnotationList() {
  annotationList.innerHTML = annotations.map((box, index) => {
    const [x, y, width, height] = box.bbox;
    return `
      <div class="annotation-item" data-index="${index}">
        <div class="annotation-info">
          ${translate("annotationInfo")}: (${Math.round(x)}, ${Math.round(y)}) 
          [${Math.round(width)}x${Math.round(height)}]
        </div>
        <div class="annotation-controls">
          <select class="category-select">
            ${categories.map(category => `
              <option value="${category.name}" ${box.class === category.name ? 'selected' : ''}>${category.name}</option>
            `).join('')}
          </select>
          <div class="controls-row">
            <input type="number" class="width-input" value="${Math.round(width)}" min="1" max="${currentImage.width}">
            <input type="number" class="height-input" value="${Math.round(height)}" min="1" max="${currentImage.height}">
            <button class="delete-btn">${translate("delete")}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 绑定事件
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Array.from(annotationList.children).indexOf(btn.closest('.annotation-item'));
      annotations.splice(index, 1);
      drawCanvas();
      updateAnnotationList();
    });
  });

  document.querySelectorAll('.category-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = Array.from(annotationList.children).indexOf(select.closest('.annotation-item'));
      annotations[index].class = e.target.value;
      drawCanvas();
      updateAnnotationList();
    });
  });

  document.querySelectorAll('.width-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = Array.from(annotationList.children).indexOf(input.closest('.annotation-item'));
      annotations[index].bbox[2] = parseInt(e.target.value, 10);
      drawCanvas();
      updateAnnotationList();
    });
  });

  document.querySelectorAll('.height-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = Array.from(annotationList.children).indexOf(input.closest('.annotation-item'));
      annotations[index].bbox[3] = parseInt(e.target.value, 10);
      drawCanvas();
      updateAnnotationList();
    });
  });

  // 添加鼠标悬停事件
  document.querySelectorAll('.annotation-item').forEach(item => {
    const index = parseInt(item.dataset.index, 10);

    item.addEventListener('mouseenter', () => {
      drawCanvas(index); // 高亮对应的 BBox
    });

    item.addEventListener('mouseleave', () => {
      drawCanvas(); // 恢复默认绘制
    });
  });
}

/**
  * 处理未定义的类别
  * @param {string[]} missingCategories - 未定义的类别名称列表
*/
async function handleMissingCategories(missingCategories) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.classList.add('modal');

    modal.innerHTML = `
      <h3>${translate("missingCategoriesTitle")}</h3>
      <p>${translate("missingCategoriesMessage")}</p>
      <div id="missing-categories-list"></div>
      <button id="confirm-missing-categories">${translate("confirm")}</button>
    `;

    const listContainer = modal.querySelector('#missing-categories-list');
    missingCategories.forEach(className => {
      const item = document.createElement('div');
      item.innerHTML = `
        <div style="margin-bottom: 10px;">
          <span>${className}</span>
          <select class="category-action" data-name="${className}">
            <option value="add">${translate("actionAdd")}</option>
            <option value="assign">${translate("actionAssign")}</option>
          </select>
          <select class="existing-category" style="display: none;">
            ${categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('')}
          </select>
        </div>
      `;
      listContainer.appendChild(item);

      /** @type {HTMLSelectElement} */
      const actionSelect = item.querySelector('.category-action');
      /** @type {HTMLSelectElement} */
      const existingCategorySelect = item.querySelector('.existing-category');

      actionSelect.addEventListener('change', () => {
        if (actionSelect.value === 'assign' && categories.length > 0) {
          existingCategorySelect.style.display = 'inline-block';
        }
        else if (actionSelect.value === 'assign') {
          alert('请先添加类别');
          actionSelect.value = 'add';
          existingCategorySelect.style.display = 'none';
        }
        else {
          existingCategorySelect.style.display = 'none';
        }
      });
    });

    document.body.appendChild(modal);

    modal.querySelector('#confirm-missing-categories').addEventListener('click', () => {
      const actions = Array.from(modal.querySelectorAll('.category-action')).map(select => {
        const className = select.dataset.name;
        const action = select.value;
        const targetCategory = select.nextElementSibling.value;
        return { className, action, targetCategory };
      });

      actions.forEach(({ className, action, targetCategory }) => {
        if (action === 'assign') {
          annotations.forEach(box => {
            if (box.class === className) {
              box.class = targetCategory;
            }
          });
        } else if (action === 'add') {
          categories.push({ name: className, color: '#ff0000' });
        }
      });

      modal.remove();
      resolve();
    });
  });
}

// 保存标注
document.getElementById('save-btn').addEventListener('click', async () => {
  if (!currentImage) return;
  
  /** @type {string} */
  const imgPath = document.querySelector('.image-item.selected').dataset.path;
  const imgExt = imgPath.split('.').pop();
  let dstPath;
  if (['jpg', 'png', 'gif', 'bmp'].find(ext => ext.toLowerCase() === imgExt)) {
    dstPath = imgPath.replace(/\.(jpg|png|gif|bmp)$/i, '.json');
  }
  else {
    dstPath = imgPath + '.json';
  }
  await window.electronAPI.saveAnnotations(dstPath, annotations);
});

/**
 * 加载标注
 * @param {string} imgPath 
 */
async function loadAnnotations(imgPath) {
  try {
    const imgExt = imgPath.split('.').pop();
    let srcPath;
    if (['jpg', 'png', 'gif', 'bmp'].find(ext => ext.toLowerCase() === imgExt)) {
      srcPath = imgPath.replace(/\.(jpg|png|gif|bmp)$/i, '.json');
    }
    else {
      srcPath = imgPath + '.json';
    }
    annotations = await window.electronAPI.loadAnnotations(srcPath);
    if (!annotations) annotations = [];

    annotations = annotations.filter(box => box.class && box.bbox && box.bbox.length === 4);
    annotations = annotations.map(box => {
      box.score = box.score || 1;
      return box;
    })

    // 检测不存在的类别
    const missingCategories = annotations
      .map(box => box.class)
      .filter((name, index, self) => name && !categories.find(cat => cat.name === name) && self.indexOf(name) === index);

    if (missingCategories.length > 0) {
      await handleMissingCategories(missingCategories);
      updateCategoryList();
    }

    drawCanvas();
    updateAnnotationList();
  } catch (error) {
    console.error('Error loading annotations:', error);
    annotations = [];
  }
}

// 初始化缩放控制
document.getElementById('zoom-in').addEventListener('click', () => {
  scale *= 1.2;
  canvas.style.transform = `scale(${scale})`;
});

document.getElementById('zoom-out').addEventListener('click', () => {
  scale *= 0.8;
  canvas.style.transform = `scale(${scale})`;
});

// Category Management
let categories = [];
let selectedClass = null;

/**
 * 将 HSL 转换为 RGB
 * @param {number} h - 色相 (0 ~ 360)
 * @param {number} s - 饱和度 (0 ~ 100)
 * @param {number} l - 亮度 (0 ~ 100)
 * @returns {{r: number, g: number, b: number}} - RGB 对象，值范围为 0 ~ 255
 */
function hslToRgb(h, s, l) {
  h /= 360; // 转换为 0 ~ 1
  s /= 100; // 转换为 0 ~ 1
  l /= 100; // 转换为 0 ~ 1

  let r, g, b;

  if (s === 0) {
    // 如果饱和度为 0，RGB 均为亮度值
    r = g = b = l;
  } else {
    const hueToRgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  // 归一化到 0 ~ 255
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// 添加类别
document.getElementById('add-category-btn').addEventListener('click', () => {
  const name = document.getElementById('category-name').value;
  const color = document.getElementById('category-color').value;

  if (name && color) {
    // 检查是否已存在同名类别
    const existingCategory = categories.find(cat => cat.name === name);
    if (existingCategory) {
      alert('类别名称已存在，请使用不同的名称。');
      return;
    }

    const category = { name, color };
    categories.push(category);
    updateCategoryList();
    updateAnnotationList();

    document.getElementById('category-name').value = '';
  }
});

// 为按钮绑定事件
document.getElementById('reassign-colors-btn').addEventListener('click', () => {
  const categoryCount = categories.length;
  if (categoryCount === 0) return;

  // 计算均匀分布的 Hue 值
  const hueMin = 16;
  const hueMax = 320;
  const hueStep = (hueMax - hueMin) / (categoryCount - 1 || 1); // 避免除以 0
  categories.forEach((category, index) => {
    const hue = hueMin + hueStep * index; // 计算当前类别的 Hue
    const hslColor = `hsl(${hue}, 70%, 50%)`; // HSL 颜色
    const rgbColor = hslToRgb(hue, 70, 50); // 转换为 RGB
    category.color = `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`; // 使用 RGB 格式
  });

  // 更新标注框的颜色
  annotations.forEach(box => {
    const category = categories.find(cat => cat.name === box.class);
    if (category) {
      box.class = category.name; // 确保类别名称一致
    }
  });

  // 刷新界面
  updateCategoryList();
  drawCanvas();
});

/**
 * 显示删除类别的模态框
 * @param {string} className - 要删除的类别名称
 */
function showDeleteCategoryModal(className) {
  const modal = document.createElement('div');
  modal.classList.add('modal');

  // 使用 translate 函数生成翻译后的文本
  const title = translate("deleteCategoryTitle");
  const message = translate("deleteCategoryMessage").replace("${className}", className);
  const deleteOptionText = translate("deleteActionDelete").replace("${className}", className);
  const reassignOptionText = translate("deleteActionReassign").replace("${className}", className);

  modal.innerHTML = `
    <h3>${title}</h3>
    <p>${message}</p>
    <div id="delete-category-options">
      <label>
        <input type="radio" name="action" value="delete" checked>
        ${deleteOptionText}
      </label><br>
      <label>
        <input type="radio" name="action" value="reassign">
        ${reassignOptionText}
      </label>
      <select id="reassign-category-select" style="display: none;">
        ${categories
          .filter(cat => cat.name !== className)
          .map(cat => `<option value="${cat.name}">${cat.name}</option>`)
          .join("")}
      </select>
    </div>
    <button id="confirm-delete-category">${translate("confirm")}</button>
  `;

  const radioButtons = modal.querySelectorAll('input[name="action"]');
  const reassignSelect = modal.querySelector('#reassign-category-select');

  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'reassign') {
        reassignSelect.style.display = 'inline-block';
      } else {
        reassignSelect.style.display = 'none';
      }
    });
  });

  modal.querySelector('#confirm-delete-category').addEventListener('click', () => {
    const action = modal.querySelector('input[name="action"]:checked').value;

    if (action === 'delete') {
      annotations = annotations.filter(box => box.class !== className);
    } else if (action === 'reassign') {
      const targetCategory = reassignSelect.value;
      annotations.forEach(box => {
        if (box.class === className) {
          box.class = targetCategory;
        }
      });
    }

    categories = categories.filter(category => category.name !== className);
    updateCategoryList();
    drawCanvas();
    updateAnnotationList();

    modal.remove();
  });

  document.body.appendChild(modal);
}

// 更新类别列表
function updateCategoryList() {
  const categoryList = document.getElementById('category-list');
  categoryList.innerHTML = categories.map(category => `
    <div class="category-item" data-name="${category.name}" style="background-color: ${category.color || "rgb(255, 0, 0)"};">
      <span class="category-name">${category.name}</span>
      <button class="edit-category-btn" data-name="${category.name}">${translate("editCategory")}</button>
      <button class="delete-btn delete-category-btn" data-name="${category.name}">${translate("delete")}</button>
    </div>
  `).join('');

  // 绑定删除按钮事件
  document.querySelectorAll('.delete-category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const hasBBoxes = annotations.some(box => box.class === name);

      if (hasBBoxes) {
        showDeleteCategoryModal(name);
      } else {
        categories = categories.filter(category => category.name !== name);
        updateCategoryList();
      }

      // 如果当前选中的类别被删除，则取消选中
      if (selectedClass && selectedClass.name === name) {
        selectedClass = null;
        document.querySelectorAll('.category-item').forEach(item => {
          item.classList.remove('selected');
        });
      }
    });
  });

  // 绑定编辑按钮事件
  document.querySelectorAll('.edit-category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      editCategory(name);
    });
  });

  // 绑定类别项点击事件
  document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedClass = categories.find(category => category.name === item.dataset.name);
      document.querySelectorAll('.category-item').forEach(other => {
        other.classList.remove('selected');
      });
      item.classList.add('selected');
    });
  });
}

// 更改类别名称及颜色
function editCategory(name) {
  const category = categories.find(cat => cat.name === name);
  if (!category) return;

  // 创建编辑界面
  const categoryItem = document.querySelector(`.category-item[data-name="${name}"]`);
  categoryItem.innerHTML = `
    <input type="text" class="edit-name" value="${category.name}" placeholder="${translate("categoryNamePlaceholder")}">
    <input type="color" class="edit-color" value="${category.color}">
    <button class="save-edit-btn" data-name="${name}">${translate("save")}</button>
    <button class="cancel-edit-btn" data-name="${name}">${translate("cancel")}</button>
  `;

  // 绑定保存按钮事件
  const saveButton = categoryItem.querySelector('.save-edit-btn');
  saveButton.addEventListener('click', () => {
    const newName = categoryItem.querySelector('.edit-name').value.trim();
    const newColor = categoryItem.querySelector('.edit-color').value;

    // 检查新名称是否为空或重复
    if (!newName) {
      alert(translate("categoryNamePlaceholder")); // 提示用户输入类别名称
      return;
    }
    if (categories.some(cat => cat.name === newName && cat.name !== name)) {
      alert(translate("duplicateCategoryName")); // 提示类别名称已存在
      return;
    }

    // 更新类别信息
    category.name = newName;
    category.color = newColor;

    // 更新标注框的类别名称
    annotations.forEach(box => {
      if (box.class === name) {
        box.class = newName;
      }
    });

    // 重新渲染类别列表和标注列表
    updateCategoryList();
    drawCanvas();
    updateAnnotationList();
  });

  // 绑定取消按钮事件
  const cancelButton = categoryItem.querySelector('.cancel-edit-btn');
  cancelButton.addEventListener('click', () => {
    updateCategoryList(); // 取消编辑，恢复原始状态
  });
}

// 导出标注类别数据
document.getElementById('export-btn').addEventListener('click', async () => {
  const data = {
    categories
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'annotation_categories.json';
  a.click();
  URL.revokeObjectURL(url);
});

// 导入标注类别数据
document.getElementById('import-btn').addEventListener('click', async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = JSON.parse(e.target.result);
      categoriesImported = data.categories || [];
      categoriesImported = categoriesImported.filter(cat => cat.name);

      // 合并导入的类别
      categories.forEach(cat => {
        const imported = categoriesImported.find(c => c.name === cat.name);
        if (imported) {
          cat.color = imported.color || cat.color;
        } else {
          categoriesImported.push(cat);
        }
      });
      categories = categoriesImported;

      updateCategoryList();
      updateAnnotationList();
    };
    reader.readAsText(file);
  };
  input.click();
});

////////////////////////////////////
// 调用 Object Detection Model
////////////////////////////////////

/**
 * 计算两个 BBox 的 IoU（Intersection over Union）
 * @param {number[]} box1 - 第一个 BBox，格式为 [x1, y1, width1, height1]
 * @param {number[]} box2 - 第二个 BBox，格式为 [x2, y2, width2, height2]
 * @returns {number} - IoU 值
 */
function calculateIoU(box1, box2) {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  // 计算两个矩形的交集区域
  const interX1 = Math.max(x1, x2);
  const interY1 = Math.max(y1, y2);
  const interX2 = Math.min(x1 + w1, x2 + w2);
  const interY2 = Math.min(y1 + h1, y2 + h2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const interArea = interWidth * interHeight;

  // 计算两个矩形的并集区域
  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - interArea;

  // 返回 IoU
  return interArea / unionArea;
}

/**
 * 检测新的 BBox 是否与现有 BBox 冲突
 * @param {object[]} newBox - 新的 BBox，其中 bbox 格式为 [x, y, width, height]
 * @param {object[]} existingBoxes - 现有的 BBox 列表
 * @param {number} iouThreshold - IoU 阈值，默认 0.5
 * @returns {boolean} - 是否冲突
 */
function hasConflict(newBox, existingBoxes, iouThreshold = 0.5) {
  return existingBoxes.some(existingBox => {
    const iou = calculateIoU(newBox.bbox, existingBox.bbox);
    return (iou > iouThreshold) && (newBox.class === existingBox.class);
  });
}

// 添加按钮事件
document.getElementById('detect-objects').addEventListener('click', async () => {
    const detectButton = document.getElementById('detect-objects');
    const selectedModel = document.getElementById('model-select').value;

    // 修改按钮状态
    detectButton.textContent = translate("detectingObjects");
    detectButton.disabled = true;

    try {
        if (!currentImage) return;

        // 读取用户设置的 IoU 阈值
        const iouThreshold = parseFloat(document.getElementById('iou-threshold').value) || 0.5;

        // 读取用户选择的处理方式
        const categoryAction = document.getElementById('category-action').value;

        const imagePath = document.querySelector('.image-item.selected').dataset.path;
        const imgExt = imagePath.split('.').pop();
        /** @type {string} */
        const imageData = await window.electronAPI.loadImage(imagePath);
        const img = new Image();
        img.src = `data:image/${imgExt};base64,${imageData}`;
        const imgHeight = img.naturalHeight;
        const imgWidth = img.naturalWidth;
        const imgObject = {
            data: imageData,
            width: imgWidth,
            height: imgHeight
        };

        // 根据用户选择的模型调用不同的检测函数
        let bboxes = [];
        if (selectedModel === 'ssd') {
          bboxes = await window.tfjsAPI.detectObjectsSSD(imgObject);
        } else if (selectedModel.startsWith('yolo')) {
          let version = selectedModel.split('-')[1];
          bboxes = await window.ortAPI.detectObjectsYOLO({...imgObject, version});
        }

        // 过滤掉与现有 BBox 冲突的 prediction
        var filteredBBoxes = bboxes.filter(newBox => !hasConflict(newBox, annotations, iouThreshold));

        // 处理未在 categories 中定义的类别
        const missingCategories = filteredBBoxes
            .map(box => box.class)
            .filter((name, index, self) => name && !categories.find(cat => cat.name === name) && self.indexOf(name) === index);

        if (missingCategories.length > 0) {
            if (categoryAction === 'ignore') {
                // 放弃未定义的类别
                filteredBBoxes = filteredBBoxes.filter(box => categories.some(cat => cat && cat.name === box.class));
            } else if (categoryAction === 'add') {
                // 将所有未定义的类别加入 categories
                missingCategories.forEach(className => {
                    categories.push({ name: className, color: '#ff0000' });
                });
                updateCategoryList();
            }
        }

        // 将过滤后的 BBox 添加到标注列表中
        annotations = annotations.concat(filteredBBoxes);

        updateAnnotationList();
        drawCanvas();
    } catch (error) {
        console.error('Error during object detection:', error);
    } finally {
        // 恢复按钮状态
        detectButton.textContent = translate("detectObjects");
        detectButton.disabled = false;
    }
});
