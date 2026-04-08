// pages/rank/index.js
Page({
  data: {
    rankList: []
  },

  onShow() {
    // 每次页面显示，都重新加载最新的排行榜
    this.fetchRankList();
  },

  async fetchRankList() {
    wx.showLoading({ title: '加载排行榜...' });
    
    try {
      const res = await wx.cloud.callFunction({ name: 'getRankList' });
      const rankList = res.result.list; 
      
      this.setData({
        rankList: rankList
      });

      wx.hideLoading();

    } catch (err) {
      console.error('获取排行榜失败：', err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 切换标签函数
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ activeTab: type }, () => {
      this.fetchRankList(); // 切换后重新加载
    });
  },
})