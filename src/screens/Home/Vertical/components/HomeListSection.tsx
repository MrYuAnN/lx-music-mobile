import { useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import MyList, { type MyListType } from '@/screens/Home/Views/Mylist/MyList'
import CollectList from './CollectList'
import { createStyle } from '@/utils/tools'

// 首页歌单区（批次⑤）：我的/收藏 双 Tab；「+」新建歌单；管理能力走条目长按菜单（MyList 复用）
type TabId = 'my' | 'collect'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('my')
  const myListRef = useRef<MyListType>(null)

  const tabs: Array<{ id: TabId, label: string }> = [
    { id: 'my', label: t('home_tab_my') },
    { id: 'collect', label: t('home_tab_collect') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {
          tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => { setActiveTab(tab.id) }}
              activeOpacity={0.7}
            >
              <Text
                size={16}
                color={activeTab == tab.id ? theme['c-primary'] : theme['c-font-label']}
                style={activeTab == tab.id ? styles.tabActiveText : null}
              >{tab.label}</Text>
              {
                activeTab == tab.id
                  ? <View style={{ ...styles.tabLine, backgroundColor: theme['c-primary'] }} />
                  : null
              }
            </TouchableOpacity>
          ))
        }
        <View style={styles.tabSpace} />
        {
          activeTab == 'my'
            ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => { myListRef.current?.showCreate() }} activeOpacity={0.7}>
                  <Text size={22} color={theme['c-font']}>+</Text>
                </TouchableOpacity>
              )
            : null
        }
      </View>
      {activeTab == 'my' ? <MyList ref={myListRef} filterCollected /> : <CollectList />}
    </View>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 1,
    marginTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 20,
  },
  tabItem: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  tabActiveText: {
    fontWeight: 'bold',
  },
  tabLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
  },
  tabSpace: {
    flex: 1,
  },
  actionBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
