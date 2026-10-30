
// interface DownloadList {

// }


declare namespace SY {
  namespace Download {
    type DownloadTaskStatus = 'run'
    | 'waiting'
    | 'pause'
    | 'error'
    | 'completed'

    type FileExt = 'mp3' | 'flac' | 'wav' | 'ape'

    /** 新增下载任务三态结果（2026-10-29 ①-3 定稿）：added=入队 / exists=任务在途 /
     * downloaded=已完成同档（对标 Apple Music/QQ音乐已下载 no-op） */
    type AddDownloadStatus = 'added' | 'exists' | 'downloaded'
    interface AddDownloadResult {
      status: AddDownloadStatus
      /** status=downloaded 时返回命中任务的实际落地档（toast 展示用，审查 I-F 回退链口径） */
      downloadedQuality?: SY.Quality
    }

    interface ProgressInfo {
      progress: number
      speed: string
      downloaded: number
      total: number
    }

    interface DownloadTaskActionBase <A> {
      action: A
    }
    interface DownloadTaskActionData<A, D> extends DownloadTaskActionBase<A> {
      data: D
    }
    type DownloadTaskAction<A, D = undefined> = D extends undefined ? DownloadTaskActionBase<A> : DownloadTaskActionData<A, D>

    type DownloadTaskActions = DownloadTaskAction<'start'>
    | DownloadTaskAction<'complete'>
    | DownloadTaskAction<'refreshUrl'>
    | DownloadTaskAction<'statusText', string>
    | DownloadTaskAction<'progress', ProgressInfo>
    | DownloadTaskAction<'error', {
      error?: string
      message?: string
    }>

    interface ListItem {
      id: string
      isComplate: boolean
      status: DownloadTaskStatus
      statusText: string
      downloaded: number
      total: number
      progress: number
      speed: string
      metadata: {
        musicInfo: SY.Music.MusicInfoOnline
        url: string | null
        /** 实际落地档（resolve 回退时由 applyResolved 回写） */
        quality: SY.Quality
        /** 用户请求档（审查 I-F：回退链下与落地档可能不同，三态判定与换档语义依据） */
        requestedQuality?: SY.Quality
        ext: FileExt
        fileName: string
        filePath: string
      }
    }
  }
}
