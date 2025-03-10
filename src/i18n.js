// i18n.js

// 定义语言资源
const translations = {
  en: {
    openDir: "Open Directory",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    saveBtn: "Save Annotations",
    importBtn: "Import Categories",
    exportBtn: "Export Categories",
    iouThreshold: "IoU Threshold:",
    categoryAction: "Handle Undefined Categories:",
    addCategory: "Add Category",
    reassignColors: "Reassign Colors",
    editCategory: "Edit",
    annotationList: "Annotation List",
    categoryManagement: "Category Management",
    modelSelect: "Select Model:",
    actionIgnore: "Ignore",
    actionAdd: "Add to Category Management",
    categoryNamePlaceholder: "Enter category name",
    // On Missing Categories
    missingCategoriesTitle: "Undefined Categories Detected",
    missingCategoriesMessage: "The following categories are not defined in the current category management. Please choose how to handle them:",
    actionAssign: "Assign to Existing Category",
    annotationInfo: "Annotation Info",
    // On Delete Category
    deleteCategoryTitle: "Delete Category",
    deleteCategoryMessage: "There are BBoxes belonging to the category '${className}'. Please choose how to handle them:",
    deleteActionDelete: "Delete all BBoxes belonging to '${className}'",
    deleteActionReassign: "Reassign all BBoxes belonging to '${className}' to another category",
    // On Edit Category
    editCategoryTitle: "Edit Category",
    categoryNamePlaceholder: "Enter category name",
    // On Detect Objects
    detectObjects: "Generate BBox",
    detectingObjects: "Detecting objects...",

    confirm: "Confirm",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
  },
  zh: {
    openDir: "打开目录",
    zoomIn: "放大",
    zoomOut: "缩小",
    saveBtn: "保存标注",
    importBtn: "导入标注类别",
    exportBtn: "导出标注类别",
    iouThreshold: "IoU 阈值:",
    categoryAction: "处理未定义类别:",
    addCategory: "添加类别",
    reassignColors: "重新分配颜色",
    editCategory: "编辑",
    annotationList: "标注列表",
    categoryManagement: "类别管理",
    modelSelect: "选择模型:",
    actionIgnore: "忽略",
    actionAdd: "加入类别管理",
    categoryNamePlaceholder: "请输入类别名称",

    missingCategoriesTitle: "检测到未定义的类别",
    missingCategoriesMessage: "以下类别在当前类别管理中不存在，请选择处理方式：",
    actionAssign: "分配到现有类别",
    annotationInfo: "标注信息",

    deleteCategoryTitle: "删除类别",
    deleteCategoryMessage: "存在属于“${className}”类别的 BBox，请选择处理方式：",
    deleteActionDelete: "删除所有属于“${className}”类别的 BBox",
    deleteActionReassign: "将所有属于“${className}”类别的 BBox 转为其他类别",

    editCategoryTitle: "编辑类别",
    categoryNamePlaceholder: "请输入类别名称",

    detectObjects: "一键生成 BBox",
    detectingObjects: "正在检测对象...",

    confirm: "确认",
    save: "保存",
    cancel: "取消",
    delete: "删除",
  },
};

// 当前语言设置
let currentLanguage = "zh"; // 默认为中文

/**
 * 切换语言
 * @param {string} lang - 目标语言代码 (如 'en', 'zh')
 */
function switchLanguage(lang) {
  if (!translations[lang]) {
    console.warn(`Unsupported language: ${lang}`);
    return;
  }
  currentLanguage = lang;
  updateUI();
}

/**
 * 获取当前语言的翻译
 * @param {string} key - 翻译键
 * @returns {string} - 对应语言的翻译文本
 */
function translate(key) {
  return translations[currentLanguage]?.[key] || key; // 如果找不到翻译，则返回键本身
}

/**
 * 更新界面语言
 */
function updateUI() {
  // 更新按钮文本
  document.getElementById("open-dir").textContent = translate("openDir");
  document.getElementById("zoom-in").textContent = translate("zoomIn");
  document.getElementById("zoom-out").textContent = translate("zoomOut");
  document.getElementById("save-btn").textContent = translate("saveBtn");
  document.getElementById("import-btn").textContent = translate("importBtn");
  document.getElementById("export-btn").textContent = translate("exportBtn");
  document.getElementById("detect-objects").textContent = translate("detectObjects");

  // 更新标签文本
  document.querySelector('label[for="iou-threshold"]').textContent = translate("iouThreshold");
  document.querySelector('label[for="category-action"]').textContent = translate("categoryAction");
  document.querySelector('label[for="model-select"]').textContent = translate("modelSelect");
  document.getElementById("add-category-btn").textContent = translate("addCategory");
  document.getElementById("reassign-colors-btn").textContent = translate("reassignColors");

  // 更新标题
  document.querySelector(".annotation-management h3").textContent = translate("annotationList");
  document.querySelector(".category-management h3").textContent = translate("categoryManagement");

  // 更新类别管理中的按钮文本
  document.querySelectorAll(".delete-category-btn").forEach(btn => {
    btn.textContent = translate("delete");
  });
  document.querySelectorAll(".edit-category-btn").forEach(btn => {
    btn.textContent = translate("editCategory");
  });

//   // 更新标注列表中的按钮文本
//   document.querySelectorAll(".delete-btn").forEach(btn => {
//     btn.textContent = translate("delete");
//   });

  // 更新 #category-action 下拉选项
  const categoryActionSelect = document.getElementById("category-action");
  if (categoryActionSelect) {
    categoryActionSelect.innerHTML = `
      <option value="ignore">${translate("actionIgnore")}</option>
      <option value="add">${translate("actionAdd")}</option>
    `;
  }

  // 更新 #category-name 的 placeholder
  const categoryNameInput = document.getElementById("category-name");
  if (categoryNameInput) {
    categoryNameInput.placeholder = translate("categoryNamePlaceholder");
  }
}

// 暴露接口
export { switchLanguage, translate };