// cloudfunctions/getRankList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command 
const $ = db.command.aggregate 

exports.main = async (event, context) => {
  try {
    let matchQuery = {};
    const now = new Date();
    
    // --- 根据不同的类型，制作不同的“漏斗” ---
    if (event.rangeType === 'day') {
      // 今日零点
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      matchQuery = { createTime: _.gte(todayStart) };

    } else if (event.rangeType === 'month') {
      // 本月第一天零点
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      matchQuery = { createTime: _.gte(monthStart) };

    } else {
      // 总榜：不需要过滤时间
      matchQuery = {};
    }

    // --- 开始聚合查询 ---
    return await db.collection('garbage_records')
      .aggregate()
      .match(matchQuery) //根据上面的结果进行过滤
      .group({
        _id: '$_openid', 
        totalPoints: $.sum('$points') 
      })
      .lookup({
        from: 'users',
        localField: '_id',
        foreignField: '_openid',
        as: 'userInfo'
      })
      .sort({
        totalPoints: -1 
      })
      .limit(20)
      .end()
      
  } catch (err) {
    console.error(err)
    return { success: false, msg: '获取排行榜失败' }
  }
}