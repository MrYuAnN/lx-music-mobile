// MyKeys「我的权益」屏组件冒烟（A5 批次，方案 doc/plans/a5-display-test-net.md §五 RTL）：
// 未购引导卡 / 本地回落 notice / 服务端按源行 / 段面板开合 / 设备列表 / 行内解绑显隐 /
// 输码弹层 confirm→刷新链。断言=用户视角渲染文本（useI18n stub 回显 key）；数据面=
// nativeModules/core 模块局部替换（bridge 单点控制），展示纯函数（keyDisplay 真跑）。
// mock 常量 BINDING_MARK/SEG_STATE 为真值锚（nativeModules 桥不可真载，值须与平台
// 契约一字不差——漂移由平台仓契约测试兜底）
import { render, waitFor, userEvent } from '@testing-library/react-native'
import MyKeys from './index.tsx'

// ---- 桥控制点（mock 前缀变量——jest.mock hoist 合规） ----
const mockEntries = { current: [] as any[] }
const mockEntitlements = { current: null as any } // null=服务端不可得（回落本地视图）
const mockBinding = { current: null as any }
const mockStateInfo = { current: null as any }
const mockSheet = {
  show: jest.fn(),
  showWithText: jest.fn(),
  setBusy: jest.fn(),
  hide: jest.fn(),
}
const mockActivateByCode = jest.fn(async(_code: string, onOk?: () => void) => { onOk?.() })
const mockUnbindDevice = jest.fn(async(_key: string, onOk?: () => void) => { onOk?.() })
const mockGetKeyEntries = jest.fn(async() => mockEntries.current)
const mockGetEntitlements = jest.fn(async() => mockEntitlements.current)
const mockGetBindingInfo = jest.fn(async() => {
  if (mockBinding.current == null) throw new Error('binding unavailable')
  return mockBinding.current
})

jest.mock('@/utils/nativeModules/activation', () => ({
  // 真值锚（src/utils/nativeModules/activation.ts:10-23，平台契约字面量）
  BINDING_MARK: { UNBOUND: 'unbound', OTHER: 'bound_other' },
  SEG_STATE: { ACTIVE: 'active', QUEUED: 'queued', EXPIRED: 'expired' },
  onEntitlementChanged: () => () => {},
  activationModule: {
    getDeviceId: async() => 'DEV-SELF',
    getKeyEntries: () => mockGetKeyEntries(),
    getEntitlements: () => mockGetEntitlements(),
    getBindingInfo: () => mockGetBindingInfo(),
    getState: async() => mockStateInfo.current,
  },
}))
jest.mock('@/core/shiyin/activation', () => ({
  useActivationState: () => ({ info: mockStateInfo.current }),
  activateByCode: (...a: any[]) => mockActivateByCode(...(a as [string, () => void])),
  unbindDevice: (...a: any[]) => mockUnbindDevice(...(a as [string, () => void])),
  rebindKey: async(_k: string, onOk?: () => void) => { onOk?.() },
  unbindRemoteDevice: async(_k: string, _d: string, onOk?: () => void) => { onOk?.() },
  detectClipboardCandidate: () => null,
  APP_CN: { tx: '腾讯', wy: '网易', kg: '酷狗', kw: '酷我' },
}))
jest.mock('@/store/theme/hook', () => ({
  useTheme: () => ({ 'c-content-background': '#fff', 'c-font': '#000', 'c-font-label': '#666', 'c-primary': '#111', isDark: false }),
}))
jest.mock('@/store/common/hook', () => ({ useStatusbarHeight: () => 40 }))
jest.mock('@/lang', () => ({ useI18n: () => (key: string) => key }))
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { getString: async() => '', setString: () => {} } }))
jest.mock('@/utils/tools', () => ({
  createStyle: (styles: any) => styles,
  toast: () => {},
}))
jest.mock('@/utils', () => ({ dateFormat: (ms: number, format: string) => `${format}@${Math.floor(ms / 1000)}` }))
jest.mock('@/utils/haptic', () => ({ hapticSelection: () => {} }))
jest.mock('@/navigation/navigation', () => ({ pushScreen: () => {} }))
jest.mock('@/navigation/screenNames', () => ({ PURCHASE_SCREEN: 'purchase' }))
jest.mock('@/components/PageContent', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: ({ children }: any) => <View>{children}</View> }
})
jest.mock('@/components/common/ScreenHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/player/PlayerBar', () => ({ __esModule: true, default: () => null, PlayerBarPlaceholder: () => null }))
jest.mock('@/components/common/Icon', () => ({ __esModule: true, Icon: () => null }))
jest.mock('@/components/common/InputSheet', () => {
  const { forwardRef, useImperativeHandle } = require('react')
  const { Text, View } = require('react-native')
  return {
    __esModule: true,
    default: forwardRef((props: any, ref: any) => {
      useImperativeHandle(ref, () => ({
        show: () => mockSheet.show(),
        showWithText: (t: string) => mockSheet.showWithText(t),
        setBusy: (b: boolean) => mockSheet.setBusy(b),
        hide: () => mockSheet.hide(),
      }))
      // confirm 触发器：用户视角=press 该文本即提交输码
      return (
        <View>
          <Text onPress={() => { props.onConfirm?.('JP-CONFIRM') }}>input-sheet-confirm</Text>
        </View>
      )
    }),
  }
})

