import { SPLIT_CHAR } from '@/config/constant'
import { getDislikeListRules } from './data'

const dislikeInfo: SY.Dislike.DislikeInfo = {
  names: new Set(),
  musicNames: new Set(),
  singerNames: new Set(),
  rules: '',
}

// 协议转义单点（2026-10-22 治理批 P5，审查 I-2）：歌名/歌手中的分隔符 @ 归一为 # 再入协议，
// 所有写入方（列表菜单/播放页/管理页表单）必须经此封装，防含 @ 名字写出歧义规则
const escapeName = (text: string) => {
  return text.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).trim()
}

/** 结构化写入 → 规则行（name/singer 均空返回 null） */
export const buildRuleLine = (rawName: string | undefined, rawSinger: string | undefined): string | null => {
  const name = escapeName(rawName ?? '')
  const singer = escapeName(rawSinger ?? '')
  if (!name && !singer) return null
  if (name && singer) return `${name}${SPLIT_CHAR.DISLIKE_NAME}${singer}`
  if (name) return name
  return `${SPLIT_CHAR.DISLIKE_NAME}${singer}`
}

export const getDislikeInfo = async() => {
  updateDislikeInfo(await getDislikeListRules())
  return dislikeInfo
}

const updateDislikeInfo = (rules: string) => {
  dislikeInfo.names.clear()
  dislikeInfo.musicNames.clear()
  dislikeInfo.singerNames.clear()
  const list: string[] = []
  for (const item of rules.split('\n')) {
    if (!item) continue
    let [name, singer] = item.split(SPLIT_CHAR.DISLIKE_NAME)
    if (name) {
      name = name.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim()
      if (singer) {
        singer = singer.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim()
        const rule = `${name}${SPLIT_CHAR.DISLIKE_NAME}${singer}`
        dislikeInfo.names.add(rule)
        list.push(rule)
      } else {
        dislikeInfo.musicNames.add(name)
        list.push(name)
      }
    } else if (singer) {
      singer = singer.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim()
      dislikeInfo.singerNames.add(singer)
      list.push(`${SPLIT_CHAR.DISLIKE_NAME}${singer}`)
    }
  }
  dislikeInfo.rules = Array.from(new Set(list)).join('\n')
}

export const addDislikeInfo = async(infos: SY.Dislike.DislikeMusicInfo[]) => {
  const lines = infos.map(info => buildRuleLine(info.name, info.singer)).filter((line): line is string => line != null)
  if (!lines.length) return dislikeInfo
  updateDislikeInfo(dislikeInfo.rules + '\n' + lines.join('\n'))
  return dislikeInfo
}

export const overwirteDislikeInfo = async(rules: string) => {
  updateDislikeInfo(rules)
  return dislikeInfo
}

export const clearDislikeInfo = async() => {
  updateDislikeInfo('')
  return dislikeInfo
}

// —— 管理页（P5）：结构化解析渲染（幂等，纯函数无副作用）——

export interface DislikeRuleItem {
  /** 规范化后的规则行（同 dislikeInfo.rules 内的一行），删除操作按行匹配 */
  rule: string
  type: 'song' | 'singer' | 'songSinger'
  name: string
  singer: string
}

// 注：@→# 转义为上游协议设计（单向），原名含 # 时展示会还原为 @——协议固有限制，匹配/删除
// 不受影响（匹配层两侧同规则归一），管理页展示接受此歧义（治理批 P5 审查 I4 记录）
const unescapeName = (text: string) => text.replaceAll(SPLIT_CHAR.DISLIKE_NAME_ALIAS, SPLIT_CHAR.DISLIKE_NAME)

/** rules 字符串 → 结构化条目（进入管理页时解析渲染，存储格式不变） */
export const parseDislikeRules = (rules: string): DislikeRuleItem[] => {
  const items: DislikeRuleItem[] = []
  for (const line of rules.split('\n')) {
    if (!line) continue
    const [rawName, rawSinger] = line.split(SPLIT_CHAR.DISLIKE_NAME)
    const name = unescapeName(rawName ?? '')
    const singer = unescapeName(rawSinger ?? '')
    if (name && singer) {
      items.push({ rule: line, type: 'songSinger', name, singer })
    } else if (name) {
      items.push({ rule: line, type: 'song', name, singer: '' })
    } else if (singer) {
      items.push({ rule: line, type: 'singer', name: '', singer })
    }
  }
  return items
}

/** 按规则行删除（重写 rules，走 overwrite 持久化链路） */
export const removeDislikeRule = async(rule: string) => {
  const rules = dislikeInfo.rules.split('\n').filter(line => line && line !== rule).join('\n')
  return overwirteDislikeInfo(rules)
}
