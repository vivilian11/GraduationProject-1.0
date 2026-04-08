// pages/map/index.js
// pages/map/map.js

const QQ_MAP_KEY = '3O2BZ-7QVCB-TU7UU-JIVSJ-2RZ3H-X6FC6'
// 不同垃圾桶类型对应的标记颜色
const MARKER_COLORS = {
  default: '#4CAF50',
  selected: '#FF5722',
}

Page({
  data: {
    latitude: 39.9087,   // 默认北京，定位成功后会覆盖
    longitude: 116.3975,
    markers: [],
    selectedBin: null,   // 当前选中的垃圾桶信息
    loading: false,
    locationFail: false,
  },

  onLoad() {
    this.getLocation()
  },

  // ─── 第一步：获取用户定位 ───────────────────────────
  getLocation() {
    this.setData({ loading: true, locationFail: false })

    wx.getLocation({
      type: 'gcj02',   // 必须用 gcj02，腾讯地图和微信地图都用这个坐标系
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
        })
        this.searchNearbyBins(res.latitude, res.longitude)
      },
      fail: () => {
        // 定位失败：可能是用户拒绝授权
        this.setData({ loading: false, locationFail: true })
        wx.showToast({ title: '定位失败，请授权位置权限', icon: 'none' })
      }
    })
  },

  // ─── 第二步：调腾讯地图 API 搜索附近垃圾桶 ──────────
  searchNearbyBins(lat, lng) {
    // 腾讯位置服务「关键词搜索」接口
    const url = `https://apis.map.qq.com/ws/place/v1/search` +
      `?keyword=垃圾桶` +
      `&boundary=nearby(${lat},${lng},1000)` +  // 1000米范围内
      `&page_size=10` +                          // 最多返回10个
      `&key=${QQ_MAP_KEY}`

    wx.request({
      url,
      success: (res) => {
        if (res.data.status === 0 && res.data.data.length > 0) {
          this.buildMarkers(res.data.data, lat, lng)
        } else {
          // API 没找到结果，用模拟数据兜底（开发阶段用）
          this.useMockData(lat, lng)
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        this.useMockData(lat, lng)  // 网络失败也用模拟数据
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  // ─── 第三步：把 API 数据转成地图 markers ─────────────
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
        // 地图上显示的图标样式
        iconPath: '/assets/icons/bin.png',   // 自定义图标，没有的话删掉这行用默认
        width: 32,
        height: 32,
        callout: {
          content: `${item.title}\n${dist}m`,
          color: '#ffffff',
          bgColor: '#4CAF50',
          borderRadius: 6,
          padding: 6,
          display: 'BYCLICK',   // 点击才显示气泡
        }
      }
    })

    this.setData({ markers })
  },

  // ─── 点击地图上的标记 ────────────────────────────────
  onMarkerTap(e) {
    const markerId = e.markerId
    const bin = this.data.markers[markerId]
    if (!bin) return

    // 更新选中标记颜色
    const markers = this.data.markers.map((m, i) => ({
      ...m,
      iconPath: i === markerId ? '/assets/icons/bin-active.png' : '/assets/icons/bin.png'
    }))

    this.setData({
      markers,
      selectedBin: bin,
    })
  },

  // ─── 导航到选中垃圾桶 ────────────────────────────────
  navigateToBin() {
    const bin = this.data.selectedBin
    if (!bin) return

    wx.openLocation({
      latitude: bin.latitude,
      longitude: bin.longitude,
      name: bin.title,
      address: bin.address,
    })
  },

  // ─── 工具：计算两点距离（米）────────────────────────
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