const NOW = 1_800_000_000

const seg = (over: Partial<any> = {}) => ({
  key: 'JP-ACTIVE-1',
  skuName: '月度',
  kind: 'paid',
  start: NOW - 86_400,
  end: NOW + 30 * 86_400,
  valid: true,
  state: 'active',
  ...over,
})

const serverView = (over: Partial<any> = {}) => ({
  app: 'tx',
  expiry: NOW + 30 * 86_400,
  valid: true,
  segments: [seg()],
  ...over,
})

const bindingSelf = () => ({
  mark: null,
  devices: [
    { deviceId: 'DEV-SELF', deviceName: 'self-dev', boundAt: NOW, isSelf: true },
    { deviceId: 'DEV-OTHER', deviceName: 'other-dev', boundAt: NOW - 1000, isSelf: false },
  ],
})

const resetMocks = () => {
  mockEntries.current = []
  mockEntitlements.current = null
  mockBinding.current = null
  mockStateInfo.current = null
  ;[mockSheet.show, mockSheet.showWithText, mockSheet.setBusy, mockSheet.hide, mockActivateByCode, mockUnbindDevice, mockGetKeyEntries, mockGetEntitlements, mockGetBindingInfo].forEach(m => m.mockClear())
}

const activeState = () => { mockStateInfo.current = { state: 'active', expiry: 0, expiries: {}, isTrial: false, key: 'JP-ACTIVE-1' } }

beforeEach(resetMocks)

test('未购且无码：输入入口行 + 获取引导卡', async() => {
  mockStateInfo.current = { state: 'unactivated', expiry: null, expiries: null, isTrial: false, key: null }
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  await waitFor(() => expect(getByText('keyinfo_empty_hint')).toBeTruthy())
  expect(getByText('keyinfo_input_entry_unactivated')).toBeTruthy()
})

test('本地回落视图：服务端不可得（null）时出回落标注 + 本地聚合源行', async() => {
  activeState()
  mockEntries.current = [{ key: 'JP-LOCAL-1', expiries: { tx: NOW + 86_400 }, expiry: 0, isTrial: false, mark: null, deviceLimit: 1, validKeys: ['tx'] }]
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  await waitFor(() => expect(getByText('ent_local_fallback')).toBeTruthy())
  // 本地聚合源行（APP_CN stub 名）
  expect(getByText('腾讯')).toBeTruthy()
})

test('服务端按源视图：源行渲染，tap 展开段行组', async() => {
  activeState()
  mockEntitlements.current = [serverView()]
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  const user = userEvent.setup()
  await waitFor(() => expect(getByText('腾讯')).toBeTruthy())
  // 源行收起态段行组不渲染；tap 源行展开
  await user.press(getByText('腾讯'))
  // 段行1 档位直出（skuName）+ 状态三态（ent_state_active，t stub 回显 key）
  expect(getByText('月度')).toBeTruthy()
  expect(getByText('ent_state_active')).toBeTruthy()
})

