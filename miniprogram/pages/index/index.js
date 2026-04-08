// pages/index/index.js
Page({
  data: {
    // 1. 环保知识库
    tipsList: [
      "过期的化妆品属于有害垃圾哦。",
      "喝完的塑料瓶记得踩扁，可以节省回收空间。",
      "废旧电池请投放到红色的有害垃圾桶中。",
      "厨余垃圾在投放前，请尽量沥干水分。",
      "纸巾由于水溶性太强，属于其他垃圾。",
      "快递纸箱拆开压扁后属于可回收物。"
    ],
    currentTip: "", // 当前显示的知识
    identifyResult: null 
  },

  onLoad() {
    // 页面加载时，随机抽一个知识点
    this.setRandomTip();
  },

  // 随机抽取函数的逻辑
  setRandomTip() {
    const list = this.data.tipsList;
    const randomIndex = Math.floor(Math.random() * list.length);
    this.setData({
      currentTip: list[randomIndex]
    });
  },

  // --- 拍照识别逻辑 ---
  onTakePhoto: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传识别中...' });
        this.uploadImageToCloud(tempFilePath);
      }
    })
  },

  uploadImageToCloud(filePath) {
    const cloudPath = `garbage-images/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        this.callAIIdentify(res.fileID);
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ icon: 'none', title: '上传失败' });
      }
    })
  },

  callAIIdentify(fileID) {
    wx.cloud.callFunction({
      name: 'identifyGarbage',
      data: { fileID: fileID },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const result = res.result.data;
          
          // 1. 先弹窗告诉用户结果
          wx.showModal({
            title: `识别成功：${result.name}`,
            content: `属于：${result.type}`,
            confirmText: '去打卡',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 2. 【核心代码】用户点“去打卡”，存入数据库
                const db = wx.cloud.database();
                db.collection('garbage_records').add({
                  data: {
                    name: result.name,      // 垃圾名字
                    type: result.type,      // 分类
                    imgFileID: fileID,      // 图片ID
                    createTime: db.serverDate(), // 服务器时间
                    points: 5               // 每次打卡固定加5分
                  },
                  success: () => {
                    wx.showToast({ title: '打卡成功！积分+5' });
                  },
                  fail: err => {
                    console.error('存入失败', err);
                  }
                })
              }
            }
          });
        } else {
          wx.showToast({ title: '识别失败，请重试', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('云函数调用失败', err);
      }
    }) // 对应 callFunction 的结束
  } // 对应 callAIIdentify 的结束
})