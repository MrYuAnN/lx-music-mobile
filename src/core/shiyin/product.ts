// product.ts 产品键单源（T3 件8）：X-Product 头值与 SKU apps 全源键判定是同一
// 产品身份知识，一处定义多点引用（order.ts/xianyuTrack.ts/flusher.ts/skuParse.ts/
// client.ts）。划界不收口（方案件8）：UI Tab 键判定、deeplink 路由键、auth.ts
// 指纹盐（盐不得随产品键变更跟变）。零 import（skuParse.ts 纯链路可引）。
export const PRODUCT_ID = 'shiyin'