test('段面板开合：tap 段行 → 设备面板（设备管理行）出现', async() => {
  activeState()
  mockEntitlements.current = [serverView()]
  // binding 回填循环走 getKeyEntries 的本地码集（服务端段 key 与本地码同源）
  mockEntries.current = [{ key: 'JP-ACTIVE-1', expiries: { tx: NOW + 86_400 }, expiry: 0, isTrial: false, mark: null, deviceLimit: 1, validKeys: ['tx'] }]
  mockBinding.current = bindingSelf()
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  const user = userEvent.setup()
  await waitFor(() => expect(getByText('腾讯')).toBeTruthy())
  await user.press(getByText('腾讯')) // 展开段行组
  await user.press(getByText('月度')) // tap 段行 → panelSeg
  // 面板=设备面板（设备管理折叠行）
  await waitFor(() => expect(getByText('keyinfo_devices_title', { exact: false })).toBeTruthy())
})

test('设备列表：面板内展开折叠区 → 本机/他机行渲染', async() => {
  activeState()
  mockEntitlements.current = [serverView()]
  mockEntries.current = [{ key: 'JP-ACTIVE-1', expiries: { tx: NOW + 86_400 }, expiry: 0, isTrial: false, mark: null, deviceLimit: 1, validKeys: ['tx'] }]
  mockBinding.current = bindingSelf()
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  const user = userEvent.setup()
  await waitFor(() => expect(getByText('腾讯')).toBeTruthy())
  await user.press(getByText('腾讯'))
  await user.press(getByText('月度'))
  await waitFor(() => expect(getByText('keyinfo_devices_title', { exact: false })).toBeTruthy())
  await user.press(getByText('keyinfo_devices_title', { exact: false })) // 展开设备折叠区
  // 设备行渲染依赖 binding 回填（面板打开即强制重拉的异步链）；行文本=拼接数组 exact:false
  await waitFor(() => expect(getByText('keyinfo_device_self', { exact: false })).toBeTruthy())
  // 他机行=设备名（空名回退 …deviceId 尾 6）
  expect(getByText('other-dev', { exact: false })).toBeTruthy()
})

test('行内解绑显隐：正式段+valid+binding 回填 mark=null → 解绑钮出现且可触发', async() => {
  activeState()
  mockEntitlements.current = [serverView()]
  mockEntries.current = [{ key: 'JP-ACTIVE-1', expiries: { tx: NOW + 86_400 }, expiry: 0, isTrial: false, mark: null, deviceLimit: 1, validKeys: ['tx'] }]
  mockBinding.current = bindingSelf()
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  const user = userEvent.setup()
  await waitFor(() => expect(getByText('腾讯')).toBeTruthy())
  // 行内解绑钮在段行组（面板外）——先 tap 源行展开，binding 回填后钮出现
  await user.press(getByText('腾讯'))
  await waitFor(() => expect(getByText('activation_btn_unbind')).toBeTruthy())
  await user.press(getByText('activation_btn_unbind'))
  await waitFor(() => expect(mockUnbindDevice).toHaveBeenCalledWith('JP-ACTIVE-1', expect.any(Function)))
})

test('输码弹层链：入口行触发 show；confirm 提交 → activateByCode + 刷新', async() => {
  activeState()
  mockEntries.current = [{ key: 'JP-OLD-1', expiries: { tx: NOW + 86_400 }, expiry: 0, isTrial: false, mark: null, deviceLimit: 1, validKeys: ['tx'] }]
  const { getByText } = await render(<MyKeys componentId="mykeys" />)
  const user = userEvent.setup()
  await waitFor(() => expect(getByText('腾讯')).toBeTruthy())
  // 入口行 → InputSheet.show（未购剪贴板路径不触发=已购态）
  await user.press(getByText('keyinfo_input_entry'))
  expect(mockSheet.show).toHaveBeenCalled()
  // confirm 提交（mock 渲染的触发器）→ activateByCode(code, cb) → cb 内关层+刷新
  await user.press(getByText('input-sheet-confirm'))
  await waitFor(() => expect(mockActivateByCode).toHaveBeenCalledWith('JP-CONFIRM', expect.any(Function)))
  // 刷新链：getKeyEntries 二次拉取（submitting 复位后 onOk 已跑）
  await waitFor(() => expect(mockGetKeyEntries.mock.calls.length).toBeGreaterThanOrEqual(2))
})
