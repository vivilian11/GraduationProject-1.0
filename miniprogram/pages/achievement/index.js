// pages/achievement/index.js
Page({
  data: {
    totalPoints: 0, // 初始总积分
    // 预设勋章列表（你需要换成你真实的图片路径和名字）
    badgeList: [
      {
        id: 1,
        name: '分类萌新-一级',
        threshold: 5, // 解锁门槛
        icon: '/images/achievements/badge_1.png', // 你下载的图片
        isUnlocked: false // 初始状态：未解锁
      },
      {
        id: 2,
        name: '分类萌新-二级',
        threshold: 25,
        icon: '/images/achievements/badge_2.png',
        isUnlocked: false
      },
      {
        id: 3,
        name: '分类萌新-三级',
        threshold: 50,
        icon: '/images/achievements/badge_3.png',
        isUnlocked: false
      },
      {
        id: 4,
        name: '环保卫士-一级',
        threshold: 70,
        icon: '/images/achievements/badge_4.png',
        isUnlocked: false
      },
      {
        id: 5,
        name: '环保卫士-二级',
        threshold: 90,
        icon: '/images/achievements/badge_5.png',
        isUnlocked: false
      },
      {
        id: 6,
        name: '环保卫士-三级',
        threshold: 100,
        icon: '/images/achievements/badge_6.png',
        isUnlocked: false
      },
      {
        id: 7,
        name: '绿色达人-一级',
        threshold: 120,
        icon: '/images/achievements/badge_7.png',
        isUnlocked: false
      },
      {
        id: 8,
        name: '绿色达人-二级',
        threshold: 140,
        icon: '/images/achievements/badge_8.png',
        isUnlocked: false
      },
      {
        id: 9,
        name: '绿色达人-三级',
        threshold: 160,
        icon: '/images/achievements/badge_9.png',
        isUnlocked: false
      }
    ]
  },

  onShow() {
    // 每次页面显示，都重新算分，保证实时
    this.fetchTotalPoints();
  },

  // --- 核心逻辑：去云数据库算分 ---
  async fetchTotalPoints() {
    wx.showLoading({ title: '计算积分中...' });
    
    try {
      const db = wx.cloud.database();
      // 1. 获取这个用户所有的垃圾打卡记录
      const res = await db.collection('garbage_records').get();
      const records = res.data;

      // 2. 累加积分（遍历记录，把 points 字段加起来）
      let sum = 0;
      records.forEach(item => {
        sum += item.points; // 这里就用到了你截图里的那个 detailed points 字段！
      });

      // 3. 计算勋章解锁状态
      const updatedBadgeList = this.data.badgeList.map(badge => {
        if (sum >= badge.threshold) {
          return { ...badge, isUnlocked: true }; // 积分够了，设为已解锁
        }
        return badge;
      });

      // 4. 更新界面数据
      this.setData({
        totalPoints: sum,
        badgeList: updatedBadgeList
      });

      wx.hideLoading();

    } catch (err) {
      console.error('获取积分失败：', err);
      wx.hideLoading();
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    }
  }
})