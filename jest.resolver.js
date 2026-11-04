// Jest resolver 组合器（A5 基建，方案 doc/plans/a5-display-test-net.md §四/审查 S-2）：
// jest 单 resolver 槽位，而 @react-native/jest-preset@0.88.1 自带 resolver
// （react-native exports 剥离，RFC0894 兼容）与 react-native-reanimated 4 的
// resolver（worklets web-only 剥离 + 平台后缀过滤，内部级联 worklets resolver）
// 都要生效——链式组合：reanimated 只拦自家请求，其余回落 RN preset resolver，
// 再回落 Jest 默认。
const rnResolver = require('@react-native/jest-preset/jest/resolver.js')
const reanimatedResolver = require('react-native-reanimated/jest/resolver.js')

module.exports = (path, options) =>
  reanimatedResolver(path, {
    ...options,
    defaultResolver: (req, opts) => rnResolver(req, { ...opts, defaultResolver: options.defaultResolver }),
  })
