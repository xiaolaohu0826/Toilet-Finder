# 王座指南 TODO

## 多人评分均值 + 趋势

**改动量**：大（约 5000-6000 token，需重构评分流程）

### DB
- 新建 `ratings(id, toilet_id, rating, created_at)` 表 + RLS
- `toilets_view` 改为 `AVG(rating)` + `COUNT(ratings)` 派生字段
- 现有 `toilets.rating` 列保留做初始值，后续由均值覆盖

### 代码
- `supabase.ts`：加 `insertRating(toiletId, rating)`、`fetchRatingStats(toiletId)` 方法
- `AddToiletModal`：提交时写 `ratings` 表而非直接更新 toilet
- `ToiletDrawer`：显示 **均分 / 评价人数 / 趋势箭头**（近 7 天均分 vs 全量均分）
- `BaiduMap`：marker 颜色改用均分而非单次评分

---

## 厕所密度热区推荐

**改动量**：小（约 1500 token，纯前端，不改 DB）

### 逻辑
- 定位成功后，以用户坐标为中心划分 4 象限（NE / NW / SE / SW）
- 统计各象限内的厕所数量（`toiletsRef` + `nearbyPOIs`）
- 找出厕所最稀疏的方向，生成推荐文案

### UI
- 地图左下角（zoom 指示器旁）显示小提示卡
- 示例：「向东北方向厕所较多，建议前往」
- 数据量不足时隐藏（< 3 个参考点不显示）

### 注意
- 等数据量积累到一定程度再开启，数据稀少时推荐意义不大
