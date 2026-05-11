// pages/me/index.js
Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },
    openidShort: ''
  },

  onLoad() {
    this.checkUser();
  },

  // 检查用户是否已经登录过
  async checkUser() {
    const db = wx.cloud.database();
    const res = await db.collection('users').get();
    if (res.data.length > 0) {
      this.setData({
        userInfo: res.data[0],
        openidShort: res.data[0]._openid.substring(0, 10)
      });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    //把头像数据更新到data
    this.setData({ "userInfo.avatarUrl": avatarUrl });
    this.saveUserProfile();
  },

  // 输入昵称
  onInputNickname(e) {
    const nickName = e.detail.value;
    this.setData({ "userInfo.nickName": nickName });
    this.saveUserProfile();
  },

  // 保存到数据库
  async saveUserProfile() {
    const db = wx.cloud.database();
    const user = this.data.userInfo;
    
    // 查询是否已有记录
    const res = await db.collection('users').get();
    if (res.data.length > 0) {
      // 更新已有记录
      await db.collection('users').doc(res.data[0]._id).update({
        data: { avatarUrl: user.avatarUrl, nickName: user.nickName }
      });
    } else {
      // 新建记录
      await db.collection('users').add({
        data: { avatarUrl: user.avatarUrl, nickName: user.nickName }
      });
    }
    wx.showToast({ title: '资料已同步' });
  },

  showHelp() {
    wx.showModal({
      title: '帮助中心',
      content: '1. 拍照识别后点击打卡即可获得积分\n2. 积分可解锁成就勋章\n3. 地图可寻找最近的垃圾桶',
      showCancel: false
    });
  },
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清空数据
          this.setData({
            userInfo: { avatarUrl: '', nickName: '' },
            openidShort: ''
          });
          wx.showToast({ title: '已退出', icon: 'none' });
        }
      }
    })
  }
})