import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { View } from 'react-native'
import { externalStorageDirectoryPath, readDir } from '@/utils/fs'
import { createStyle, toast } from '@/utils/tools'
// import { useTranslation } from '@/plugins/i18n'
import SheetBase, { type SheetBaseType } from '@/components/common/SheetBase'

import Header from './components/Header'
import Main from './components/Main'
import Footer from './components/Footer'
import { sizeFormate } from '@/utils'
import { type PathItem } from './components/ListItem'
// import { getSelectedManagedFolder } from '@/utils/data'
// let prevPath = externalStorageDirectoryPath

const parentDirInfo = new Map<string, string>()
const caches = new Map<string, PathItem[]>()

const handleReadDir = async(path: string, dirOnly: boolean, filter?: string[], isRefresh = false) => {
  let filterRxp = filter?.length ? new RegExp(`\\.(${filter.join('|')})$`, 'i') : null
  const cacheKey = `${path}_${dirOnly ? 'true' : 'false'}_${filter ? filter.toString() : 'null'}`
  if (!isRefresh && caches.has(cacheKey)) return caches.get(cacheKey)!
  return readDir(path).then(paths => {
    // console.log('read')
    // prevPath = path
    let list = [] as PathItem[]
    // console.log(paths)
    for (const path of paths) {
      // console.log(path)
      if (filterRxp != null && path.isFile && !filterRxp.test(path.name)) continue

      const isDirectory = path.isDirectory
      if (dirOnly) {
        list.push({
          name: path.name,
          path: path.path,
          mtime: new Date(path.lastModified),
          size: path.size,
          isDir: isDirectory,
          sizeText: isDirectory ? '' : sizeFormate(path.size ?? 0),
          disabled: path.isFile,
        })
      } else {
        list.push({
          name: path.name,
          path: path.path,
          mtime: new Date(path.lastModified),
          size: path.size,
          isDir: isDirectory,
          sizeText: isDirectory ? '' : sizeFormate(path.size ?? 0),
        })
      }
    }

    list.sort((a, b) => a.name.charCodeAt(0) - b.name.charCodeAt(0))
    let fileList = [] as PathItem[]
    list = [...list.filter(i => {
      if (i.isDir) return true
      else {
        fileList.push(i)
        return false
      }
    }), ...fileList]
    caches.set(cacheKey, list)
    return list
  })
}

interface ReadOptions {
  title: string
  dirOnly: boolean
  filter?: string[]
}
const initReadOptions = {}
export interface ListProps {
  onConfirm: (path: string) => void
  onHide?: () => void
}

export interface ListType {
  show: (title: string, dir?: string, dirOnly?: boolean, filter?: string[]) => void
  hide: () => void
}

export default forwardRef<ListType, ListProps>(({
  onConfirm,
  onHide = () => {},
}: ListProps, ref) => {
  const [path, setPath] = useState('')
  const [list, setList] = useState<PathItem[]>([])
  const isUnmountedRef = useRef(true)
  const readOptions = useRef<ReadOptions>(initReadOptions as ReadOptions)
  const [isReading, setIsReading] = useState(false)
  const modalRef = useRef<SheetBaseType>(null)

  useImperativeHandle(ref, () => ({
    show(title, dir = '', dirOnly = false, filter) {
      readOptions.current = {
        title,
        dirOnly,
        filter,
      }
      modalRef.current?.setVisible(true)
      // void getSelectedManagedFolder().then(uri => {
      //   if (!uri) return
      //   void readDir(uri, dirOnly, filter)
      // })
      if (dir) void readDir(dir, dirOnly, filter)
      else void readDir(externalStorageDirectoryPath, dirOnly, filter)
    },
    hide() {
      modalRef.current?.setVisible(false)
    },
  }))

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const readDir = async(newPath: string, dirOnly: boolean, filter?: string[], isRefresh?: boolean, isOpen?: boolean): Promise<PathItem[]> => {
    if (isReading) return []
    setIsReading(true)
    return handleReadDir(newPath, dirOnly, filter, isRefresh).then(list => {
      if (isUnmountedRef.current) return []
      if (!isOpen && newPath != path && newPath.startsWith(path)) parentDirInfo.set(newPath, path)
      setList(list)
      setPath(newPath)
      return list
    }).catch((err: any) => {
      toast(`Read dir error: ${err.message as string}`, 'long')
      // console.log('prevPath', prevPath)
      // if (isReadingDir.current) return
      // setPath(prevPath)
      return []
    }).finally(() => {
      setIsReading(false)
    })
  }

  const onSetPath = (pathInfo: PathItem) => {
    // console.log('onSetPath')
    if (pathInfo.isDir) {
      void readDir(pathInfo.path, readOptions.current.dirOnly, readOptions.current.filter)
    } else {
      onConfirm(pathInfo.path)
      // setPath(pathInfo.path)
    }
  }
  const handleConfirm = () => {
    if (!path) return
    onConfirm(path)
  }

  const toParentDir = () => {
    const parentPath = parentDirInfo.get(path)
    if (parentPath) {
      void readDir(parentPath, readOptions.current.dirOnly, readOptions.current.filter)
    } else {
      toast('Permission denied')
    }
  }

  const handleHide = () => {
    // 外部 onHide 统一走 SheetBase 的 onHide 通道（setVisible(false)→handleClose 触发），
    // 覆盖 Footer 取消/把手下滑/返回键全部关闭路径，此处不重复调防双调
    modalRef.current?.setVisible(false)
  }

  // const dirList = useMemo(() => [parentDir, ...list], [list, parentDir])

  return (
    // 近全屏底部弹层（弹窗体系统一方案批2#9，iOS 文件 App document browser 同构）：
    // 把手+下滑关闭，bgHide=false 维持原全屏页防误触语义（列表误触不关层）；标题由 Header 承载
    <SheetBase ref={modalRef} onHide={onHide} bgHide={false} maxHeight="90%">
      <View style={styles.container}>
        <Header
          onRefreshDir={async(path) => readDir(path, readOptions.current.dirOnly, readOptions.current.filter, true)}
          onOpenDir={async(path) => readDir(path, readOptions.current.dirOnly, readOptions.current.filter, false, true)}
          title={readOptions.current.title}
          path={path} />
        <Main list={list} toParentDir={toParentDir} onSetPath={onSetPath} loading={isReading} />
        <Footer onConfirm={handleConfirm} onHide={handleHide} dirOnly={readOptions.current.dirOnly} />
      </View>
    </SheetBase>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 1,
  },
})

