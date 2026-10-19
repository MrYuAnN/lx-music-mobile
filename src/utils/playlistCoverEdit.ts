// 歌单封面自定义编辑工具（歌单封面机制批②，方案 §2.2-3）：相册选图→原生缩放 512px/
// JPEG 0.8（image-picker PhotoQuality 类型为 0.1 步进联合，0.85 不合法——代码审查 S6）→
// 落 DocumentDir/covers_custom/，版本化文件名 {listId}_{ts}.jpg——换图/移除必换路径，
// URI 缓存与 Image memo 才会刷新下游。自定义图属用户资产（不可再生），入 DocumentDir
// 不入 CachesDir（系统可回收，方案审查 I3/I2）。
// 两段式：pick 只选不落（编辑取消不落库，临时文件随系统缓存回收），save 在确认提交时落盘。
// 清旧不在此处：先删旧后改指针非原子，指针落库失败会丢当前封面（三席代码审查 I4）——
// 由调用方在指针落库成功后调 cleanCustomCovers(listId, 新文件名)。
// moveFile 依赖 picker 返回 file:// 临时路径（设置了 maxWidth/maxHeight 触发内部复制，
// 不会是 content://，代码审查 S6 注释固化）
import { launchImageLibrary } from 'react-native-image-picker'
import { mkdir, moveFile, readDir, privateStorageDirectoryPath, unlink, type FileType } from '@/utils/fs'

export const customCoversDirPath = `${privateStorageDirectoryPath}/covers_custom`

// 选图：返回 picker 临时 uri（仅预览用）；用户取消返回 ''，失败抛错由调用方 toast
export const pickCoverImage = async(): Promise<string> => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.8,
    includeBase64: false,
    selectionLimit: 1,
  })
  if (result.didCancel) return ''
  const assetUri = result.assets?.[0]?.uri
  if (!assetUri) throw new Error('pick cover failed')
  return assetUri
}

// 落盘：picker 临时文件移入 covers_custom，返回新封面本地路径（清旧由调用方负责，见头注释）
export const saveCustomCover = async(listId: string, assetUri: string): Promise<string> => {
  const fileName = `${listId}_${Date.now()}.jpg`
  const targetPath = `${customCoversDirPath}/${fileName}`
  await mkdir(customCoversDirPath).catch(() => {})
  await moveFile(assetUri.replace(/^file:\/\//, ''), targetPath)
  return targetPath
}

// 清同歌单旧版本文件（写新后删旧；不传 keepFileName=全清，移除封面用）
export const cleanCustomCovers = async(listId: string, keepFileName?: string) => {
  const entries = await readDir(customCoversDirPath).catch(() => [] as Array<string | FileType>)
  await Promise.all(entries
    .map(e => typeof e == 'string' ? (e.split('/').pop() ?? e) : e.name)
    .filter(n => n.startsWith(`${listId}_`) && n != keepFileName)
    .map(n => unlink(`${customCoversDirPath}/${n}`).catch(() => {})))
}
