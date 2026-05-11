// pages/map/index.js
const config = require('cloudfunctions\identifyGarbage\config.json')
const QQ_MAP_KEY = 'config.QQ_MAP_KEY'

// 多关键词轮询
const SEARCH_KEYWORDS = ['垃圾桶', '垃圾投放', '回收站', '垃圾处理','公共厕所','商场','加油站','停车场','超市']

Page({
  data: {
    latitude: 39.9087,
    longitude: 116.3975,
    markers: [],
    selectedBin: null,
    loading: false,
    locationFail: false,
  },

  onLoad() {
    this.getLocation()
  },

  // 获取用户定位
  getLocation() {
    this.setData({ loading: true, locationFail: false })
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
        })
        this.searchNearbyBins(res.latitude, res.longitude)
      },
      fail: () => {
        this.setData({ loading: false, locationFail: true })
        wx.showToast({ title: '定位失败，请手动开启权限', icon: 'none' })
        this.useMockData(this.data.latitude, this.data.longitude)
      }
    })
  },

  // 多关键词轮询搜索
  async searchNearbyBins(lat, lng) {
    // 依次尝试每个关键词，搜到结果就停止
    for (const keyword of SEARCH_KEYWORDS) {
      const found = await this.requestByKeyword(keyword, lat, lng)
      if (found) {
        console.log(`关键词「${keyword}」搜索成功`)
        return
      }
      console.log(`关键词「${keyword}」无结果，尝试下一个...`)
    }

    // 所有关键词都没搜到，启用模拟数据
    console.warn('所有关键词均无结果，使用模拟数据')
    this.useMockData(lat, lng)
    this.setData({ loading: false })
  },

  // 单次关键词请求，返回 true 表示搜到了
  requestByKeyword(keyword, lat, lng) {
    return new Promise((resolve) => {
      const url = `https://apis.map.qq.com/ws/place/v1/search` +
        `?keyword=${keyword}` +
        `&boundary=nearby(${lat},${lng},3000)` +
        `&page_size=10` +
        `&key=${QQ_MAP_KEY}`

      wx.request({
        url,
        success: (res) => {
          if (res.data.status === 0 && res.data.data && res.data.data.length > 0) {
            this.buildMarkers(res.data.data, lat, lng)
            this.setData({ loading: false })
            resolve(true)
          } else {
            resolve(false)
          }
        },
        fail: () => resolve(false)
      })
    })
  },

  // 地图标记点
  buildMarkers(binList, userLat, userLng) {
    const markers = binList.map((item, index) => {
      const dist = this.calcDistance(userLat, userLng, item.location.lat, item.location.lng)
      return {
        id: index,
        latitude: item.location.lat,
        longitude: item.location.lng,
        title: item.title,
        address: item.address,
        distance: dist,
        iconPath: '/images/map/bin_1.png',
        width: 35,
        height: 35,
        callout: {
          content: `${item.title}\n距离：${dist}m`,
          color: '#ffffff',
          bgColor: '#4CAF50',
          borderRadius: 8,
          padding: 8,
          display: 'BYCLICK',
        }
      }
    })
    this.setData({ markers })
  },

  // 查不出来，模拟数据
  useMockData(lat, lng) {
    const mockBins = [
      { title: '智能垃圾分类回收站', location: { lat: lat + 0.0015, lng: lng + 0.0015 }, address: '社区服务中心旁' },
      { title: '有害垃圾收集点',     location: { lat: lat - 0.0012, lng: lng - 0.0020 }, address: '公寓5号楼下' },
      { title: '可回收物智能箱',     location: { lat: lat + 0.0025, lng: lng - 0.0010 }, address: '广场北侧' },
    ]
    this.buildMarkers(mockBins, lat, lng)
  },

  // 点击标记 
  onMarkerTap(e) {
    const markerId = e.markerId 
    const bin = this.data.markers[markerId]
    if (!bin) return

    // 切换选中图标
    const markers = this.data.markers.map((m, i) => ({
      ...m,
      iconPath: i === markerId ? '/images/map/bin_2.png' : '/images/map/bin_1.png'
    }))
    this.setData({ markers, selectedBin: bin })
  },

  // 导航
  navigateToBin() {
    const bin = this.data.selectedBin
    if (!bin) {
      wx.showToast({ title: '请先点击地图上的标记', icon: 'none' })
      return
    }
    wx.openLocation({
      latitude: bin.latitude,
      longitude: bin.longitude,
      name: bin.title,
      address: bin.address,
      fail: () => {
        // 部分机型 openLocation 会失败，提示用户手动导航
        wx.showToast({ title: '导航启动失败，请手动前往', icon: 'none' })
      }
    })
  },

  // 距离算法
  calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) *
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  },
})